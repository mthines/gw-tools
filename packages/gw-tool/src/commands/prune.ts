/**
 * Prune command implementation
 * Cleans up worktree administrative data and removes orphan branches
 *
 * Default behavior: Full cleanup (worktrees + orphan branches)
 * --stale-only: Git passthrough mode (only metadata cleanup)
 * --no-branches: Skip branch cleanup
 */

import { executeGitWorktree } from "../lib/git-proxy.ts";
import { loadConfig } from "../lib/config.ts";
import {
  deleteBranch,
  getCurrentWorktreePath,
  hasBranchUnpushedCommits,
  hasUncommittedChanges,
  hasUnpushedCommits,
  listLocalBranches,
  listWorktrees,
  pruneWorktrees,
  removeWorktree,
  type WorktreeInfo,
} from "../lib/git-utils.ts";
import * as output from "../lib/output.ts";

/**
 * Parsed arguments for prune command
 */
interface PruneArgs {
  help: boolean;
  staleOnly: boolean; // Git passthrough mode (replaces 'clean')
  noBranches: boolean; // Skip branch cleanup
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  gitArgs: string[]; // remaining args to pass to git
}

/**
 * Worktree with metadata for cleaning
 */
interface CleanableWorktree extends WorktreeInfo {
  canClean: boolean;
  reason?: string;
  hasUncommitted: boolean;
  hasUnpushed: boolean;
}

/**
 * Orphan branch info
 */
interface OrphanBranch {
  name: string;
  canDelete: boolean;
  reason?: string;
  hasUnpushed: boolean;
}

/**
 * Parse prune command arguments
 */
function parsePruneArgs(args: string[]): PruneArgs {
  const result: PruneArgs = {
    help: false,
    staleOnly: false,
    noBranches: false,
    dryRun: false,
    force: false,
    verbose: false,
    gitArgs: [],
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--stale-only") {
      result.staleOnly = true;
    } else if (arg === "--no-branches") {
      result.noBranches = true;
    } else if (arg === "--dry-run" || arg === "-n") {
      result.dryRun = true;
    } else if (arg === "--force" || arg === "-f") {
      result.force = true;
    } else if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
    } else {
      // Pass other args to git (only used in stale-only mode)
      result.gitArgs.push(arg);
    }
  }

  return result;
}

/**
 * Show help for the prune command
 */
function showPruneHelp(): void {
  console.log(`Usage: gw prune [options]

Clean up worktrees and orphan branches (full cleanup by default).

DEFAULT MODE (full cleanup):
  Removes worktrees that are safe to delete (no uncommitted changes,
  no unpushed commits) AND deletes orphan branches (branches without
  associated worktrees).

STALE-ONLY MODE (with --stale-only):
  Git passthrough - only cleans up administrative files for deleted
  worktrees. Does not remove worktrees or branches.

Options:
  --stale-only       Git passthrough mode (only metadata cleanup)
  --no-branches      Skip orphan branch cleanup (worktrees only)
  -n, --dry-run      Preview what would be removed without removing
  -f, --force        Skip confirmation prompt
  -v, --verbose      Show detailed output
  -h, --help         Show this help message

Safety Features:
  - Default branch is protected (from .gw/config.json)
  - Current worktree is protected
  - Bare repository is never removed
  - Branches with unpushed commits are protected
  - Confirmation prompt before removal (defaults to yes)

Examples:
  # Full cleanup (default) - removes worktrees AND orphan branches
  gw prune
  gw prune --dry-run         # Preview what would be removed
  gw prune --force           # Skip confirmation
  gw prune --verbose         # Show detailed output

  # Skip branch cleanup
  gw prune --no-branches     # Only clean worktrees

  # Git passthrough (stale-only)
  gw prune --stale-only      # Only clean git metadata

For full git worktree prune documentation:
  git worktree prune --help
`);
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  console.log(`\n${message}`);
  console.log(output.dim("[Y/n]: "));

  const buf = new Uint8Array(1024);
  const n = await Deno.stdin.read(buf);

  if (!n) return true; // Default to yes

  const response = new TextDecoder().decode(buf.subarray(0, n)).trim()
    .toLowerCase();

  // Accept empty string (just enter), yes, y as confirmation
  // Accept no, n as rejection
  if (response === "" || response === "yes" || response === "y") {
    return true;
  }

  return false;
}

/**
 * Run git worktree prune
 */
async function runGitWorktreePrune(verbose: boolean): Promise<void> {
  if (verbose) {
    output.info("Running git worktree prune...");
  }

  await pruneWorktrees(!verbose); // verbose = show output

  if (verbose) {
    output.success("Pruning complete");
  }
}

/**
 * Analyze worktrees to determine which can be cleaned
 */
