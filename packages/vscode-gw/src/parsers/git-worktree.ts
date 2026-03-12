/**
 * Git worktree parser - runs `git worktree list --porcelain` and parses the output
 */

import * as cp from 'child_process';

/**
 * Strip ANSI escape codes from a string
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
}

/**
 * Run a shell command and return stdout
 */
function exec(command: string, cwd: string, timeoutMs?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = cp.exec(command, { cwd, timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        // Check if it was a timeout (killed)
        if (err.killed || err.signal === 'SIGTERM') {
          reject(new Error('TIMEOUT'));
          return;
        }
        reject(new Error(stderr.trim() || err.message));
        return;
      }
      resolve(stdout.trim());
    });

    // Also set up a manual timeout in case the process hangs without being killed
    if (timeoutMs) {
      setTimeout(() => {
        child.kill('SIGTERM');
      }, timeoutMs);
    }
  });
}

/**
 * Parse the porcelain output of `git worktree list --porcelain`
 */
export function parseWorktreeListOutput(output: string): WorktreeInfo[] {
  const lines = output.trim().split('\n');
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      current.path = line.substring('worktree '.length);
    } else if (line.startsWith('HEAD ')) {
      current.head = line.substring('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      const fullRef = line.substring('branch '.length);
      current.branch = fullRef.replace(/^refs\/heads\//, '');
    } else if (line === 'bare') {
      current.bare = true;
    } else if (line === '') {
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch || '(detached)',
          head: current.head || '',
          bare: current.bare || false,
        });
      }
      current = {};
    }
  }

  // Handle last entry
  if (current.path) {
    worktrees.push({
      path: current.path,
      branch: current.branch || '(detached)',
      head: current.head || '',
      bare: current.bare || false,
    });
  }

  return worktrees;
}

/**
 * List all worktrees by invoking git
 */
export function listWorktrees(cwd: string): Promise<WorktreeInfo[]> {
  return new Promise((resolve, reject) => {
    cp.exec('git worktree list --porcelain', { cwd }, (err, stdout) => {
      if (err) {
        reject(new Error(`Failed to list worktrees: ${err.message}`));
        return;
      }
      resolve(parseWorktreeListOutput(stdout));
    });
  });
}

/**
 * Get the git root directory for a given path
 */
export function getGitRoot(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.exec('git rev-parse --show-toplevel', { cwd }, (err, stdout) => {
      if (err) {
        // Could be bare repo - try common dir
        cp.exec('git rev-parse --git-common-dir', { cwd }, (err2, stdout2) => {
          if (err2) {
            reject(new Error(`Not a git repository: ${err2.message}`));
            return;
          }
          resolve(stdout2.trim());
        });
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Check if a worktree has uncommitted changes
 */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  try {
    const output = await exec('git status --porcelain', worktreePath);
    return output.length > 0;
  } catch {
    // If we can't check status, assume it might have changes
    return true;
  }
}

/**
 * Remove a worktree using gw remove
 */
export function removeWorktree(cwd: string, worktreePath: string, force = false): Promise<void> {
  const flags = force ? '--yes --force' : '--yes';
  return exec(`gw remove "${worktreePath}" ${flags}`, cwd).then(() => undefined);
}

/**
 * Create a new worktree via gw checkout
 */
export function createWorktree(cwd: string, branchName: string): Promise<string> {
  return exec(`gw checkout ${branchName}`, cwd);
}

/**
 * Clean up stale worktrees via gw clean
 */
export function cleanWorktrees(cwd: string, opts: { force?: boolean; dryRun?: boolean } = {}): Promise<string> {
  const flags: string[] = ['--yes'];
  if (opts.force) flags.push('--force');
  if (opts.dryRun) flags.push('--dry-run');
  return exec(`gw clean ${flags.join(' ')}`, cwd);
}

/**
 * Sync files to a worktree via gw sync
 */
export function syncWorktree(cwd: string, target?: string, from?: string): Promise<string> {
  const args: string[] = [];
  if (target) args.push(target);
  if (from) args.push('--from', from);
  return exec(`gw sync ${args.join(' ')}`, cwd);
}

/**
 * Result from gw update command
 */
export interface UpdateResult {
  success: boolean;
  message: string;
  conflicted: boolean;
  alreadyUpToDate: boolean;
}

/**
 * Update current worktree with latest changes from default branch via gw update
 */
export async function updateWorktree(
  cwd: string,
  opts: { merge?: boolean; rebase?: boolean } = {}
): Promise<UpdateResult> {
  const args: string[] = [];
  if (opts.merge) args.push('--merge');
  if (opts.rebase) args.push('--rebase');

  try {
    const output = await exec(`gw update ${args.join(' ')}`, cwd);
    const cleanOutput = stripAnsi(output);

    return {
      success: true,
      message: cleanOutput,
      conflicted: false,
      alreadyUpToDate: cleanOutput.toLowerCase().includes('already up to date'),
    };
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const cleanMessage = stripAnsi(rawMessage);
    const isConflict =
      cleanMessage.toLowerCase().includes('conflict') || cleanMessage.toLowerCase().includes('fix conflicts');

    return {
      success: false,
      message: cleanMessage,
      conflicted: isConflict,
      alreadyUpToDate: false,
    };
  }
}

/**
 * Info about a cleanable worktree
 */
export interface CleanableWorktreeInfo {
  branch: string;
  path: string;
  ageDays: number;
  hasUncommitted: boolean;
  hasUnpushed: boolean;
}

/**
 * Result from gw clean --json
 */
export interface CleanCheckResult {
  cleanable: CleanableWorktreeInfo[];
  skipped: { branch: string; path: string; ageDays: number; reason: string }[];
  /** True if the command timed out (likely older gw version without --json support) */
  timedOut?: boolean;
}

/** Timeout for gw clean --json command (5 seconds) */
const GW_CLEAN_TIMEOUT_MS = 5000;

/**
 * Check which worktrees are cleanable via gw clean --json
 * Times out after 5 seconds for older gw versions without --json support
 */
export async function getCleanableWorktrees(cwd: string): Promise<CleanCheckResult> {
  try {
    const output = await exec('gw clean --json', cwd, GW_CLEAN_TIMEOUT_MS);
    return JSON.parse(output) as CleanCheckResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'TIMEOUT') {
      return { cleanable: [], skipped: [], timedOut: true };
    }
    return { cleanable: [], skipped: [] };
  }
}
