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
 */
async function getCleanableWorktrees(
  threshold: number,
): Promise<CleanableWorktree[]> {
  const worktrees = await listWorktrees();

  // Filter out bare repository
  const nonBareWorktrees = worktrees.filter((wt) => !wt.bare);

  const cleanable: CleanableWorktree[] = [];

  for (const wt of nonBareWorktrees) {
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

    // Get threshold (default 7 days)
    const threshold = config.cleanThreshold ?? 7;

    // Find cleanable worktrees
    const cleanableWorktrees = await getCleanableWorktrees(threshold);

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
 * This is the main entry point for commands to call
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