async function analyzeWorktrees(
  worktrees: WorktreeInfo[],
  options: {
    currentPath: string;
    defaultBranch: string;
  },
): Promise<CleanableWorktree[]> {
  const analyzed: CleanableWorktree[] = [];

  for (const wt of worktrees) {
    // Skip bare repository
    if (wt.bare) {
      continue;
    }

    // Only check if current when we have a currentPath (i.e., we're in a worktree)
    const isCurrent = options.currentPath && wt.path === options.currentPath;
    const isDefaultBranch = wt.branch === options.defaultBranch;
    const isGwRoot = wt.branch === "gw_root";
    const hasUncommitted = await hasUncommittedChanges(wt.path);
    const hasUnpushed = await hasUnpushedCommits(wt.path);

    // Determine if can clean and reason if not
    let canClean = true;
    let reason: string | undefined;

    if (isCurrent) {
      canClean = false;
      reason = "current worktree (cannot remove)";
    } else if (isDefaultBranch) {
      canClean = false;
      reason = "default branch (protected)";
    } else if (isGwRoot) {
      canClean = false;
      reason = "gw_root (protected)";
    } else if (hasUncommitted) {
      canClean = false;
      reason = "has uncommitted changes";
    } else if (hasUnpushed) {
      canClean = false;
      reason = "has unpushed commits";
    }

    analyzed.push({
      ...wt,
      canClean,
      reason,
      hasUncommitted,
      hasUnpushed,
    });
  }

  return analyzed;
}

/**
 * Find orphan branches (branches without worktrees)
 */
async function findOrphanBranches(
  worktrees: WorktreeInfo[],
  defaultBranch: string,
): Promise<OrphanBranch[]> {
  const allBranches = await listLocalBranches();
  const worktreeBranches = new Set(
    worktrees.map((wt) => wt.branch).filter(Boolean),
  );

  const orphans: OrphanBranch[] = [];

  for (const branch of allBranches) {
    // Skip if branch has a worktree
    if (worktreeBranches.has(branch)) {
      continue;
    }

    // Skip protected branches
    if (branch === defaultBranch || branch === "gw_root") {
      continue;
    }

    const hasUnpushed = await hasBranchUnpushedCommits(branch);

    let canDelete = true;
    let reason: string | undefined;

    if (hasUnpushed) {
      canDelete = false;
      reason = "has unpushed commits";
    }

    orphans.push({
      name: branch,
      canDelete,
      reason,
      hasUnpushed,
    });
  }

  return orphans;
}

/**
 * Display worktrees that will be removed
 */
function displayCleanable(worktrees: CleanableWorktree[]): void {
  console.log(`${output.bold("Worktrees to remove:")}\n`);
  for (const wt of worktrees) {
    const statusFlags = [];
    if (wt.hasUncommitted) statusFlags.push(output.dim("uncommitted"));
    if (wt.hasUnpushed) statusFlags.push(output.dim("unpushed"));
    const status = statusFlags.length > 0
      ? ` ${output.dim("[")}${statusFlags.join(", ")}${output.dim("]")}`
      : " [clean]";

    console.log(
      `  ${output.errorSymbol()} ${output.path(wt.branch || wt.path)}${status}`,
    );
  }
  console.log();
}

/**
 * Display worktrees that are protected/skipped
 */
function displaySkipped(worktrees: CleanableWorktree[]): void {
  console.log(`${output.bold("Protected worktrees:")}\n`);
  for (const wt of worktrees) {
    console.log(
      `  ${output.warningSymbol()} ${output.path(wt.branch || wt.path)} - ${
        output.dim(wt.reason || "unknown")
      }`,
    );
  }
  console.log();
}

/**
 * Display orphan branches that will be deleted
 */
function displayOrphanBranches(branches: OrphanBranch[]): void {
  const toDelete = branches.filter((b) => b.canDelete);
  const protected_ = branches.filter((b) => !b.canDelete);

  if (toDelete.length > 0) {
    console.log(`${output.bold("Orphan branches to delete:")}\n`);
    for (const branch of toDelete) {
      console.log(`  ${output.errorSymbol()} ${output.path(branch.name)}`);
    }
    console.log();
  }

  if (protected_.length > 0) {
    console.log(`${output.bold("Protected orphan branches:")}\n`);
    for (const branch of protected_) {
      console.log(
        `  ${output.warningSymbol()} ${output.path(branch.name)} - ${
          output.dim(branch.reason || "unknown")
        }`,
      );
    }
    console.log();
  }
}

/**
 * Remove worktrees with error handling
 */
