/**
 * Clean command implementation
 * Remove stale worktrees based on age threshold
 */

import { join, resolve } from '@std/path';
import { isProtectedBranch } from '../lib/branch-protection.ts';
import { loadConfig, loadProtectedBranches, loadRootConfig } from '../lib/config.ts';
import { mapWithConcurrency } from '../lib/concurrency.ts';
import {
  deleteBranch,
  findOrphanBranches,
  getBranchLastCommitDate,
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
import { pathExists } from '../lib/path-resolver.ts';
import { getRepoDisplayName, pruneMissingRepos, type RegisteredRepo } from '../lib/repo-registry.ts';
import { signalNavigation } from '../lib/shell-navigation.ts';
import type { Config } from '../lib/types.ts';

/**
 * Check whether a branch is protected by any mechanism — system rules
 * (defaultBranch, main, master, gw_root) or the user-configured list.
 *
 * @param branch The branch name to check
 * @param defaultBranch The configured default branch name
 * @param userProtected Additional branch names the user has explicitly protected
 */
function isEffectivelyProtected(branch: string | undefined, defaultBranch: string, userProtected: string[]): boolean {
  if (isProtectedBranch(branch, defaultBranch)) {
    return true;
  }
  return !!branch && userProtected.includes(branch);
}

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
}

/**
 * Parse clean command arguments
 */
