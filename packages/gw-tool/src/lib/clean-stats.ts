/**
 * Cleanup statistics for gw repositories
 *
 * Scans a repository for worktrees, local branches without a worktree, and
 * orphan branches, with the metadata clean needs (age, uncommitted/unpushed
 * work, protection, optional disk usage). The same structured result feeds
 * the interactive picker, the overview chart, `gw clean --stats`, and
 * `gw clean --remove`.
 */

import { resolve } from '@std/path';
import { isProtectedBranch } from './branch-protection.ts';
import { mapWithConcurrency } from './concurrency.ts';
import {
  findOrphanBranches,
  getBranchLastCommitDate,
  getWorktreeAgeDays,
  hasUncommittedChanges,
  hasUnpushedCommits,
  listLocalBranches,
  listWorktrees,
  pruneWorktrees,
} from './git-utils.ts';
import * as output from './output.ts';

/** Per-repository settings that decide what clean may touch */
export interface RepoCleanSettings {
  defaultBranch: string;
  userProtected: string[];
  cleanThreshold: number;
}

/** A worktree as seen by clean */
export interface WorktreeStat {
  /** Stable id accepted by `gw clean --remove` */
  id: string;
  branch: string;
  path: string;
  ageDays: number;
  uncommitted: boolean;
  unpushed: boolean;
  protected: boolean;
  /** Disk usage in bytes, or null when not measured (see --size) */
  sizeBytes: number | null;
}

/** A local branch without a worktree */
export interface BranchStat {
  /** Stable id accepted by `gw clean --remove` */
  id: string;
  name: string;
  /** Date of the last commit (YYYY-MM-DD), or '' if unknown */
  lastCommit: string;
  protected: boolean;
}

/** An orphan branch: no worktree, upstream gone or never pushed */
export interface OrphanStat extends BranchStat {
  unpushed: boolean;
}

/** Cleanup statistics for one repository */
export interface RepoStats {
  name: string;
  path: string;
  defaultBranch: string;
  worktrees: WorktreeStat[];
  branches: BranchStat[];
  orphans: OrphanStat[];
  totals: {
    worktrees: number;
    branches: number;
    orphans: number;
    /** Items that are not protected (what clean could remove) */
    removable: number;
    /** Total worktree disk usage in bytes, or null when not measured */
    sizeBytes: number | null;
  };
}

/**
 * Check whether a branch is protected by any mechanism — system rules
 * (defaultBranch, main, master, gw_root) or the user-configured list.
 *
 * @param branch The branch name to check
 * @param defaultBranch The configured default branch name
 * @param userProtected Additional branch names the user has explicitly protected
 */
export function isEffectivelyProtected(
  branch: string | undefined,
  defaultBranch: string,
  userProtected: string[]
): boolean {
  if (isProtectedBranch(branch, defaultBranch)) {
    return true;
  }
  return !!branch && userProtected.includes(branch);
}

/**
 * Check whether a worktree must never be removed: its branch is protected,
 * or it is the repository's default worktree by location — the repo root
 * itself (main working tree) or `<root>/<defaultBranch>` — which stays
 * protected even when it sits on a detached HEAD.
 *
 * @param wt The worktree's branch ('' when detached) and path
 * @param repoRoot Repository root (bare root for bare setups)
 */
export function isProtectedWorktree(
  wt: { branch: string; path: string },
  repoRoot: string,
  settings: Pick<RepoCleanSettings, 'defaultBranch' | 'userProtected'>
): boolean {
  if (isEffectivelyProtected(wt.branch, settings.defaultBranch, settings.userProtected)) {
    return true;
  }
  const path = resolve(wt.path);
  return path === resolve(repoRoot) || path === resolve(repoRoot, settings.defaultBranch);
}

/** Id of a worktree for `gw clean --remove` */
export function worktreeId(path: string): string {
  return `wt:${path}`;
}

/** Id of a branch for `gw clean --remove` (git forbids ':' in branch names) */
export function branchId(repoPath: string, branch: string): string {
  return `br:${repoPath}:${branch}`;
}

/** A parsed `--remove` id */
export type ParsedItemId = { kind: 'worktree'; path: string } | { kind: 'branch'; repoPath: string; branch: string };

