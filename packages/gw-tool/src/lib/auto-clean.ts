/**
 * Auto-cleanup functionality for removing stale worktrees
 * Runs automatically in the background on configured commands
 * with cooldown — never blocks or prompts the user.
 */

import { isProtectedBranch } from './branch-protection.ts';
import { loadConfig, saveConfig } from './config.ts';
import {
  getWorktreeAgeDays,
  hasUncommittedChanges,
  hasUnpushedCommits,
  listWorktrees,
  removeWorktree,
  type WorktreeInfo,
} from './git-utils.ts';
import * as output from './output.ts';

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
 * Result of an auto-clean execution
 */
export interface AutoCleanResult {
  /** Names/branches of worktrees that were removed */
  removed: string[];
  /** Total number of worktrees removed */
  removedCount: number;
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
 * @param threshold Minimum age in days for a worktree
 *   to be considered stale
 * @param defaultBranch Branch name that should never be
 *   cleaned (e.g., "main")
 */
async function getCleanableWorktrees(threshold: number, defaultBranch: string): Promise<CleanableWorktree[]> {
  const worktrees = await listWorktrees();

  // Filter out bare repository
  const nonBareWorktrees = worktrees.filter((wt) => !wt.bare);

  const cleanable: CleanableWorktree[] = [];

  for (const wt of nonBareWorktrees) {
    // Never clean protected branches (defaultBranch, gw_root)
    if (isProtectedBranch(wt.branch, defaultBranch)) {
      continue;
    }

    const ageDays = await getWorktreeAgeDays(wt.path);

    // Skip if not old enough
    if (ageDays < threshold) {
      continue;
    }

    const hasUncommitted = await hasUncommittedChanges(wt.path);
    const hasUnpushed = await hasUnpushedCommits(wt.path);

    // Only include if passes ALL safety checks
    // (no force mode in auto-clean)
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
 * Silently removes stale worktrees and updates cooldown
 * timestamp
 *
 * @returns Result with removed worktree names and count
 */
export async function executeAutoClean(): Promise<AutoCleanResult> {
  try {
    // Load config
    const { config, gitRoot } = await loadConfig();

    // Check if auto-clean is enabled
    if (!config.autoClean) {
      return { removed: [], removedCount: 0 };
    }

    // Check cooldown
    if (!shouldRunAutoClean(config.lastAutoCleanTime)) {
      return { removed: [], removedCount: 0 };
    }

    // Get threshold (default 7 days) and defaultBranch
    const threshold = config.cleanThreshold ?? 7;
    const defaultBranch = config.defaultBranch ?? 'main';

    // Find cleanable worktrees (excludes defaultBranch)
    const cleanableWorktrees = await getCleanableWorktrees(threshold, defaultBranch);

    if (cleanableWorktrees.length === 0) {
      // Update timestamp even if nothing to clean
      config.lastAutoCleanTime = Date.now();
      await saveConfig(gitRoot, config);
      return { removed: [], removedCount: 0 };
    }

    // Remove worktrees silently (no force flag needed —
    // already passed safety checks)
    const removed: string[] = [];
    for (const wt of cleanableWorktrees) {
      try {
        await removeWorktree(wt.path, false);
        removed.push(wt.branch || wt.path);
      } catch {
        // Silently ignore removal failures
        // Don't let failures prevent other cleanups
      }
    }

    // Update timestamp after cleanup
    config.lastAutoCleanTime = Date.now();
    await saveConfig(gitRoot, config);

    return { removed, removedCount: removed.length };
  } catch {
    // If anything fails, silently return empty result
    // Auto-clean should never interrupt the main command
    return { removed: [], removedCount: 0 };
  }
}

/**
 * Run auto-clean in the background without blocking
 * the main command. Shows a brief, non-blocking
 * notification if worktrees were removed.
 *
 * This is the main entry point for commands to call.
 * The user's `autoClean: true` config IS the consent —
 * no confirmation prompt is needed.
 */
export function runAutoClean(): void {
  // Fire and forget — don't await, let it run in
  // background so the main command completes immediately
  executeAutoClean()
    .then((result) => {
      if (result.removedCount > 0) {
        const worktreeWord = result.removedCount === 1 ? 'worktree' : 'worktrees';
        const names = result.removed.map((name) => output.path(name)).join(', ');
        console.error(`\n${output.dim(`[gw] Auto-cleaned ${result.removedCount} stale ${worktreeWord}: ${names}`)}`);
      }
    })
    .catch(() => {
      // Silently ignore errors — auto-clean should
      // never affect the main command
    });
}