function parseCleanArgs(args: string[]): CleanArgs {
  return {
    help: args.includes('--help') || args.includes('-h'),
    force: args.includes('--force') || args.includes('-f'),
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    useThreshold: args.includes('--use-autoclean-threshold'),
    json: args.includes('--json'),
    yes: args.includes('--yes') || args.includes('-y'),
    auto: args.includes('--auto') || args.includes('-a'),
    all: args.includes('--all'),
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
  -a, --auto                 Auto mode: remove all safe worktrees without
                             interactive selection (previous default behavior)
  --use-autoclean-threshold  Only remove worktrees older than configured threshold
                             (only applies in --auto mode)
  -f, --force                Skip safety checks (uncommitted changes, unpushed commits)
                             WARNING: This may result in data loss
  -n, --dry-run              Preview what would be removed without actually removing
                             (only applies in --auto mode)
  --json                     Output results as JSON and exit (implies --dry-run,
                             only applies in --auto mode)
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
  Branches"). The root "Select all" row selects everything, so you can
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
 * Per-repository settings that decide what clean may touch
 */
interface RepoCleanSettings {
  defaultBranch: string;
  userProtected: string[];
  cleanThreshold: number;
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
 * Scan the repository in the current directory and build the interactive
 * clean sections: worktrees, local branches without a worktree, and orphans.
 */
async function buildCleanSections(
  settings: RepoCleanSettings,
  options: SectionOptions
): Promise<{ sections: SelectSection[]; worktrees: WorktreeInfo[] }> {
  const { defaultBranch, userProtected } = settings;
  const { titlePrefix, valuePrefix, withCategories } = options;

  // Prune stale metadata first
  try {
    await pruneWorktrees(true);
  } catch {
    // Continue if prune fails
  }

  const worktrees = await listWorktrees();
  const allBranches = await listLocalBranches();
  const worktreeBranches = new Set(worktrees.map((wt) => wt.branch).filter(Boolean));

  // ── Build Worktrees section ───────────────────────────
  // Analyze worktrees in parallel — each requires several git calls, so
  // running them sequentially is slow when there are many worktrees. The
  // pool bounds how many run at once so large repos don't exhaust resources.
  const worktreeItems: SelectItem[] = await mapWithConcurrency(
    worktrees.filter((wt) => !wt.bare),
    async (wt): Promise<SelectItem> => {
      if (isEffectivelyProtected(wt.branch, defaultBranch, userProtected)) {
        return {
          label: wt.branch || wt.path,
          value: `${valuePrefix}worktree:${wt.path}`,
          disabled: true,
          disabledReason: 'protected branch - cannot remove',
        };
      }

      const [ageDays, hasUncommitted, hasUnpushed] = await Promise.all([
        getWorktreeAgeDays(wt.path),
        hasUncommittedChanges(wt.path),
        hasUnpushedCommits(wt.path),
      ]);

      const hints: string[] = [];
      if (ageDays > 0) hints.push(`${ageDays}d old`);
      if (hasUncommitted) hints.push('uncommitted');
      if (hasUnpushed) hints.push('unpushed');
      const hint = hints.length > 0 ? `(${hints.join(', ')})` : '';

      return {
        label: wt.branch || wt.path,
        value: `${valuePrefix}worktree:${wt.path}`,
        hint,
      };
    }
  );

  // ── Build Local Branches section (no worktree) ────────
  // Analyze branches in parallel for the same reason as worktrees above.
  const branchItems: SelectItem[] = await mapWithConcurrency(
    // Skip branches that have an active worktree
    allBranches.filter((branch) => !worktreeBranches.has(branch)),
    async (branch): Promise<SelectItem> => {
      if (isEffectivelyProtected(branch, defaultBranch, userProtected)) {
        return {
          label: branch,
          value: `${valuePrefix}branch:${branch}`,
          disabled: true,
          disabledReason: 'protected branch - cannot remove',
        };
      }

      const date = await getBranchLastCommitDate(branch);
      const hint = date ? `(${date})` : '';

      return {
        label: branch,
        value: `${valuePrefix}branch:${branch}`,
        hint,
      };
    }
  );

  // ── Build Orphan Branches section ─────────────────────
  const orphans = await findOrphanBranches(worktrees, defaultBranch);
  const orphanNames = new Set(orphans.map((o) => o.name));
  const orphanItems: SelectItem[] = await mapWithConcurrency(orphans, async (o): Promise<SelectItem> => {
    const date = await getBranchLastCommitDate(o.name);
    const parts: string[] = [];
    if (date) parts.push(date);
    parts.push(o.hasUnpushed ? 'unpushed' : 'remote gone');

    // Defense-in-depth: findOrphanBranches already filters protected
    // branches, but the orphan section is the most destructive code path
    // (force-deletes via -D), so re-assert protection here.
    if (isEffectivelyProtected(o.name, defaultBranch, userProtected)) {
      return {
        label: o.name,
        value: `${valuePrefix}orphan:${o.name}`,
        disabled: true,
        disabledReason: 'protected branch - cannot remove',
      };
    }

    return {
      label: o.name,
      value: `${valuePrefix}orphan:${o.name}`,
      hint: `(${parts.join(', ')})`,
    };
  });

  // Filter out branches that already appear in the orphans section
  const filteredBranchItems = branchItems.filter((item) => !orphanNames.has(item.label));

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
  addSection('Local Branches (no worktree)', 'branches', filteredBranchItems);
  addSection('Orphan Branches', 'orphans', orphanItems);

  return { sections, worktrees };
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
function removeSelectedItems(selected: string[], worktrees: WorktreeInfo[]): Promise<RemovalResult[]> {
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
async function executeInteractiveClean(): Promise<void> {
  const { config } = await loadConfig();
  const defaultBranch = config.defaultBranch || 'main';
  // protectedBranches comes from the canonical git-root config — see
  // protect.ts for the rationale.
  const userProtected = await loadProtectedBranches();

  output.info('Scanning worktrees, branches, and orphans...');

  const { sections, worktrees } = await buildCleanSections(
    { defaultBranch, userProtected, cleanThreshold: config.cleanThreshold ?? 7 },
    { titlePrefix: '', valuePrefix: '', withCategories: false }
  );

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

/**
 * Build display names for registered repos: the directory name, or the
 * full path when two repos share a directory name.
 */
function buildRepoDisplayNames(repos: RegisteredRepo[]): string[] {
  const names = repos.map((r) => getRepoDisplayName(r.path));
  return names.map((name, i) => (names.filter((n) => n === name).length > 1 ? repos[i].path : name));
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
      console.log(JSON.stringify({ repos: [] }));
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
 * Execute interactive clean across all registered repositories
 *
 * @param io Optional terminal I/O for the picker (injected by tests)
 */
export async function executeInteractiveCleanAll(io?: TerminalIO): Promise<void> {
  const repos = await loadReposForCleanAll(false);
  const names = buildRepoDisplayNames(repos);
  const startDir = Deno.cwd();

  output.info(`Scanning ${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'}...`);

  // git commands run against the current directory, so repos are scanned
  // one at a time (each scan is internally parallel).
  const scanned: { repo: RegisteredRepo; worktrees: WorktreeInfo[] }[] = [];
  const sections: SelectSection[] = [];
  for (let i = 0; i < repos.length; i++) {
    try {
      const result = await withCwd(repos[i].path, startDir, async () => {
        const settings = await loadRepoCleanSettings(repos[i].path);
        return buildCleanSections(settings, {
          titlePrefix: `${names[i]} › `,
          valuePrefix: `${i}:`,
          withCategories: true,
        });
      });
      scanned[i] = { repo: repos[i], worktrees: result.worktrees };
      sections.push(...result.sections);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      output.warning(`Skipping ${names[i]}: ${msg}`);
    }
  }

  if (sections.length === 0) {
    output.success('Nothing to clean');
    Deno.exit(0);
  }

  const result = await multiSelect(
    {
      message: 'Select items to clean across all repositories:',
      sections,
      selectAllLabel: 'Select all (every repository)',
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
      homeDir = scanned[index].repo.path;
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
    const { repo, worktrees } = scanned[index];
    console.log(output.bold(names[index]));
    const results = await withCwd(repo.path, homeDir, () => removeSelectedItems(values, worktrees));
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

  // Filter out bare repository and protected branches
  const nonBareWorktrees = worktrees.filter(
    (wt) => !wt.bare && !isEffectivelyProtected(wt.branch, settings.defaultBranch, settings.userProtected)
  );

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
    console.log(
      JSON.stringify({
        repos: analyses.map((a) => ({
          name: names[a.index],
          path: repos[a.index].path,
          ...toAutoCleanJson(a.toClean, a.toSkip),
        })),
      })
    );
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
 * Execute the clean command
 */
export async function executeClean(args: string[]): Promise<void> {
  const parsed = parseCleanArgs(args);

  if (parsed.help) {
    showCleanHelp();
    Deno.exit(0);
  }

  if (parsed.all) {
    if (parsed.auto) {
      await executeAutoCleanAll(parsed);
    } else {
      await executeInteractiveCleanAll();
    }
    return;
  }

  // Interactive mode is the default — auto mode is opt-in
  if (!parsed.auto) {
    await executeInteractiveClean();
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
