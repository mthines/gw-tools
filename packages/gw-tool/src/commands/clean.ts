/**
 * Clean command implementation
 * Remove stale worktrees based on age threshold
 */

import { isProtectedBranch } from '../lib/branch-protection.ts';
import { loadConfig } from '../lib/config.ts';
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
  interactive: boolean;
} {
  return {
    help: args.includes('--help') || args.includes('-h'),
    force: args.includes('--force') || args.includes('-f'),
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    useThreshold: args.includes('--use-autoclean-threshold'),
    json: args.includes('--json'),
    yes: args.includes('--yes') || args.includes('-y'),
    interactive: args.includes('--interactive') || args.includes('-i'),
  };
}

/**
 * Show help for the clean command
 */
function showCleanHelp(): void {
  console.log(`Usage: gw clean [options]

Remove safe worktrees with no uncommitted changes or unpushed commits.

By default, removes ALL safe worktrees regardless of age. Use
--use-autoclean-threshold to only remove worktrees older than the configured
age threshold (.gw/config.json cleanThreshold field, default: 7 days).

Automatically prunes stale worktree metadata before listing, ensuring only
worktrees that actually exist on disk are shown.

Options:
  -i, --interactive          Interactive mode: select worktrees, branches, and
                             orphans to remove using a multi-select checklist
                             WARNING: Uses --force deletion for selected items
  --use-autoclean-threshold  Only remove worktrees older than configured threshold
  -f, --force                Skip safety checks (uncommitted changes, unpushed commits)
                             WARNING: This may result in data loss
  -n, --dry-run              Preview what would be removed without actually removing
  --json                     Output results as JSON and exit (implies --dry-run)
  -y, --yes                  Skip confirmation prompt
  -h, --help                 Show this help message

Safety Features:
  - By default, only removes worktrees with NO uncommitted changes
  - By default, only removes worktrees with NO unpushed commits
  - Always prompts for confirmation before deletion (unless --dry-run)
  - Main/bare repository, default branch, and gw_root are never removed
  - After removing worktrees, automatically prunes orphan branches
    (branches with no worktree and no unpushed commits)
  - Use --force to bypass safety checks (use with caution)

Examples:
  # Interactive mode: pick exactly what to remove
  gw clean --interactive

  # Preview all safe worktrees (default behavior)
  gw clean --dry-run

  # Remove all safe worktrees regardless of age
  gw clean

  # Only remove worktrees older than configured threshold
  gw clean --use-autoclean-threshold

  # Preview old worktrees with threshold check
  gw clean --use-autoclean-threshold --dry-run

  # Force remove all worktrees without safety checks (dangerous!)
  gw clean --force

  # Configure threshold during init (used by --use-autoclean-threshold)
  gw init --clean-threshold 14

Comparison:
  gw clean                         - Removes ALL safe worktrees
  gw clean --use-autoclean-threshold - Removes only OLD safe worktrees
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
  const worktreeItems: SelectItem[] = [];
  for (const wt of worktrees) {
    if (wt.bare) continue;

    const isDefault = wt.branch === defaultBranch;
    const isGwRoot = wt.branch === 'gw_root';

    if (isDefault) {
      worktreeItems.push({
        label: wt.branch || wt.path,
        value: `worktree:${wt.path}`,
        disabled: true,
        disabledReason: 'default branch - cannot remove',
      });
      continue;
    }

    if (isGwRoot) {
      worktreeItems.push({
        label: wt.branch || wt.path,
        value: `worktree:${wt.path}`,
        disabled: true,
        disabledReason: 'gw_root - cannot remove',
      });
      continue;
    }

    const ageDays = await getWorktreeAgeDays(wt.path);
    const hasUncommitted = await hasUncommittedChanges(wt.path);
    const hasUnpushed = await hasUnpushedCommits(wt.path);

    const hints: string[] = [];
    if (ageDays > 0) hints.push(`${ageDays}d old`);
    if (hasUncommitted) hints.push('uncommitted');
    if (hasUnpushed) hints.push('unpushed');
    const hint = hints.length > 0 ? `(${hints.join(', ')})` : '';

    worktreeItems.push({
      label: wt.branch || wt.path,
      value: `worktree:${wt.path}`,
      hint,
    });
  }

  // ── Build Local Branches section (no worktree) ────────
  const branchItems: SelectItem[] = [];
  for (const branch of allBranches) {
    // Skip branches that have an active worktree
    if (worktreeBranches.has(branch)) continue;

    const isDefault = branch === defaultBranch;
    const isGwRoot = branch === 'gw_root';

    if (isDefault) {
      branchItems.push({
        label: branch,
        value: `branch:${branch}`,
        disabled: true,
        disabledReason: 'default branch - cannot remove',
      });
      continue;
    }

    if (isGwRoot) {
      branchItems.push({
        label: branch,
        value: `branch:${branch}`,
        disabled: true,
        disabledReason: 'gw_root - cannot remove',
      });
      continue;
    }

    const date = await getBranchLastCommitDate(branch);
    const hint = date ? `(${date})` : '';

    branchItems.push({
      label: branch,
      value: `branch:${branch}`,
      hint,
    });
  }

  // ── Build Orphan Branches section ─────────────────────
  const orphans = await findOrphanBranches(worktrees, defaultBranch);
  const orphanNames = new Set(orphans.map((o) => o.name));
  const orphanItems: SelectItem[] = await Promise.all(
    orphans.map(async (o) => {
      const date = await getBranchLastCommitDate(o.name);
      const parts: string[] = [];
      if (date) parts.push(date);
      parts.push(o.hasUnpushed ? 'unpushed' : 'remote gone');
      return {
        label: o.name,
        value: `orphan:${o.name}`,
        hint: `(${parts.join(', ')})`,
      };
    })
  );

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

  // ── Process selections ────────────────────────────────
  console.log();
  let removedWorktrees = 0;
  let removedBranches = 0;
  let failed = 0;

  for (const value of result.selected) {
    const [type, ...rest] = value.split(':');
    const target = rest.join(':');

    if (type === 'worktree') {
      try {
        const wt = worktrees.find((w) => w.path === target);
        const label = wt?.branch || target;
        console.log(`Removing worktree ${output.path(label)}...`);
        await removeWorktree(target, true); // force
        console.log(`  ${output.checkmark()} Removed\n`);
        removedWorktrees++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  ${output.errorSymbol()} Failed: ${output.dim(msg)}\n`);
        failed++;
      }
    } else if (type === 'branch' || type === 'orphan') {
      try {
        console.log(`Deleting branch ${output.path(target)}...`);
        await deleteBranch(target, true); // force
        console.log(`  ${output.checkmark()} Deleted\n`);
        removedBranches++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  ${output.errorSymbol()} Failed: ${output.dim(msg)}\n`);
        failed++;
      }
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

  // Interactive mode - early return
  if (parsed.interactive) {
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

  // Filter out bare repository and protected branches
  const defaultBranch = config.defaultBranch || 'main';
  const nonBareWorktrees = worktrees.filter((wt) => !wt.bare && !isProtectedBranch(wt.branch, defaultBranch));

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

  // Analyze each worktree
  const analyzed: CleanableWorktree[] = [];

  for (const wt of nonBareWorktrees) {
    const ageDays = await getWorktreeAgeDays(wt.path);

    // Skip if not old enough (only when using threshold)
    if (parsed.useThreshold && ageDays < threshold) {
      continue;
    }

    const hasUncommitted = await hasUncommittedChanges(wt.path);
    const hasUnpushed = await hasUnpushedCommits(wt.path);

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

    analyzed.push({
      ...wt,
      ageDays,
      hasUncommitted,
      hasUnpushed,
      canClean,
      reason,
    });
  }

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

  // Remove worktrees
  console.log();
  const results: {
    worktree: CleanableWorktree;
    success: boolean;
    error?: string;
  }[] = [];

  for (const wt of toClean) {
    try {
      console.log(`Removing ${output.path(wt.branch || wt.path)}...`);
      await removeWorktree(wt.path, parsed.force);
      results.push({ worktree: wt, success: true });
      console.log(`  ${output.checkmark()} Removed\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ worktree: wt, success: false, error: message });
      console.log(`  ${output.errorSymbol()} Failed: ${output.dim(message)}\n`);
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
}