/**
 * Parse an id produced by worktreeId/branchId.
 * @returns the parsed id, or null when it is malformed
 */
export function parseItemId(id: string): ParsedItemId | null {
  if (id.startsWith('wt:') && id.length > 3) {
    return { kind: 'worktree', path: id.slice(3) };
  }
  if (id.startsWith('br:')) {
    const rest = id.slice(3);
    const sep = rest.lastIndexOf(':');
    if (sep > 0 && sep < rest.length - 1) {
      return { kind: 'branch', repoPath: rest.slice(0, sep), branch: rest.slice(sep + 1) };
    }
  }
  return null;
}

/**
 * Disk usage of a directory in bytes (via `du -sk`), or null on failure
 */
export async function dirSizeBytes(path: string): Promise<number | null> {
  try {
    const { code, stdout } = await new Deno.Command('du', {
      args: ['-sk', path],
      stdout: 'piped',
      stderr: 'null',
    }).output();
    // du exits non-zero on unreadable subdirectories but still prints a total
    const kb = parseInt(new TextDecoder().decode(stdout).trim().split(/\s+/)[0], 10);
    if (Number.isNaN(kb)) return code === 0 ? 0 : null;
    return kb * 1024;
  } catch {
    return null;
  }
}

/**
 * Format a byte count for humans (e.g. "1.4 GB")
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/**
 * Sum worktree disk usage, skipping worktrees nested inside another listed
 * worktree (their bytes are already counted by the parent's du).
 */
function totalWorktreeSize(worktrees: WorktreeStat[]): number {
  let total = 0;
  for (const wt of worktrees) {
    const nested = worktrees.some((other) => other !== wt && resolve(wt.path).startsWith(resolve(other.path) + '/'));
    if (!nested && wt.sizeBytes !== null) total += wt.sizeBytes;
  }
  return total;
}

/**
 * Measure disk usage for an already-collected repository in place (used to
 * fill in sizes after the picker is already on screen). Does not depend on
 * the current directory.
 */
export async function measureRepoSizes(stats: RepoStats): Promise<void> {
  await mapWithConcurrency(stats.worktrees, async (wt) => {
    wt.sizeBytes = await dirSizeBytes(wt.path);
  });
  stats.totals.sizeBytes = totalWorktreeSize(stats.worktrees);
}

/**
 * Scan the repository in the current directory.
 *
 * git commands run against the current directory, so callers must chdir
 * into the repository first (see clean.ts withCwd).
 *
 * @param name Display name of the repository
 * @param repoPath Repository root (used in branch ids)
 * @param settings Protection settings for this repository
 * @param withSize Measure worktree disk usage (slow on large repos)
 */