async function removeWorktrees(
  worktrees: CleanableWorktree[],
  verbose: boolean,
): Promise<void> {
  console.log();
  const results: Array<{
    worktree: CleanableWorktree;
    success: boolean;
    error?: string;
  }> = [];

  for (const wt of worktrees) {
    try {
      if (verbose) {
        console.log(`Removing ${output.path(wt.branch || wt.path)}...`);
      }
      await removeWorktree(wt.path, false);
      results.push({ worktree: wt, success: true });
      if (verbose) {
        console.log(`  ${output.checkmark()} Removed\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ worktree: wt, success: false, error: message });
      if (verbose) {
        console.log(
          `  ${output.errorSymbol()} Failed: ${output.dim(message)}\n`,
        );
      }
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
    console.log("\nFailed worktrees:");
    for (const result of results.filter((r) => !r.success)) {
      console.log(
        `  ${output.errorSymbol()} ${
          output.path(result.worktree.branch || result.worktree.path)
        }`,
      );
      console.log(`    ${output.dim(result.error || "unknown error")}`);
    }
    console.log();
  }
}

/**
 * Delete orphan branches with error handling
 */
async function deleteOrphanBranches(
  branches: OrphanBranch[],
  verbose: boolean,
): Promise<void> {
  const toDelete = branches.filter((b) => b.canDelete);
  if (toDelete.length === 0) return;

  const results: Array<{
    branch: OrphanBranch;
    success: boolean;
    error?: string;
  }> = [];

  for (const branch of toDelete) {
    try {
      if (verbose) {
        console.log(`Deleting branch ${output.path(branch.name)}...`);
      }
      await deleteBranch(branch.name, false);
      results.push({ branch, success: true });
      if (verbose) {
        console.log(`  ${output.checkmark()} Deleted\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ branch, success: false, error: message });
      if (verbose) {
        console.log(
          `  ${output.errorSymbol()} Failed: ${output.dim(message)}\n`,
        );
      }
    }
  }

  // Summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (successful > 0) {
    output.success(`Deleted ${successful} orphan branch(es)`);
  }
  if (failed > 0) {
    output.error(`Failed to delete ${failed} branch(es)`);
    console.log("\nFailed branches:");
    for (const result of results.filter((r) => !r.success)) {
      console.log(
        `  ${output.errorSymbol()} ${output.path(result.branch.name)}`,
      );
      console.log(`    ${output.dim(result.error || "unknown error")}`);
    }
    console.log();
  }
}

/**
 * Execute full cleanup (default behavior)
 */
async function executeFullCleanup(parsed: PruneArgs): Promise<void> {
  // Load config for defaultBranch
  const { config } = await loadConfig();
  const defaultBranch = config.defaultBranch ?? "main";

  // Run git worktree prune first
  await runGitWorktreePrune(parsed.verbose);

  // Get current worktree path for protection
  const currentPath = await getCurrentWorktreePath();

  // List and analyze all worktrees
  output.info("Analyzing worktrees and branches...");
  const worktrees = await listWorktrees();
  const analyzed = await analyzeWorktrees(worktrees, {
    currentPath,
    defaultBranch,
  });

  // Find orphan branches (unless --no-branches)
  const orphanBranches = parsed.noBranches
    ? []
    : await findOrphanBranches(worktrees, defaultBranch);

  // Separate cleanable from protected
  const toClean = analyzed.filter((wt) => wt.canClean);
  const toSkip = analyzed.filter((wt) => !wt.canClean);

  // Check if there's anything to do
  const branchesToDelete = orphanBranches.filter((b) => b.canDelete);
  if (toClean.length === 0 && branchesToDelete.length === 0) {
    output.success("Nothing to clean");
    if (toSkip.length > 0) {
      displaySkipped(toSkip);
    }
    if (
      orphanBranches.length > 0 && orphanBranches.every((b) => !b.canDelete)
    ) {
      displayOrphanBranches(orphanBranches);
    }
    Deno.exit(0);
  }

  // Display what will be cleaned
  if (toClean.length > 0) {
    displayCleanable(toClean);
  }
  if (toSkip.length > 0) {
    displaySkipped(toSkip);
  }
  if (orphanBranches.length > 0) {
    displayOrphanBranches(orphanBranches);
  }

  // Exit early for dry-run
  if (parsed.dryRun) {
    output.info("Dry run complete - nothing was removed");
    Deno.exit(0);
  }

  // Build confirmation message
  const parts: string[] = [];
  if (toClean.length > 0) {
    parts.push(`${toClean.length} worktree(s)`);
  }
  if (branchesToDelete.length > 0) {
    parts.push(`${branchesToDelete.length} orphan branch(es)`);
  }

  // Confirm with user (unless force)
  if (!parsed.force) {
    const confirmed = await confirm(`Remove ${parts.join(" and ")}?`);
    if (!confirmed) {
      console.log("\nCancelled.\n");
      Deno.exit(0);
    }
  }

  // Remove worktrees
  if (toClean.length > 0) {
    await removeWorktrees(toClean, parsed.verbose);
  }

  // Delete orphan branches
  if (branchesToDelete.length > 0) {
    await deleteOrphanBranches(orphanBranches, parsed.verbose);
  }
}

/**
 * Execute the prune command
 *
 * @param args Command-line arguments for the prune command
 */
export async function executePrune(args: string[]): Promise<void> {
  const parsed = parsePruneArgs(args);

  if (parsed.help) {
    showPruneHelp();
    Deno.exit(0);
  }

  // Stale-only mode: proxy to git (preserve original git behavior)
  if (parsed.staleOnly) {
    await executeGitWorktree(
      "prune",
      parsed.gitArgs,
      "Worktree information cleaned up",
    );
    return;
  }

  // Default: full cleanup
  await executeFullCleanup(parsed);
}
