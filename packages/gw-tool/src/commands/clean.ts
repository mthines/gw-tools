/**
 * Clean command implementation
 * Remove stale worktrees based on age threshold
 */

import { join, resolve } from '@std/path';
import {
  collectRepoStats,
  formatBytes,
  isEffectivelyProtected,
  isProtectedWorktree,
  parseItemId,
  type RepoCleanSettings,
  type RepoStats,
  renderOverviewChart,
  type WorktreeStat,
} from '../lib/clean-stats.ts';
import { loadConfig, loadProtectedBranches, loadRootConfig } from '../lib/config.ts';
import { mapWithConcurrency } from '../lib/concurrency.ts';
import {
  deleteBranch,
  getWorktreeAgeDays,
  hasUncommittedChanges,
  hasUnpushedCommits,
  listLocalBranches,
  listWorktrees,
  pruneOrphanBranches,
  pruneWorktrees,
  removeWorktree,
  type WorktreeInfo,
} from '../lib/git-utils.ts';
import { multiSelect, type SelectItem, type SelectSection, type TerminalIO } from '../lib/interactive-select.ts';
import * as output from '../lib/output.ts';
import { findGitRoot, pathExists } from '../lib/path-resolver.ts';
import { getRepoDisplayName, pruneMissingRepos, type RegisteredRepo } from '../lib/repo-registry.ts';
import { signalNavigation } from '../lib/shell-navigation.ts';
import type { Config } from '../lib/types.ts';

/**
 * Print a JSON report on stdout. In the JSON modes of --all, --stats and
 * --remove, executeClean points this at the real stdout and routes every
 * other console.log (e.g. config warnings) to stderr, so stdout stays
 * parseable.
 */
let printJson = (value: unknown): void => console.log(JSON.stringify(value));

/**
 * Check if a path is inside or equal to another path
 */
export function isPathInside(childPath: string, parentPath: string): boolean {
  const child = resolve(childPath);
  const parent = resolve(parentPath);
  return child === parent || child.startsWith(parent + '/');
}

/**
 * Navigate to git root if the current directory is inside any of the given paths.
 * Returns true if navigation occurred.
 */
async function navigateAwayIfNeeded(paths: string[]): Promise<boolean> {
  const cwd = Deno.cwd();
  const removingCurrent = paths.some((p) => isPathInside(cwd, p));

  if (removingCurrent) {
    try {
      const { gitRoot } = await loadConfig();
      Deno.chdir(gitRoot);
      await signalNavigation(gitRoot);
      return true;
    } catch {
      // Continue anyway — git command might still work
    }
  }
  return false;
}

/**
 * Parsed clean command arguments
 */
interface CleanArgs {
  help: boolean;
  force: boolean;
  dryRun: boolean;
  useThreshold: boolean;
  json: boolean;
  yes: boolean;
  auto: boolean;
  all: boolean;
  stats: boolean;
  size: boolean;
  /** Item ids passed via --remove (repeatable) */
  remove: string[];
}

/**
 * Parse clean command arguments
 */
function parseCleanArgs(args: string[]): CleanArgs {
  const remove: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--remove' && i + 1 < args.length) {
      remove.push(args[++i]);
    } else if (args[i].startsWith('--remove=')) {
      remove.push(args[i].slice('--remove='.length));
    }
  }

  return {
    help: args.includes('--help') || args.includes('-h'),
    force: args.includes('--force') || args.includes('-f'),
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    useThreshold: args.includes('--use-autoclean-threshold'),
    json: args.includes('--json'),
    yes: args.includes('--yes') || args.includes('-y'),
    auto: args.includes('--auto') || args.includes('-a'),
    all: args.includes('--all'),
    stats: args.includes('--stats'),
    size: args.includes('--size'),
    remove,
  };
}

/**
 * Show help for the clean command
 */
function showCleanHelp(): void {
  console.log(`Usage: gw clean [options]

Interactive cleanup of worktrees, branches, and orphan branches.

By default, opens an interactive multi-select UI where you can pick exactly
which worktrees, branches, and orphans to remove. Use --auto to remove ALL
safe worktrees automatically without the interactive UI.

Automatically prunes stale worktree metadata before listing, ensuring only
worktrees that actually exist on disk are shown.

Options:
  --all                      Clean across ALL gw repositories on this machine
                             (every repo registered in ~/.config/gw/repos.json).
                             Works with both interactive and --auto mode
  --stats                    Report what could be cleaned (overview chart + items
                             with ids) and exit without removing anything.
                             Combine with --all for every repo, --json for agents
  --size                     Measure worktree disk usage (slow on large repos);
                             adds sizes to the --all overview chart and --stats
  --remove <id>              Remove exactly this item (repeatable). Ids come from
                             --stats / --stats --json: wt:<path> or
                             br:<repo>:<branch>. Protected items are refused;
                             dirty/unpushed worktrees need --force
  -a, --auto                 Auto mode: remove all safe worktrees without
                             interactive selection (previous default behavior)
  --use-autoclean-threshold  Only remove worktrees older than configured threshold
                             (only applies in --auto mode)
  -f, --force                Skip safety checks (uncommitted changes, unpushed commits)
                             WARNING: This may result in data loss
  -n, --dry-run              Preview what would be removed without actually removing
                             (only applies in --auto mode)
  --json                     Output results as JSON and exit (implies --dry-run in
                             --auto mode; machine-readable report with --stats
                             and --remove)
  -y, --yes                  Skip confirmation prompt (only applies in --auto mode)
  -h, --help                 Show this help message

Safety Features:
  - Interactive mode uses force-deletion for selected items — choose carefully
  - Auto mode only removes worktrees with NO uncommitted changes or unpushed
    commits (unless --force is used)
  - Always prompts for confirmation before deletion
  - Bare repository, configured default branch, gw_root, and the canonical
    trunk names "main" and "master" are never removed (even when one of
    them is not the configured default)
  - After removing worktrees, automatically prunes orphan branches
    (branches with no worktree and no unpushed commits)

Repository Registry (--all):
  gw records every repository it is used in (on gw init and whenever any gw
  command runs inside a repo) in $XDG_CONFIG_HOME/gw/repos.json, falling
  back to ~/.config/gw/repos.json. Repos that no longer exist on disk are
  skipped and dropped from the registry. Each repo keeps its own default
  branch and protected branches.

  In the interactive --all picker, sections are grouped per repo
  ("<repo> › Worktrees", "<repo> › Local Branches", "<repo> › Orphan
  Branches"), under an overview chart ranking repos by how much can be
  cleaned (by disk usage with --size). The root "Select all" row selects everything, so you can
  then unselect what to keep. Press 'a' to toggle the current section, or
  'w' to toggle that category (e.g. all worktrees) in every repo.

Examples:
  # Interactive mode (default): pick exactly what to remove
  gw clean

  # Interactive mode across every gw repository
  gw clean --all

  # Auto mode: remove all safe worktrees regardless of age
  gw clean --auto

  # Auto mode across every gw repository (preview first)
  gw clean --all --auto --dry-run

  # Where is the clutter? Stats for every repo, with disk usage
  gw clean --stats --all --size

  # Agent workflow: read the report, then remove chosen items by id
  gw clean --stats --all --json
  gw clean --remove wt:/path/to/repo.git/feat-x --remove br:/path/to/repo.git:old --yes --json

  # Preview what auto mode would remove
  gw clean --auto --dry-run

  # Auto mode: only remove worktrees older than configured threshold
  gw clean --auto --use-autoclean-threshold

  # Force remove all worktrees without safety checks (dangerous!)
  gw clean --auto --force

  # Configure threshold during init (used by --use-autoclean-threshold)
  gw init --clean-threshold 14

Comparison:
  gw clean                         - Interactive multi-select UI
  gw clean --all                   - Interactive multi-select UI for all repos
  gw clean --auto                  - Removes ALL safe worktrees
  gw clean --auto --use-autoclean-threshold - Removes only OLD safe worktrees
  gw prune --clean                 - Removes all clean worktrees (no safety checks)

Configuration:
  The clean threshold is stored in .gw/config.json:
  {
    "cleanThreshold": 7  // Days threshold for --use-autoclean-threshold flag
  }
`);
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  console.log(`\n${message}`);
  console.log(output.dim("Type 'yes' to confirm: "));

  const buf = new Uint8Array(1024);
  const n = await Deno.stdin.read(buf);

  if (!n) return false;

  const response = new TextDecoder().decode(buf.subarray(0, n)).trim().toLowerCase();
  return response === 'yes';
}

