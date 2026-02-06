/**
 * Prune command implementation
 * Cleans up worktree information for deleted worktrees and optionally removes clean worktrees
 */

import { executeGitWorktree, showProxyHelp } from "../lib/git-proxy.ts";
import { loadConfig } from "../lib/config.ts";
import {
  getCurrentWorktreePath,
  hasUncommittedChanges,
  hasUnpushedCommits,
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
  clean: boolean;
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
 * Parse prune command arguments
 */
function parsePruneArgs(args: string[]): PruneArgs {
  const result: PruneArgs = {
    help: false,
    clean: false,
    dryRun: false,
    force: false,
    verbose: false,
    gitArgs: [],
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--clean") {
      result.clean = true;
    } else if (arg === "--dry-run" || arg === "-n") {
      result.dryRun = true;
    } else if (arg === "--force" || arg === "-f") {
      result.force = true;
    } else if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
    } else {
      // Pass other args to git (only used in standard mode)
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

Remove worktree administrative data and optionally clean worktrees.

STANDARD MODE (without --clean):
  Wraps 'git worktree prune' to clean up administrative files for deleted worktrees.
  All arguments are passed directly to git.

CLEAN MODE (with --clean):
  First runs 'git worktree prune', then removes worktrees that have:
  - No uncommitted changes
  - No staged files
  - No unpushed commits

  Unlike 'gw clean', this is NOT age-based - it removes ALL clean worktrees.

Options:
  --clean          Enable clean mode (remove clean worktrees)
  -n, --dry-run    Preview what would be removed without removing
  -f, --force      Skip confirmation prompt (in clean mode)
  -v, --verbose    Show detailed output
  -h, --help       Show this help message

Safety Features (in clean mode):
  - Default branch is protected (from .gw/config.json)
  - Current worktree is protected
  - Bare repository is never removed
  - Confirmation prompt before removal (defaults to yes, press Enter to confirm)

Examples:
  # Standard prune
  gw prune
  gw prune --verbose

  # Clean mode
  gw prune --clean              # Remove all clean worktrees (with prompt)
  gw prune --clean --dry-run    # Preview what would be removed
  gw prune --clean --force      # Remove without confirmation
  gw prune --clean --verbose    # Show detailed output

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
 * Execute clean mode
 */
async function executePruneClean(parsed: PruneArgs): Promise<void> {
  // Load config for defaultBranch
  const { config } = await loadConfig();
  const defaultBranch = config.defaultBranch ?? "main";

  // Run git worktree prune first
  await runGitWorktreePrune(parsed.verbose);

  // Get current worktree path for protection
  const currentPath = await getCurrentWorktreePath();

  // List and analyze all worktrees
  output.info("Analyzing worktrees for cleaning...");
  const worktrees = await listWorktrees();
  const analyzed = await analyzeWorktrees(worktrees, {
    currentPath,
    defaultBranch,
  });

  // Separate cleanable from protected
  const toClean = analyzed.filter((wt) => wt.canClean);
  const toSkip = analyzed.filter((wt) => !wt.canClean);

  // Display results
  if (toClean.length === 0) {
    output.success("No worktrees to clean");
    if (toSkip.length > 0) {
      displaySkipped(toSkip);
    }
    Deno.exit(0);
  }

  displayCleanable(toClean);
  if (toSkip.length > 0) {
    displaySkipped(toSkip);
  }

  // Exit early for dry-run
  if (parsed.dryRun) {
    output.info("Dry run complete - no worktrees were removed");
    Deno.exit(0);
  }

  // Confirm with user (unless force)
  if (!parsed.force) {
    const confirmed = await confirm(`Remove ${toClean.length} worktree(s)?`);
    if (!confirmed) {
      console.log("\nCancelled.\n");
      Deno.exit(0);
    }
  }

  // Remove worktrees
  await removeWorktrees(toClean, parsed.verbose);
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

  // Standard mode: proxy to git (preserve current behavior)
  if (!parsed.clean) {
    await executeGitWorktree("prune", parsed.gitArgs, "Worktree information cleaned up");
    return;
  }

  // Clean mode: enhanced logic
  await executePruneClean(parsed);
}
