/**
 * Clean command implementation
 * Remove stale worktrees based on age threshold
 */

import { resolve } from '@std/path';
import { isProtectedBranch } from '../lib/branch-protection.ts';
import { loadConfig, loadProtectedBranches } from '../lib/config.ts';
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
import { multiSelect, type SelectItem, type SelectSection } from '../lib/interactive-select.ts';
import * as output from '../lib/output.ts';
import { signalNavigation } from '../lib/shell-navigation.ts';

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
 * Parse clean command arguments
 */
function parseCleanArgs(args: string[]): {
  help: boolean;
  force: boolean;
  dryRun: boolean;
  useThreshold: boolean;
  json: boolean;
  yes: boolean;
  auto: boolean;
} {
  return {
    help: args.includes('--help') || args.includes('-h'),
    force: args.includes('--force') || args.includes('-f'),
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    useThreshold: args.includes('--use-autoclean-threshold'),
    json: args.includes('--json'),
    yes: args.includes('--yes') || args.includes('-y'),
    auto: args.includes('--auto') || args.includes('-a'),
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

Examples:
  # Interactive mode (default): pick exactly what to remove
  gw clean

  # Auto mode: remove all safe worktrees regardless of age
  gw clean --auto

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
          value: `worktree:${wt.path}`,
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
        value: `worktree:${wt.path}`,
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
          value: `branch:${branch}`,
          disabled: true,
          disabledReason: 'protected branch - cannot remove',
        };
      }

      const date = await getBranchLastCommitDate(branch);
      const hint = date ? `(${date})` : '';

      return {
        label: branch,
        value: `branch:${branch}`,
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
        value: `orphan:${o.name}`,
        disabled: true,
        disabledReason: 'protected branch - cannot remove',
      };
    }

    return {
      label: o.name,
      value: `orphan:${o.name}`,
      hint: `(${parts.join(', ')})`,
    };
  });

  // Filter out branches that already appear in the orphans section
  const filteredBranchItems = branchItems.filter((item) => !orphanNames.has(item.label));

  // ── Build sections (only include non-empty ones) ──────
  const sections: SelectSection[] = [];
  if (worktreeItems.length > 0) {
    sections.push({
      title: 'Worktrees',
      items: worktreeItems,
    });
  }
  if (filteredBranchItems.length > 0) {
    sections.push({
      title: 'Local Branches (no worktree)',
      items: filteredBranchItems,
    });
  }
  if (orphanItems.length > 0) {
    sections.push({
      title: 'Orphan Branches',
      items: orphanItems,
    });
  }

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
  // Selected items are independent (branches with an active worktree are
  // excluded from the branch/orphan sections), so removals run in parallel.
  // Results are collected and printed in order afterwards to keep output
  // readable despite the concurrent execution.
  console.log(`Removing ${result.selected.length} item(s)...\n`);
  let removedWorktrees = 0;
  let removedBranches = 0;
  let failed = 0;

  const removalResults = await mapWithConcurrency(result.selected, async (value) => {
    const [type, ...rest] = value.split(':');
    const target = rest.join(':');

    if (type === 'worktree') {
      const wt = worktrees.find((w) => w.path === target);
      const label = wt?.branch || target;
      try {
        await removeWorktree(target, true); // force
        return { kind: 'worktree' as const, label, success: true as const };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { kind: 'worktree' as const, label, success: false as const, error: msg };
      }
    }

    // branch or orphan
    try {
      await deleteBranch(target, true); // force
      return { kind: 'branch' as const, label: target, success: true as const };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { kind: 'branch' as const, label: target, success: false as const, error: msg };
    }
  });

  for (const r of removalResults) {
    const verb = r.kind === 'worktree' ? 'worktree' : 'branch';
    if (r.success) {
      console.log(`  ${output.checkmark()} Removed ${verb} ${output.path(r.label)}`);
      if (r.kind === 'worktree') removedWorktrees++;
      else removedBranches++;
    } else {
      console.log(`  ${output.errorSymbol()} Failed ${verb} ${output.path(r.label)}: ${output.dim(r.error)}`);
      failed++;
    }
  }

  // ── Summary ───────────────────────────────────────────
  console.log();
  if (removedWorktrees > 0) {
    output.success(`Removed ${removedWorktrees} worktree(s)`);
  }
  if (removedBranches > 0) {
    output.success(`Deleted ${removedBranches} branch(es)`);
  }
  if (failed > 0) {
    output.error(`Failed to remove ${failed} item(s)`);
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

  // Prune stale worktree metadata before listing
  // This ensures we only see worktrees that actually exist on disk
  try {
    await pruneWorktrees(true); // silent = true
  } catch {
    // Don't fail the entire command if prune fails
    // Just continue with whatever worktrees git can list
    if (!parsed.json) {
      console.error(output.dim('Warning: Failed to prune worktree metadata'));
    }
  }

  // Get all worktrees (NOW ONLY SHOWS REAL WORKTREES)
  const worktrees = await listWorktrees();

  // Filter out bare repository and protected branches. protectedBranches
  // comes from the canonical git-root config — see protect.ts.
  const defaultBranch = config.defaultBranch || 'main';
  const userProtectedAuto = await loadProtectedBranches();
  const nonBareWorktrees = worktrees.filter(
    (wt) => !wt.bare && !isEffectivelyProtected(wt.branch, defaultBranch, userProtectedAuto)
  );

  if (nonBareWorktrees.length === 0) {
    if (parsed.json) {
      console.log(JSON.stringify({ cleanable: [], skipped: [] }));
      Deno.exit(0);
    }
    console.log('No worktrees found.\n');
    Deno.exit(0);
  }

  if (!parsed.json) {
    console.log(`Found ${nonBareWorktrees.length} worktree(s)\n`);
  }

  // Analyze each worktree in parallel — each needs several git calls, so
  // sequential analysis is slow when there are many worktrees. The pool
  // bounds how many run at once so large repos don't exhaust resources.
  const analyzedOrNull = await mapWithConcurrency(nonBareWorktrees, async (wt): Promise<CleanableWorktree | null> => {
    const ageDays = await getWorktreeAgeDays(wt.path);

    // Skip if not old enough (only when using threshold)
    if (parsed.useThreshold && ageDays < threshold) {
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

  // Separate cleanable and skipped
  const toClean = analyzed.filter((wt) => wt.canClean);
  const toSkip = analyzed.filter((wt) => !wt.canClean);

  // JSON mode - output and exit without prompting
  if (parsed.json) {
    const jsonOutput = {
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
    console.log(JSON.stringify(jsonOutput));
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
  for (const wt of toClean) {
    const statusFlags = [];
    if (wt.hasUncommitted) statusFlags.push(output.dim('uncommitted'));
    if (wt.hasUnpushed) statusFlags.push(output.dim('unpushed'));
    const status = statusFlags.length > 0 ? ` ${output.dim('[')}${statusFlags.join(', ')}${output.dim(']')}` : '';

    console.log(`  ${output.errorSymbol()} ${output.path(wt.branch || wt.path)} (${wt.ageDays} days old)${status}`);
  }
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

  // Remove worktrees in parallel — worktree removals are independent, so
  // running them concurrently is much faster when cleaning many at once.
  // Results are collected and printed in order afterwards to keep output
  // readable despite the concurrent execution.
  console.log(`Removing ${toClean.length} worktree(s)...\n`);
  const results: {
    worktree: CleanableWorktree;
    success: boolean;
    error?: string;
  }[] = await mapWithConcurrency(toClean, async (wt) => {
    try {
      await removeWorktree(wt.path, parsed.force);
      return { worktree: wt, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { worktree: wt, success: false, error: message };
    }
  });

  for (const r of results) {
    if (r.success) {
      console.log(`  ${output.checkmark()} Removed ${output.path(r.worktree.branch || r.worktree.path)}`);
    } else {
      console.log(
        `  ${output.errorSymbol()} Failed ${output.path(r.worktree.branch || r.worktree.path)}: ${output.dim(r.error || '')}`
      );
    }
  }

  // Summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log();
  if (successful > 0) {
    output.success(`Removed ${successful} worktree(s)`);
  }
  if (failed > 0) {
    output.error(`Failed to remove ${failed} worktree(s)`);
  }

  // Silently prune orphan branches after cleaning worktrees
  if (successful > 0) {
    try {
      const defaultBranch = config.defaultBranch || 'main';
      const deleted = await pruneOrphanBranches(defaultBranch);
      if (deleted > 0) {
        output.success(`Pruned ${deleted} orphan branch(es)`);
      }
    } catch {
      // Don't fail clean if orphan branch pruning fails
    }
  }

  if (navigatedToRoot) {
    output.info('Navigated to git root (removed current worktree)');
  }
}