/**
 * Worktree with metadata for cleaning
 */
interface CleanableWorktree extends WorktreeInfo {
  ageDays: number;
  hasUncommitted: boolean;
  hasUnpushed: boolean;
  canClean: boolean;
  reason?: string;
}

/**
 * Options for building the interactive clean sections of one repository
 */
interface SectionOptions {
  /** Prefix for section titles, e.g. "my-repo › " (empty for single-repo mode) */
  titlePrefix: string;
  /** Prefix for item values, used to tell repos apart (empty for single-repo mode) */
  valuePrefix: string;
  /** Tag sections with a category so 'w' can toggle it across repos */
  withCategories: boolean;
}

/**
 * Build the interactive clean sections (worktrees, local branches without a
 * worktree, orphans) from a repository's statistics.
 */
function sectionsFromStats(stats: RepoStats, options: SectionOptions): SelectSection[] {
  const { titlePrefix, valuePrefix, withCategories } = options;
  const protectedItem = (label: string, value: string): SelectItem => ({
    label,
    value,
    disabled: true,
    disabledReason: 'protected branch - cannot remove',
  });

  const worktreeItems: SelectItem[] = stats.worktrees.map((wt) => {
    const label = wt.branch || wt.path;
    const value = `${valuePrefix}worktree:${wt.path}`;
    if (wt.protected) return protectedItem(label, value);

    const hints: string[] = [];
    if (wt.ageDays > 0) hints.push(`${wt.ageDays}d old`);
    if (wt.uncommitted) hints.push('uncommitted');
    if (wt.unpushed) hints.push('unpushed');
    if (wt.sizeBytes !== null) hints.push(formatBytes(wt.sizeBytes));
    return { label, value, hint: hints.length > 0 ? `(${hints.join(', ')})` : '' };
  });

  const branchItems: SelectItem[] = stats.branches.map((b) => {
    const value = `${valuePrefix}branch:${b.name}`;
    if (b.protected) return protectedItem(b.name, value);
    return { label: b.name, value, hint: b.lastCommit ? `(${b.lastCommit})` : '' };
  });

  const orphanItems: SelectItem[] = stats.orphans.map((o) => {
    const value = `${valuePrefix}orphan:${o.name}`;
    // Defense-in-depth: the orphan section is the most destructive code path
    // (force-deletes via -D), so protection is re-asserted in collectRepoStats.
    if (o.protected) return protectedItem(o.name, value);
    const parts: string[] = [];
    if (o.lastCommit) parts.push(o.lastCommit);
    parts.push(o.unpushed ? 'unpushed' : 'remote gone');
    return { label: o.name, value, hint: `(${parts.join(', ')})` };
  });

  // ── Build sections (only include non-empty ones) ──────
  const sections: SelectSection[] = [];
  const addSection = (title: string, category: string, items: SelectItem[]) => {
    if (items.length === 0) return;
    sections.push({
      title: `${titlePrefix}${title}`,
      items,
      ...(withCategories ? { category } : {}),
    });
  };
  addSection('Worktrees', 'worktrees', worktreeItems);
  addSection('Local Branches (no worktree)', 'branches', branchItems);
  addSection('Orphan Branches', 'orphans', orphanItems);

  return sections;
}

/**
 * Result of removing one selected item
 */
type RemovalResult =
  | { kind: 'worktree' | 'branch'; label: string; success: true }
  | { kind: 'worktree' | 'branch'; label: string; success: false; error: string };

/**
 * Remove the selected items (values like "worktree:<path>", "branch:<name>",
 * "orphan:<name>") in the repository of the current directory.
 *
 * Selected items are independent (branches with an active worktree are
 * excluded from the branch/orphan sections), so removals run in parallel.
 */