export async function collectRepoStats(
  name: string,
  repoPath: string,
  settings: RepoCleanSettings,
  withSize = false
): Promise<RepoStats> {
  const { defaultBranch, userProtected } = settings;

  // Prune stale metadata first
  try {
    await pruneWorktrees(true);
  } catch {
    // Continue if prune fails
  }

  const allWorktrees = await listWorktrees();
  const allBranches = await listLocalBranches();
  const worktreeBranches = new Set(allWorktrees.map((wt) => wt.branch).filter(Boolean));

  // Analyze worktrees in parallel — each requires several git calls, so
  // running them sequentially is slow when there are many worktrees. The
  // pool bounds how many run at once so large repos don't exhaust resources.
  const worktrees: WorktreeStat[] = await mapWithConcurrency(
    allWorktrees.filter((wt) => !wt.bare),
    async (wt): Promise<WorktreeStat> => {
      const isProtected = isProtectedWorktree(wt, repoPath, settings);
      const [ageDays, uncommitted, unpushed, sizeBytes] = await Promise.all([
        getWorktreeAgeDays(wt.path),
        hasUncommittedChanges(wt.path),
        hasUnpushedCommits(wt.path),
        withSize ? dirSizeBytes(wt.path) : Promise.resolve(null),
      ]);
      return {
        id: worktreeId(wt.path),
        branch: wt.branch,
        path: wt.path,
        ageDays,
        uncommitted,
        unpushed,
        protected: isProtected,
        sizeBytes,
      };
    }
  );

  const orphanInfos = await findOrphanBranches(allWorktrees, defaultBranch);
  const orphanNames = new Set(orphanInfos.map((o) => o.name));

  // Local branches without a worktree, excluding those listed as orphans
  const branches: BranchStat[] = await mapWithConcurrency(
    allBranches.filter((b) => !worktreeBranches.has(b) && !orphanNames.has(b)),
    async (branch): Promise<BranchStat> => ({
      id: branchId(repoPath, branch),
      name: branch,
      lastCommit: await getBranchLastCommitDate(branch),
      protected: isEffectivelyProtected(branch, defaultBranch, userProtected),
    })
  );

  const orphans: OrphanStat[] = await mapWithConcurrency(
    orphanInfos,
    async (o): Promise<OrphanStat> => ({
      id: branchId(repoPath, o.name),
      name: o.name,
      lastCommit: await getBranchLastCommitDate(o.name),
      // Defense-in-depth: findOrphanBranches already filters system-protected
      // branches; user-protected ones must be re-asserted here.
      protected: isEffectivelyProtected(o.name, defaultBranch, userProtected),
      unpushed: o.hasUnpushed,
    })
  );

  // Sum disk usage, skipping worktrees nested inside another listed worktree
  // (their bytes are already counted by the parent's du).
  const sizeBytes = withSize ? totalWorktreeSize(worktrees) : null;

  const removable = [...worktrees, ...branches, ...orphans].filter((i) => !i.protected).length;

  return {
    name,
    path: repoPath,
    defaultBranch,
    worktrees,
    branches,
    orphans,
    totals: {
      worktrees: worktrees.length,
      branches: branches.length,
      orphans: orphans.length,
      removable,
      sizeBytes,
    },
  };
}

/**
 * Render a short bar chart ranking repositories by what can be cleaned up:
 * by disk usage when sizes were measured, otherwise by removable items.
 *
 * @param stats Repository statistics
 * @param maxRows Maximum repositories to list (the rest are summarized)
 * @returns Lines to print (no trailing blank line)
 */
export function renderOverviewChart(stats: RepoStats[], maxRows = 5): string[] {
  const bySize = stats.some((s) => s.totals.sizeBytes !== null);
  const metric = (s: RepoStats) => (bySize ? (s.totals.sizeBytes ?? 0) : s.totals.removable);
  const ranked = stats.filter((s) => metric(s) > 0).sort((a, b) => metric(b) - metric(a));

  const sum = (f: (s: RepoStats) => number) => stats.reduce((n, s) => n + f(s), 0);
  const summary = [
    `${stats.length} repo${stats.length === 1 ? '' : 's'}`,
    `${sum((s) => s.totals.worktrees)} worktrees`,
    `${sum((s) => s.totals.branches)} branches`,
    `${sum((s) => s.totals.orphans)} orphans`,
  ];
  if (bySize) summary.push(formatBytes(sum((s) => s.totals.sizeBytes ?? 0)));

  const lines = [`${output.bold('Overview')} ${output.dim(`— ${summary.join(' · ')}`)}`];
  if (ranked.length === 0) {
    lines.push(output.dim('  Nothing to clean up'));
    return lines;
  }

  const shown = ranked.slice(0, maxRows);
  const nameWidth = Math.min(28, Math.max(...shown.map((s) => s.name.length)));
  const barWidth = 20;
  const top = metric(shown[0]);

  for (const s of shown) {
    const name = s.name.length > nameWidth ? s.name.slice(0, nameWidth - 1) + '…' : s.name.padEnd(nameWidth);
    const len = Math.max(1, Math.round((metric(s) / top) * barWidth));
    const bar = '█'.repeat(len) + ' '.repeat(barWidth - len);
    const removableWorktrees = s.worktrees.filter((w) => !w.protected).length;
    const detail = [
      `${removableWorktrees} wt`,
      `${s.branches.filter((b) => !b.protected).length} br`,
      `${s.orphans.filter((o) => !o.protected).length} orphan`,
    ];
    if (bySize) detail.push(formatBytes(s.totals.sizeBytes ?? 0));
    lines.push(`  ${name}  ${output.path(bar)}  ${output.dim(detail.join(' · '))}`);
  }

  if (ranked.length > shown.length) {
    lines.push(output.dim(`  … ${ranked.length - shown.length} more`));
  }

  return lines;
}
