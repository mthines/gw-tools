/**
 * Clean command implementation
 * Remove stale worktrees based on age threshold
 */

import { loadConfig } from '../lib/config.ts';
import {
  getWorktreeAgeDays,
  hasUncommittedChanges,
  hasUnpushedCommits,
  listWorktrees,
  pruneWorktrees,
  removeWorktree,
  type WorktreeInfo,
} from '../lib/git-utils.ts';
import * as output from '../lib/output.ts';

/**
 * Parse clean command arguments
 */
function parseCleanArgs(args: string[]): {
  help: boolean;
  force: boolean;
  dryRun: boolean;
  useThreshold: boolean;
} {
  return {
    help: args.includes('--help') || args.includes('-h'),
    force: args.includes('--force') || args.includes('-f'),
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    useThreshold: args.includes('--use-autoclean-threshold'),
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
  --use-autoclean-threshold  Only remove worktrees older than configured threshold
  -f, --force                Skip safety checks (uncommitted changes, unpushed commits)
                             WARNING: This may result in data loss
  -n, --dry-run              Preview what would be removed without actually removing
  -h, --help                 Show this help message

Safety Features:
  - By default, only removes worktrees with NO uncommitted changes
  - By default, only removes worktrees with NO unpushed commits
  - Always prompts for confirmation before deletion (unless --dry-run)
  - Main/bare repository, default branch, and gw_root are never removed
  - Use --force to bypass safety checks (use with caution)

Examples:
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
 * Execute the clean command
 */
export async function executeClean(args: string[]): Promise<void> {
  const parsed = parseCleanArgs(args);

  if (parsed.help) {
    showCleanHelp();
    Deno.exit(0);
  }

  // Load config
  const { config } = await loadConfig();
  const threshold = config.cleanThreshold ?? 7;

  if (parsed.useThreshold) {
    output.info(`Checking for worktrees older than ${threshold} days...`);
  } else {
    output.info(`Checking for safe worktrees to clean...`);
  }

  // Prune stale worktree metadata before listing
  // This ensures we only see worktrees that actually exist on disk
  try {
    await pruneWorktrees(true); // silent = true
  } catch (error) {
    // Don't fail the entire command if prune fails
    // Just continue with whatever worktrees git can list
    console.error(output.dim('Warning: Failed to prune worktree metadata'));
  }

  // Get all worktrees (NOW ONLY SHOWS REAL WORKTREES)
  const worktrees = await listWorktrees();

  // Filter out bare repository, default branch, and gw_root
  const defaultBranch = config.defaultBranch || 'main';
  const nonBareWorktrees = worktrees.filter(
    (wt) => !wt.bare && wt.branch !== defaultBranch && wt.branch !== 'gw_root'
  );

  if (nonBareWorktrees.length === 0) {
    console.log('No worktrees found.\n');
    Deno.exit(0);
  }

  console.log(`Found ${nonBareWorktrees.length} worktree(s)\n`);

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

  // Prompt for confirmation
  const confirmed = await confirm(`Remove ${toClean.length} worktree(s)?`);

  if (!confirmed) {
    console.log('\nCancelled.\n');
    Deno.exit(0);
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
}