function removeSelectedItems(selected: string[], worktrees: WorktreeStat[]): Promise<RemovalResult[]> {
  return mapWithConcurrency(selected, async (value): Promise<RemovalResult> => {
    const [type, ...rest] = value.split(':');
    const target = rest.join(':');

    if (type === 'worktree') {
      const wt = worktrees.find((w) => w.path === target);
      const label = wt?.branch || target;
      try {
        await removeWorktree(target, true); // force
        return { kind: 'worktree', label, success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { kind: 'worktree', label, success: false, error: msg };
      }
    }

    // branch or orphan
    try {
      await deleteBranch(target, true); // force
      return { kind: 'branch', label: target, success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { kind: 'branch', label: target, success: false, error: msg };
    }
  });
}

/**
 * Print removal results in order and tally them
 */
function reportRemovalResults(
  results: RemovalResult[],
  indent = '  '
): { removedWorktrees: number; removedBranches: number; failed: number } {
  let removedWorktrees = 0;
  let removedBranches = 0;
  let failed = 0;

  for (const r of results) {
    const verb = r.kind === 'worktree' ? 'worktree' : 'branch';
    if (r.success) {
      console.log(`${indent}${output.checkmark()} Removed ${verb} ${output.path(r.label)}`);
      if (r.kind === 'worktree') removedWorktrees++;
      else removedBranches++;
    } else {
      console.log(`${indent}${output.errorSymbol()} Failed ${verb} ${output.path(r.label)}: ${output.dim(r.error)}`);
      failed++;
    }
  }

  return { removedWorktrees, removedBranches, failed };
}

/**
 * Print the totals line after an interactive clean
 */
function printInteractiveSummary(
  totals: { removedWorktrees: number; removedBranches: number; failed: number },
  navigatedToRoot: boolean
): void {
  console.log();
  if (totals.removedWorktrees > 0) {
    output.success(`Removed ${totals.removedWorktrees} worktree(s)`);
  }
  if (totals.removedBranches > 0) {
    output.success(`Deleted ${totals.removedBranches} branch(es)`);
  }
  if (totals.failed > 0) {
    output.error(`Failed to remove ${totals.failed} item(s)`);
  }
  if (navigatedToRoot) {
    output.info('Navigated to git root (removed current worktree)');
  }
}

/**
 * Execute interactive clean mode
 * Shows a multi-select UI for worktrees, branches, and orphans
 */
async function executeInteractiveClean(withSize = false): Promise<void> {
  const { config, gitRoot } = await loadConfig();
  const defaultBranch = config.defaultBranch || 'main';
  // protectedBranches comes from the canonical git-root config — see
  // protect.ts for the rationale.
  const userProtected = await loadProtectedBranches();

  output.info('Scanning worktrees, branches, and orphans...');

  const stats = await collectRepoStats(
    getRepoDisplayName(gitRoot),
    gitRoot,
    {
      defaultBranch,
      userProtected,
      cleanThreshold: config.cleanThreshold ?? 7,
    },
    withSize
  );
  const worktrees = stats.worktrees;
  const sections = sectionsFromStats(stats, { titlePrefix: '', valuePrefix: '', withCategories: false });

  if (sections.length === 0) {
    output.success('Nothing to clean');
    Deno.exit(0);
  }

  // ── Show multi-select UI ──────────────────────────────
  const result = await multiSelect({
    message: 'Select items to clean:',
    sections,
    warningBanner: 'Selected items will be force-deleted. ' + 'This may result in data loss.',
  });

  if (result.cancelled || result.selected.length === 0) {
    console.log('\nCancelled.\n');
    Deno.exit(0);
  }

  // ── Navigate away if removing current worktree ──────
  const selectedWorktreePaths = result.selected
    .filter((v) => v.startsWith('worktree:'))
    .map((v) => v.split(':').slice(1).join(':'));

  const navigatedToRoot = await navigateAwayIfNeeded(selectedWorktreePaths);

  // ── Process selections ────────────────────────────────
  // Results are collected and printed in order afterwards to keep output
  // readable despite the concurrent execution.
  console.log(`Removing ${result.selected.length} item(s)...\n`);
  const removalResults = await removeSelectedItems(result.selected, worktrees);
  const totals = reportRemovalResults(removalResults);

  // ── Summary ───────────────────────────────────────────
  printInteractiveSummary(totals, navigatedToRoot);
}

/**
 * Load the clean settings of the repository whose root is the current
 * directory, without creating any config file.
 *
 * Mirrors single-repo clean: defaultBranch and cleanThreshold come from a
 * worktree's config (as loadConfig resolves it from inside a worktree,
 * including config.local.json), and protectedBranches from the canonical
 * git-root config (see protect.ts). On bare repos the root config often
 * holds only defaults, so it is used for defaultBranch only as a fallback.
 *
 * Every defaultBranch found (worktree and root) is protected, so a stale
 * or default-only config can never expose the real trunk to removal.
 */
async function loadRepoCleanSettings(repoRoot: string): Promise<RepoCleanSettings> {
  let rootConfig: Config | undefined;
  if (await pathExists(join(repoRoot, '.gw', 'config.json'))) {
    rootConfig = (await loadRootConfig()).config;
  }

  let worktreeConfig: Config | undefined;
  for (const wt of await listWorktrees()) {
    if (wt.bare || !(await pathExists(join(wt.path, '.gw', 'config.json')))) continue;
    Deno.chdir(wt.path);
    try {
      worktreeConfig = (await loadConfig()).config;
    } finally {
      Deno.chdir(repoRoot);
    }
    break;
  }

  const defaultBranch = worktreeConfig?.defaultBranch || rootConfig?.defaultBranch || 'main';
  const userProtected = [...(rootConfig?.protectedBranches ?? worktreeConfig?.protectedBranches ?? [])];
  for (const branch of [worktreeConfig?.defaultBranch, rootConfig?.defaultBranch]) {
    if (branch && branch !== defaultBranch && !userProtected.includes(branch)) {
      userProtected.push(branch);
    }
  }

  return {
    defaultBranch,
    userProtected,
    cleanThreshold: worktreeConfig?.cleanThreshold ?? rootConfig?.cleanThreshold ?? 7,
  };
}

/** Folder names that identify a checkout's branch rather than its project */
const TRUNK_FOLDER_NAMES = new Set(['main', 'master', 'develop', 'trunk']);

/**
 * Build display names for registered repos: the directory name, extended
 * with parent directories only as far as needed to tell repos apart
 * (e.g. "mthines/agent-skills.git" vs "agent-skills.git").
 */
export function buildRepoDisplayNames(repos: RegisteredRepo[]): string[] {
  const parts = repos.map((r) => r.path.split('/').filter(Boolean));
  return parts.map((segments, i) => {
    // A repo checked out into a folder named after a trunk branch (e.g.
    // "AeroSpace.git/main") is unrecognizable by its folder name alone.
    const minDepth = TRUNK_FOLDER_NAMES.has(segments[segments.length - 1]) ? 2 : 1;
    for (let depth = minDepth; depth <= segments.length; depth++) {
      const name = segments.slice(-depth).join('/');
      const clash = parts.some((other, j) => j !== i && other.slice(-depth).join('/') === name);
      if (!clash) return name;
    }
    return repos[i].path;
  });
}

/**
 * Load the registered repos for --all, dropping ones missing on disk.
 * Exits when there is nothing to clean.
 */
async function loadReposForCleanAll(json: boolean): Promise<RegisteredRepo[]> {
  const { existing, removed } = await pruneMissingRepos();

  if (!json && removed.length > 0) {
    output.warning(
      `Skipped ${removed.length} missing repo(s) (removed from registry): ${removed.map((r) => r.path).join(', ')}`
    );
  }

  if (existing.length === 0) {
    if (json) {
      printJson({ repos: [] });
      Deno.exit(0);
    }
    output.info('No gw repositories registered yet.');
    console.log(output.dim('Run gw init, or any gw command inside a repository, to register it.\n'));
    Deno.exit(0);
  }

  return existing;
}

/**
 * Run `fn` with the current directory set to `dir`, restoring it afterwards
 * (falling back to `fallbackDir` when the original directory was removed).
 */
async function withCwd<T>(dir: string, fallbackDir: string, fn: () => Promise<T>): Promise<T> {
  const original = Deno.cwd();
  Deno.chdir(dir);
  try {
    return await fn();
  } finally {
    try {
      Deno.chdir(original);
    } catch {
      Deno.chdir(fallbackDir);
    }
  }
}

/**
 * How many repos the picker's overview chart lists: up to 10, or 5 on short
 * terminals (under 30 rows) so the item list keeps enough room.
 */
function overviewChartRows(io?: TerminalIO): number {
  let rows = 24;
  try {
    rows = io?.getRows?.() ?? Deno.consoleSize().rows;
  } catch {
    // Not a terminal — keep the default
  }
  return rows >= 30 ? 10 : 5;
}

/**
 * Scan repositories one at a time (git commands run against the current
 * directory; each scan is internally parallel). A repo that fails to scan
 * is reported and yields null.
 *
 * @param warn Print a warning for repos that fail to scan
 */
async function scanRepos(
  repos: RegisteredRepo[],
  startDir: string,
  withSize: boolean,
  warn: boolean
): Promise<(RepoStats | null)[]> {
  const names = buildRepoDisplayNames(repos);
  const results: (RepoStats | null)[] = [];
  for (let i = 0; i < repos.length; i++) {
    try {
      results.push(
        await withCwd(repos[i].path, startDir, async () => {
          const settings = await loadRepoCleanSettings(repos[i].path);
          return collectRepoStats(names[i], repos[i].path, settings, withSize);
        })
      );
    } catch (error) {
      if (warn) {
        const msg = error instanceof Error ? error.message : String(error);
        output.warning(`Skipping ${names[i]}: ${msg}`);
      }
      results.push(null);
    }
  }
  return results;
}

/**
 * Execute interactive clean across all registered repositories
 *
 * @param io Optional terminal I/O for the picker (injected by tests)
 * @param withSize Measure worktree disk usage (slow on large repos)
 */
export async function executeInteractiveCleanAll(io?: TerminalIO, withSize = false): Promise<void> {
  const repos = await loadReposForCleanAll(false);
  const startDir = Deno.cwd();

  output.info(
    `Scanning ${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'}${withSize ? ' (measuring disk usage)' : ''}...`
  );

  const scanned = await scanRepos(repos, startDir, withSize, true);
  const sections: SelectSection[] = [];
  scanned.forEach((stats, i) => {
    if (!stats) return;
    sections.push(
      ...sectionsFromStats(stats, {
        titlePrefix: `${stats.name} › `,
        valuePrefix: `${i}:`,
        withCategories: true,
      })
    );
  });

  if (sections.length === 0) {
    output.success('Nothing to clean');
    Deno.exit(0);
  }

  const result = await multiSelect(
    {
      message: 'Select items to clean across all repositories:',
      sections,
      selectAllLabel: 'Select all (every repository)',
      headerLines: renderOverviewChart(
        scanned.filter((s): s is RepoStats => s !== null),
        overviewChartRows(io)
      ),
      warningBanner: 'Selected items will be force-deleted. ' + 'This may result in data loss.',
    },
    io
  );

  if (result.cancelled || result.selected.length === 0) {
    console.log('\nCancelled.\n');
    Deno.exit(0);
  }

  // Group selections by repo index ("<i>:<type>:<target>")
  const byRepo = new Map<number, string[]>();
  for (const value of result.selected) {
    const sep = value.indexOf(':');
    const index = Number(value.slice(0, sep));
    const list = byRepo.get(index) ?? [];
    list.push(value.slice(sep + 1));
    byRepo.set(index, list);
  }

  // Navigate to the owning repo's root if the current directory is about to be removed
  let navigatedToRoot = false;
  let homeDir = startDir;
  for (const [index, values] of byRepo) {
    const paths = values.filter((v) => v.startsWith('worktree:')).map((v) => v.slice('worktree:'.length));
    if (paths.some((p) => isPathInside(startDir, p))) {
      homeDir = scanned[index]!.path;
      try {
        Deno.chdir(homeDir);
        await signalNavigation(homeDir);
        navigatedToRoot = true;
      } catch {
        // Continue anyway — removal runs from each repo's root
      }
    }
  }

  console.log(`Removing ${result.selected.length} item(s)...\n`);
  const totals = { removedWorktrees: 0, removedBranches: 0, failed: 0 };
  for (const [index, values] of [...byRepo].sort(([a], [b]) => a - b)) {
    const stats = scanned[index]!;
    console.log(output.bold(stats.name));
    const results = await withCwd(stats.path, homeDir, () => removeSelectedItems(values, stats.worktrees));
    const repoTotals = reportRemovalResults(results);
    totals.removedWorktrees += repoTotals.removedWorktrees;
    totals.removedBranches += repoTotals.removedBranches;
    totals.failed += repoTotals.failed;
  }

  printInteractiveSummary(totals, navigatedToRoot);
}

/**
 * Analyze the repository in the current directory for auto mode: which
 * worktrees are safe to remove and which are skipped by safety checks.
 */
async function analyzeAutoClean(
  parsed: CleanArgs,
  settings: RepoCleanSettings
): Promise<{ pruneFailed: boolean; candidates: number; toClean: CleanableWorktree[]; toSkip: CleanableWorktree[] }> {
  // Prune stale worktree metadata before listing
  // This ensures we only see worktrees that actually exist on disk
  let pruneFailed = false;
  try {
    await pruneWorktrees(true); // silent = true
  } catch {
    // Don't fail the entire command if prune fails
    // Just continue with whatever worktrees git can list
    pruneFailed = true;
  }

  // Get all worktrees (NOW ONLY SHOWS REAL WORKTREES)
  const worktrees = await listWorktrees();
  const repoRoot = await findGitRoot();

  // Filter out bare repository and protected branches
  const nonBareWorktrees = worktrees.filter((wt) => !wt.bare && !isProtectedWorktree(wt, repoRoot, settings));

  // Analyze each worktree in parallel — each needs several git calls, so
  // sequential analysis is slow when there are many worktrees. The pool
  // bounds how many run at once so large repos don't exhaust resources.
  const analyzedOrNull = await mapWithConcurrency(nonBareWorktrees, async (wt): Promise<CleanableWorktree | null> => {
    const ageDays = await getWorktreeAgeDays(wt.path);

    // Skip if not old enough (only when using threshold)
    if (parsed.useThreshold && ageDays < settings.cleanThreshold) {
      return null;
    }

    const [hasUncommitted, hasUnpushed] = await Promise.all([
      hasUncommittedChanges(wt.path),
      hasUnpushedCommits(wt.path),
    ]);

    let canClean = true;
    let reason: string | undefined;

    if (!parsed.force) {
      if (hasUncommitted) {
        canClean = false;
        reason = 'has uncommitted changes';
      } else if (hasUnpushed) {
        canClean = false;
        reason = 'has unpushed commits';
      }
    }

    return {
      ...wt,
      ageDays,
      hasUncommitted,
      hasUnpushed,
      canClean,
      reason,
    };
  });

  const analyzed: CleanableWorktree[] = analyzedOrNull.filter((wt): wt is CleanableWorktree => wt !== null);

  return {
    pruneFailed,
    candidates: nonBareWorktrees.length,
    toClean: analyzed.filter((wt) => wt.canClean),
    toSkip: analyzed.filter((wt) => !wt.canClean),
  };
}

/**
 * JSON shape of auto-mode results for one repository
 */
function toAutoCleanJson(toClean: CleanableWorktree[], toSkip: CleanableWorktree[]) {
  return {
    cleanable: toClean.map((wt) => ({
      branch: wt.branch,
      path: wt.path,
      ageDays: wt.ageDays,
      hasUncommitted: wt.hasUncommitted,
      hasUnpushed: wt.hasUnpushed,
    })),
    skipped: toSkip.map((wt) => ({
      branch: wt.branch,
      path: wt.path,
      ageDays: wt.ageDays,
      reason: wt.reason || 'unknown',
    })),
  };
}

/**
 * Print the list of worktrees auto mode would remove
 */
function printAutoCleanable(toClean: CleanableWorktree[], indent = '  '): void {
  for (const wt of toClean) {
    const statusFlags = [];
    if (wt.hasUncommitted) statusFlags.push(output.dim('uncommitted'));
    if (wt.hasUnpushed) statusFlags.push(output.dim('unpushed'));
    const status = statusFlags.length > 0 ? ` ${output.dim('[')}${statusFlags.join(', ')}${output.dim(']')}` : '';

    console.log(
      `${indent}${output.errorSymbol()} ${output.path(wt.branch || wt.path)} (${wt.ageDays} days old)${status}`
    );
  }
}

/**
 * Remove worktrees in parallel and print the per-worktree results.
 *
 * Worktree removals are independent, so running them concurrently is much
 * faster when cleaning many at once. Results are collected and printed in
 * order afterwards to keep output readable despite the concurrent execution.
 */
async function removeAutoCleanWorktrees(
  toClean: CleanableWorktree[],
  force: boolean,
  indent = '  '
): Promise<{ successful: number; failed: number }> {
  const results: {
    worktree: CleanableWorktree;
    success: boolean;
    error?: string;
  }[] = await mapWithConcurrency(toClean, async (wt) => {
    try {
      await removeWorktree(wt.path, force);
      return { worktree: wt, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { worktree: wt, success: false, error: message };
    }
  });

  for (const r of results) {
    if (r.success) {
      console.log(`${indent}${output.checkmark()} Removed ${output.path(r.worktree.branch || r.worktree.path)}`);
    } else {
      console.log(
        `${indent}${output.errorSymbol()} Failed ${output.path(r.worktree.branch || r.worktree.path)}: ${output.dim(r.error || '')}`
      );
    }
  }

  return {
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}

/**
 * Silently prune orphan branches in the current repository
 * @returns Number of branches deleted (0 on failure)
 */
async function pruneOrphansQuietly(defaultBranch: string): Promise<number> {
  try {
    return await pruneOrphanBranches(defaultBranch);
  } catch {
    // Don't fail clean if orphan branch pruning fails
    return 0;
  }
}

/**
 * Execute auto mode across all registered repositories
 */
async function executeAutoCleanAll(parsed: CleanArgs): Promise<void> {
  const repos = await loadReposForCleanAll(parsed.json);
  const names = buildRepoDisplayNames(repos);
  const startDir = Deno.cwd();

  if (!parsed.json) {
    const what = parsed.useThreshold ? 'old safe worktrees' : 'safe worktrees';
    output.info(`Checking ${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'} for ${what} to clean...`);
  }

  // git commands run against the current directory, so repos are analyzed
  // one at a time (each analysis is internally parallel).
  const analyses: {
    index: number;
    settings: RepoCleanSettings;
    toClean: CleanableWorktree[];
    toSkip: CleanableWorktree[];
  }[] = [];
  for (let i = 0; i < repos.length; i++) {
    try {
      const analysis = await withCwd(repos[i].path, startDir, async () => {
        const settings = await loadRepoCleanSettings(repos[i].path);
        return { settings, ...(await analyzeAutoClean(parsed, settings)) };
      });
      analyses.push({ index: i, settings: analysis.settings, toClean: analysis.toClean, toSkip: analysis.toSkip });
    } catch (error) {
      if (!parsed.json) {
        const msg = error instanceof Error ? error.message : String(error);
        output.warning(`Skipping ${names[i]}: ${msg}`);
      }
    }
  }

  // JSON mode - output and exit without prompting
  if (parsed.json) {
    printJson({
      repos: analyses.map((a) => ({
        name: names[a.index],
        path: repos[a.index].path,
        ...toAutoCleanJson(a.toClean, a.toSkip),
      })),
    });
    Deno.exit(0);
  }

  const withWork = analyses.filter((a) => a.toClean.length > 0);
  const withSkips = analyses.filter((a) => a.toSkip.length > 0);
  const totalToClean = withWork.reduce((sum, a) => sum + a.toClean.length, 0);

  console.log();
  if (totalToClean === 0) {
    output.success('No stale worktrees to clean in any repository');
  } else {
    console.log(`${output.bold('Worktrees to remove:')}\n`);
    for (const a of withWork) {
      console.log(`  ${output.bold(names[a.index])}`);
      printAutoCleanable(a.toClean, '    ');
    }
    console.log();
  }

  if (withSkips.length > 0) {
    console.log(`${output.bold('Skipped worktrees:')} (protected by safety checks)\n`);
    for (const a of withSkips) {
      console.log(`  ${output.bold(names[a.index])}`);
      for (const wt of a.toSkip) {
        console.log(
          `    ${output.warningSymbol()} ${output.path(wt.branch || wt.path)} - ${output.dim(wt.reason || 'unknown')}`
        );
      }
    }
    console.log();
    if (totalToClean === 0) {
      console.log(`Use ${output.bold('--force')} to remove these (not recommended)\n`);
    }
  }

  if (totalToClean === 0) {
    Deno.exit(0);
  }

  // Dry run - exit early
  if (parsed.dryRun) {
    output.info('Dry run complete - no worktrees were removed');
    Deno.exit(0);
  }

  // Prompt for confirmation (skip with --yes)
  if (!parsed.yes) {
    const confirmed = await confirm(
      `Remove ${totalToClean} worktree(s) across ${withWork.length} repositor${withWork.length === 1 ? 'y' : 'ies'}?`
    );

    if (!confirmed) {
      console.log('\nCancelled.\n');
      Deno.exit(0);
    }
  }

  // Navigate to the owning repo's root if the current directory is about to be removed
  let navigatedToRoot = false;
  let homeDir = startDir;
  const owner = withWork.find((a) => a.toClean.some((wt) => isPathInside(startDir, wt.path)));
  if (owner) {
    homeDir = repos[owner.index].path;
    try {
      Deno.chdir(homeDir);
      await signalNavigation(homeDir);
      navigatedToRoot = true;
    } catch {
      // Continue anyway — removal runs from each repo's root
    }
  }

  console.log(`Removing ${totalToClean} worktree(s)...\n`);
  let successful = 0;
  let failed = 0;
  let prunedOrphans = 0;
  for (const a of withWork) {
    console.log(`  ${output.bold(names[a.index])}`);
    await withCwd(repos[a.index].path, homeDir, async () => {
      const r = await removeAutoCleanWorktrees(a.toClean, parsed.force, '    ');
      successful += r.successful;
      failed += r.failed;
      // Silently prune orphan branches after cleaning worktrees
      if (r.successful > 0) {
        prunedOrphans += await pruneOrphansQuietly(a.settings.defaultBranch);
      }
    });
  }

  console.log();
  if (successful > 0) {
    output.success(`Removed ${successful} worktree(s)`);
  }
  if (failed > 0) {
    output.error(`Failed to remove ${failed} worktree(s)`);
  }
  if (prunedOrphans > 0) {
    output.success(`Pruned ${prunedOrphans} orphan branch(es)`);
  }
  if (navigatedToRoot) {
    output.info('Navigated to git root (removed current worktree)');
  }
}

/**
 * Resolve the repositories `--stats` reports on: every registered repo with
 * --all, otherwise the repository of the current directory.
 */
async function resolveStatsRepos(parsed: CleanArgs): Promise<RegisteredRepo[]> {
  if (parsed.all) {
    return await loadReposForCleanAll(parsed.json);
  }
  return [{ path: await findGitRoot(), addedAt: '' }];
}

/**
 * Execute `gw clean --stats`: report what could be cleaned, remove nothing.
 * With --json, prints a machine-readable report whose item ids can be
 * passed back to `gw clean --remove`.
 */
async function executeCleanStats(parsed: CleanArgs): Promise<void> {
  const repos = await resolveStatsRepos(parsed);
  const startDir = Deno.cwd();

  if (!parsed.json) {
    output.info(
      `Scanning ${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'}${parsed.size ? ' (measuring disk usage)' : ''}...`
    );
  }

  const stats = (await scanRepos(repos, startDir, parsed.size, !parsed.json)).filter((s): s is RepoStats => s !== null);

  if (parsed.json) {
    const sum = (f: (s: RepoStats) => number) => stats.reduce((n, s) => n + f(s), 0);
    printJson({
      repos: stats,
      totals: {
        repos: stats.length,
        worktrees: sum((s) => s.totals.worktrees),
        branches: sum((s) => s.totals.branches),
        orphans: sum((s) => s.totals.orphans),
        removable: sum((s) => s.totals.removable),
        sizeBytes: parsed.size ? sum((s) => s.totals.sizeBytes ?? 0) : null,
      },
    });
    return;
  }

  console.log();
  for (const line of renderOverviewChart(stats, 10)) console.log(line);

  for (const repo of stats) {
    if (repo.totals.removable === 0) continue;
    console.log(`\n${output.bold(repo.name)} ${output.dim(repo.path)}`);
    const row = (label: string, detail: string[], id: string) =>
      console.log(
        `  ${label}${detail.length > 0 ? ' ' + output.dim(`(${detail.join(', ')})`) : ''}  ${output.dim(id)}`
      );
    for (const wt of repo.worktrees.filter((w) => !w.protected)) {
      const detail: string[] = [];
      if (wt.ageDays > 0) detail.push(`${wt.ageDays}d old`);
      if (wt.uncommitted) detail.push('uncommitted');
      if (wt.unpushed) detail.push('unpushed');
      if (wt.sizeBytes !== null) detail.push(formatBytes(wt.sizeBytes));
      row(`worktree ${output.path(wt.branch || wt.path)}`, detail, wt.id);
    }
    for (const b of repo.branches.filter((x) => !x.protected)) {
      row(`branch   ${output.path(b.name)}`, b.lastCommit ? [b.lastCommit] : [], b.id);
    }
    for (const o of repo.orphans.filter((x) => !x.protected)) {
      const detail = o.lastCommit ? [o.lastCommit] : [];
      detail.push(o.unpushed ? 'unpushed' : 'remote gone');
      row(`orphan   ${output.path(o.name)}`, detail, o.id);
    }
  }

  console.log(
    output.dim(`\nRemove items with: gw clean --remove <id> [--remove <id> ...]  (machine-readable: --stats --json)\n`)
  );
}

/** One item resolved from a --remove id */
interface RemovalTarget {
  id: string;
  kind: 'worktree' | 'branch';
  /** Worktree path or branch name */
  target: string;
  label: string;
}

/**
 * Validate --remove ids within the repository of the current directory.
 * Protected items are always refused; worktrees with uncommitted or unpushed
 * work are refused unless --force.
 */
async function planRepoRemovals(
  repoRoot: string,
  items: { id: string; kind: 'worktree' | 'branch'; target: string }[],
  force: boolean
): Promise<{ allowed: RemovalTarget[]; refused: { id: string; reason: string }[] }> {
  const settings = await loadRepoCleanSettings(repoRoot);
  const worktrees = await listWorktrees();
  const branches = new Set(await listLocalBranches());
  const allowed: RemovalTarget[] = [];
  const refused: { id: string; reason: string }[] = [];

  for (const item of items) {
    if (item.kind === 'worktree') {
      const wt = worktrees.find((w) => !w.bare && resolve(w.path) === resolve(item.target));
      if (!wt) {
        refused.push({ id: item.id, reason: 'worktree not found' });
      } else if (isProtectedWorktree(wt, repoRoot, settings)) {
        refused.push({ id: item.id, reason: 'protected branch' });
      } else if (!force && (await hasUncommittedChanges(wt.path))) {
        refused.push({ id: item.id, reason: 'has uncommitted changes (use --force)' });
      } else if (!force && (await hasUnpushedCommits(wt.path))) {
        refused.push({ id: item.id, reason: 'has unpushed commits (use --force)' });
      } else {
        allowed.push({ id: item.id, kind: 'worktree', target: wt.path, label: wt.branch || wt.path });
      }
    } else {
      const holder = worktrees.find((w) => w.branch === item.target);
      if (!branches.has(item.target)) {
        refused.push({ id: item.id, reason: 'branch not found' });
      } else if (isEffectivelyProtected(item.target, settings.defaultBranch, settings.userProtected)) {
        refused.push({ id: item.id, reason: 'protected branch' });
      } else if (holder) {
        refused.push({ id: item.id, reason: `checked out in worktree ${holder.path}` });
      } else {
        allowed.push({ id: item.id, kind: 'branch', target: item.target, label: item.target });
      }
    }
  }

  return { allowed, refused };
}

/**
 * Execute `gw clean --remove <id> ...`: remove exactly the given items (ids
 * from `gw clean --stats --json`), across any registered repositories.
 * Exits 1 when any item was refused or failed.
 */
async function executeRemoveItems(parsed: CleanArgs): Promise<void> {
  const startDir = Deno.cwd();
  const refused: { id: string; reason: string }[] = [];
  const byRepo = new Map<string, { id: string; kind: 'worktree' | 'branch'; target: string }[]>();

  // Group ids by repository root
  for (const id of new Set(parsed.remove)) {
    const parsedId = parseItemId(id);
    if (!parsedId) {
      refused.push({ id, reason: 'invalid id (expected wt:<path> or br:<repo>:<branch>)' });
      continue;
    }
    const probe = parsedId.kind === 'worktree' ? parsedId.path : parsedId.repoPath;
    let root: string;
    try {
      if (!(await pathExists(probe))) throw new Error('missing');
      root = await findGitRoot(probe);
    } catch {
      refused.push({ id, reason: `${parsedId.kind === 'worktree' ? 'worktree' : 'repository'} not found` });
      continue;
    }
    const list = byRepo.get(root) ?? [];
    list.push(
      parsedId.kind === 'worktree'
        ? { id, kind: 'worktree', target: parsedId.path }
        : { id, kind: 'branch', target: parsedId.branch }
    );
    byRepo.set(root, list);
  }

  const plans: { root: string; allowed: RemovalTarget[] }[] = [];
  for (const [root, items] of byRepo) {
    const plan = await withCwd(root, startDir, () => planRepoRemovals(root, items, parsed.force));
    plans.push({ root, allowed: plan.allowed });
    refused.push(...plan.refused);
  }
  const total = plans.reduce((n, p) => n + p.allowed.length, 0);

  const report = (removed: string[], failed: { id: string; error: string }[]) => {
    if (parsed.json) {
      printJson({ dryRun: parsed.dryRun, removed, refused, failed });
    }
    if (refused.length > 0 || failed.length > 0) Deno.exit(1);
  };

  if (!parsed.json) {
    for (const p of plans) {
      if (p.allowed.length === 0) continue;
      console.log(output.bold(getRepoDisplayName(p.root)));
      for (const t of p.allowed) console.log(`  ${output.errorSymbol()} ${t.kind} ${output.path(t.label)}`);
    }
    for (const r of refused) {
      console.log(`  ${output.warningSymbol()} ${r.id} ${output.dim(`- refused: ${r.reason}`)}`);
    }
  }

  if (parsed.dryRun || total === 0) {
    if (!parsed.json) output.info(parsed.dryRun ? 'Dry run - nothing was removed' : 'Nothing to remove');
    report(parsed.dryRun ? plans.flatMap((p) => p.allowed.map((t) => t.id)) : [], []);
    return;
  }

  if (!parsed.yes) {
    if (parsed.json) {
      throw new Error('--remove with --json needs --yes to confirm (or --dry-run to preview)');
    }
    if (!(await confirm(`Remove ${total} item(s)?`))) {
      console.log('\nCancelled.\n');
      Deno.exit(0);
    }
  }

  // Navigate to the owning repo's root if the current directory is about to be removed
  let homeDir = startDir;
  const owner = plans.find((p) => p.allowed.some((t) => t.kind === 'worktree' && isPathInside(startDir, t.target)));
  if (owner) {
    homeDir = owner.root;
    try {
      Deno.chdir(homeDir);
      await signalNavigation(homeDir);
    } catch {
      // Continue anyway — removal runs from each repo's root
    }
  }

  const removed: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const p of plans) {
    await withCwd(p.root, homeDir, async () => {
      // Worktrees first, so their branches are free to delete afterwards
      for (const t of [...p.allowed].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'worktree' ? -1 : 1))) {
        try {
          if (t.kind === 'worktree') {
            await removeWorktree(t.target, parsed.force);
          } else {
            await deleteBranch(t.target, parsed.force);
          }
          removed.push(t.id);
          if (!parsed.json) console.log(`  ${output.checkmark()} Removed ${t.kind} ${output.path(t.label)}`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          failed.push({ id: t.id, error: msg });
          if (!parsed.json)
            console.log(`  ${output.errorSymbol()} Failed ${t.kind} ${output.path(t.label)}: ${output.dim(msg)}`);
        }
      }
    });
  }

  if (!parsed.json) {
    console.log();
    if (removed.length > 0) output.success(`Removed ${removed.length} item(s)`);
    if (failed.length > 0) output.error(`Failed to remove ${failed.length} item(s)`);
  }
  report(removed, failed);
}

/**
 * Execute the clean command
 */
export async function executeClean(args: string[]): Promise<void> {
  const parsed = parseCleanArgs(args);

  if (parsed.help) {
    showCleanHelp();
    Deno.exit(0);
  }

  // Multi-repo JSON modes: keep stdout pure JSON by sending every other
  // console.log (config warnings, migration notices) to stderr.
  if (parsed.json && (parsed.all || parsed.stats || parsed.remove.length > 0)) {
    const stdoutLog = console.log;
    printJson = (value) => stdoutLog(JSON.stringify(value));
    console.log = console.error;
    try {
      await runClean(parsed);
    } finally {
      console.log = stdoutLog;
      printJson = (value) => console.log(JSON.stringify(value));
    }
    return;
  }

  await runClean(parsed);
}

/**
 * Dispatch a parsed clean invocation to its mode
 */
async function runClean(parsed: CleanArgs): Promise<void> {
  if (parsed.remove.length > 0) {
    await executeRemoveItems(parsed);
    return;
  }

  if (parsed.stats) {
    await executeCleanStats(parsed);
    return;
  }

  if (parsed.all) {
    if (parsed.auto) {
      await executeAutoCleanAll(parsed);
    } else {
      await executeInteractiveCleanAll(undefined, parsed.size);
    }
    return;
  }

  // Interactive mode is the default — auto mode is opt-in
  if (!parsed.auto) {
    await executeInteractiveClean(parsed.size);
    return;
  }

  // Load config
  const { config } = await loadConfig();
  const threshold = config.cleanThreshold ?? 7;

  // Suppress output in JSON mode
  if (!parsed.json) {
    if (parsed.useThreshold) {
      output.info(`Checking for worktrees older than ${threshold} days...`);
    } else {
      output.info(`Checking for safe worktrees to clean...`);
    }
  }

  // protectedBranches comes from the canonical git-root config — see protect.ts.
  const defaultBranch = config.defaultBranch || 'main';
  const userProtectedAuto = await loadProtectedBranches();
  const { pruneFailed, candidates, toClean, toSkip } = await analyzeAutoClean(parsed, {
    defaultBranch,
    userProtected: userProtectedAuto,
    cleanThreshold: threshold,
  });

  if (pruneFailed && !parsed.json) {
    console.error(output.dim('Warning: Failed to prune worktree metadata'));
  }

  if (candidates === 0) {
    if (parsed.json) {
      console.log(JSON.stringify({ cleanable: [], skipped: [] }));
      Deno.exit(0);
    }
    console.log('No worktrees found.\n');
    Deno.exit(0);
  }

  if (!parsed.json) {
    console.log(`Found ${candidates} worktree(s)\n`);
  }

  // JSON mode - output and exit without prompting
  if (parsed.json) {
    console.log(JSON.stringify(toAutoCleanJson(toClean, toSkip)));
    Deno.exit(0);
  }

  // Display results
  if (toClean.length === 0) {
    output.success('No stale worktrees to clean');

    if (toSkip.length > 0) {
      console.log(`\n${output.bold('Skipped worktrees:')} (protected by safety checks)\n`);
      for (const wt of toSkip) {
        console.log(`  ${output.warningSymbol()} ${output.path(wt.branch || wt.path)}`);
        console.log(`    Age: ${wt.ageDays} days`);
        console.log(`    Reason: ${output.dim(wt.reason || 'unknown')}`);
        console.log();
      }
      console.log(`Use ${output.bold('--force')} to remove these (not recommended)\n`);
    }

    Deno.exit(0);
  }

  // Display cleanable worktrees
  console.log(`${output.bold('Worktrees to remove:')}\n`);
  printAutoCleanable(toClean);
  console.log();

  if (toSkip.length > 0) {
    console.log(`${output.bold('Skipped worktrees:')}\n`);
    for (const wt of toSkip) {
      console.log(
        `  ${output.warningSymbol()} ${output.path(wt.branch || wt.path)} - ${output.dim(wt.reason || 'unknown')}`
      );
    }
    console.log();
  }

  // Dry run - exit early
  if (parsed.dryRun) {
    output.info('Dry run complete - no worktrees were removed');
    Deno.exit(0);
  }

  // Prompt for confirmation (skip with --yes)
  if (!parsed.yes) {
    const confirmed = await confirm(`Remove ${toClean.length} worktree(s)?`);

    if (!confirmed) {
      console.log('\nCancelled.\n');
      Deno.exit(0);
    }
  }

  // Navigate away if removing current worktree
  const navigatedToRoot = await navigateAwayIfNeeded(toClean.map((wt) => wt.path));

  console.log(`Removing ${toClean.length} worktree(s)...\n`);
  const { successful, failed } = await removeAutoCleanWorktrees(toClean, parsed.force);

  // Summary
  console.log();
  if (successful > 0) {
    output.success(`Removed ${successful} worktree(s)`);
  }
  if (failed > 0) {
    output.error(`Failed to remove ${failed} worktree(s)`);
  }

  // Silently prune orphan branches after cleaning worktrees
  if (successful > 0) {
    const deleted = await pruneOrphansQuietly(defaultBranch);
    if (deleted > 0) {
      output.success(`Pruned ${deleted} orphan branch(es)`);
    }
  }

  if (navigatedToRoot) {
    output.info('Navigated to git root (removed current worktree)');
  }
}
