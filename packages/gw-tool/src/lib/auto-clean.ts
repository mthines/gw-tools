/**
 * Auto-cleanup functionality for removing stale worktrees
 * Runs automatically on configured commands with cooldown
 */

import { loadConfig, saveConfig } from "./config.ts";
import {
  getWorktreeAgeDays,
  hasUncommittedChanges,
  hasUnpushedCommits,
  listWorktrees,
  removeWorktree,
  type WorktreeInfo,
} from "./git-utils.ts";
import * as output from "./output.ts";

/** 24 hours in milliseconds */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Worktree with cleanability metadata
 */
interface CleanableWorktree extends WorktreeInfo {
  ageDays: number;
  hasUncommitted: boolean;
  hasUnpushed: boolean;
}

/**
 * Check if enough time has passed since last auto-clean
 */
function shouldRunAutoClean(lastRunTime: number | undefined): boolean {
  if (lastRunTime === undefined) {
    return true; // Never run before
  }

  const now = Date.now();
  const timeSinceLastRun = now - lastRunTime;
  return timeSinceLastRun >= COOLDOWN_MS;
}

/**
 * Analyze worktrees and determine which are safe to clean
 * Reuses safety check logic from clean.ts
 *
 * @param threshold Minimum age in days for a worktree to be considered stale
 * @param defaultBranch Branch name that should never be cleaned (e.g., "main")
 */
async function getCleanableWorktrees(
  threshold: number,
  defaultBranch: string,
): Promise<CleanableWorktree[]> {
  const worktrees = await listWorktrees();

  // Filter out bare repository
  const nonBareWorktrees = worktrees.filter((wt) => !wt.bare);

  const cleanable: CleanableWorktree[] = [];

  for (const wt of nonBareWorktrees) {
    // Never clean the defaultBranch worktree - it's the source for file syncing
    if (wt.branch === defaultBranch) {
      continue;
    }

    const ageDays = await getWorktreeAgeDays(wt.path);

    // Skip if not old enough
    if (ageDays < threshold) {
      continue;
    }

    const hasUncommitted = await hasUncommittedChanges(wt.path);
    const hasUnpushed = await hasUnpushedCommits(wt.path);

    // Only include if passes ALL safety checks (no force mode in auto-clean)
    if (!hasUncommitted && !hasUnpushed) {
      cleanable.push({
        ...wt,
        ageDays,
        hasUncommitted,
        hasUnpushed,
      });
    }
  }

  return cleanable;
}

/**
 * Execute auto-cleanup if enabled and cooldown has passed
 * Silently removes stale worktrees and updates cooldown timestamp
 *
 * @returns Number of worktrees removed (0 if cleanup didn't run)
 */
export async function executeAutoClean(): Promise<number> {
  try {
    // Load config
    const { config, gitRoot } = await loadConfig();

    // Check if auto-clean is enabled
    if (!config.autoClean) {
      return 0;
    }

    // Check cooldown
    if (!shouldRunAutoClean(config.lastAutoCleanTime)) {
      return 0;
    }

    // Get threshold (default 7 days) and defaultBranch
    const threshold = config.cleanThreshold ?? 7;
    const defaultBranch = config.defaultBranch ?? "main";

    // Find cleanable worktrees (excludes defaultBranch)
    const cleanableWorktrees = await getCleanableWorktrees(
      threshold,
      defaultBranch,
    );

    if (cleanableWorktrees.length === 0) {
      // Update timestamp even if nothing to clean
      config.lastAutoCleanTime = Date.now();
      await saveConfig(gitRoot, config);
      return 0;
    }

    // Remove worktrees silently (no force flag needed - already passed safety checks)
    let removedCount = 0;
    for (const wt of cleanableWorktrees) {
      try {
        await removeWorktree(wt.path, false);
        removedCount++;
      } catch {
        // Silently ignore removal failures
        // Don't let failures prevent other cleanups or update timestamp
      }
    }

    // Update timestamp after cleanup
    config.lastAutoCleanTime = Date.now();
    await saveConfig(gitRoot, config);

    return removedCount;
  } catch {
    // If anything fails, silently return 0
    // Auto-clean should never interrupt the main command
    return 0;
  }
}

/**
 * Run auto-clean and optionally show a brief summary message
 * This is the main entry point for commands to call (synchronous version)
 */
export async function runAutoClean(): Promise<void> {
  const removedCount = await executeAutoClean();

  if (removedCount > 0) {
    const worktreeWord = removedCount === 1 ? "worktree" : "worktrees";
    console.log(
      `\n🧹 Auto-cleanup: Removed ${removedCount} stale ${worktreeWord}\n`,
    );
  }
}

/**
 * Run auto-clean in the background without blocking the main command
 * Fire-and-forget: errors are silently ignored, output is suppressed
 */
export function runAutoCleanBackground(): void {
  // Fire and forget - don't await, let it run in background
  executeAutoClean().catch(() => {
    // Silently ignore errors - auto-clean should never affect main command
  });
}

/**
 * Prompt user to clean stale worktrees interactively
 * Shows a confirmation prompt when stale worktrees are detected
 * Updates cooldown timestamp regardless of user choice to prevent repeated prompts
 */
export async function promptAndRunAutoClean(): Promise<void> {
  try {
    // Load config and check if enabled
    const { config, gitRoot } = await loadConfig();
    if (!config.autoClean) {
      return;
    }

    // Check cooldown
    if (!shouldRunAutoClean(config.lastAutoCleanTime)) {
      return;
    }

    // Get cleanable worktrees
    const threshold = config.cleanThreshold ?? 7;
    const defaultBranch = config.defaultBranch ?? "main";
    const cleanableWorktrees = await getCleanableWorktrees(
      threshold,
      defaultBranch,
    );

    // Update timestamp BEFORE prompting to prevent repeated prompts
    config.lastAutoCleanTime = Date.now();
    await saveConfig(gitRoot, config);

    // Return if nothing to clean (silent)
    if (cleanableWorktrees.length === 0) {
      return;
    }

    // Show prompt
    console.log();
    const worktreeWord = cleanableWorktrees.length === 1
      ? "worktree"
      : "worktrees";
    const response = prompt(
      `🧹 Found ${cleanableWorktrees.length} stale ${worktreeWord} (${threshold}+ days old). Clean them up? [Y/n]: `,
    );

    // Handle response (default to yes if empty or Enter)
    if (
      response === null || response === "" ||
      response.toLowerCase() === "y" || response.toLowerCase() === "yes"
    ) {
      // User accepted - remove worktrees
      let removedCount = 0;
      for (const wt of cleanableWorktrees) {
        try {
          await removeWorktree(wt.path, false);
          removedCount++;
        } catch {
          // Silently ignore removal failures
        }
      }

      if (removedCount > 0) {
        const removedWord = removedCount === 1 ? "worktree" : "worktrees";
        console.log(
          `${output.checkmark()} Removed ${removedCount} stale ${removedWord}`,
        );
      }
    } else {
      // User declined
      console.log(
        `Skipped cleanup. Run ${output.bold("gw clean")} manually if needed.`,
      );
    }
    console.log();
  } catch {
    // Silently fail - never interrupt main command
  }
}
