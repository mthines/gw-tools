/**
 * Git worktree parser - runs `git worktree list --porcelain` and parses the output
 */

import * as cp from 'child_process';

/** Optional logger callback for command execution */
let logFn: ((message: string) => void) | undefined;

/**
 * Set the logger function for command execution output.
 * Pass `undefined` to disable logging.
 */
export function setLogger(fn: ((message: string) => void) | undefined): void {
  logFn = fn;
}

/**
 * Strip ANSI escape codes from a string
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Strip the remote prefix (e.g. `origin/`, `upstream/`) from a remote branch name.
 * If the branch name does not contain a `/`, it is returned unchanged.
 * Only strips the first path segment, preserving the rest of the branch name.
 *
 * Examples:
 *   `origin/test/foo`   → `test/foo`
 *   `upstream/main`     → `main`
 *   `my-local-branch`   → `my-local-branch`
 */
export function stripRemotePrefix(branchName: string): string {
  const slashIndex = branchName.indexOf('/');
  if (slashIndex === -1) {
    return branchName;
  }
  return branchName.substring(slashIndex + 1);
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
  logFn?.(`> ${command}`);
  return new Promise((resolve, reject) => {
    const child = cp.exec(command, { cwd, timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        // Check if it was a timeout (killed)
        if (err.killed || err.signal === 'SIGTERM') {
          logFn?.(`  [TIMEOUT] ${command}`);
          reject(new Error('TIMEOUT'));
          return;
        }
        const errMsg = stderr.trim() || err.message;
        logFn?.(`  [ERROR] ${stripAnsi(errMsg)}`);
        reject(new Error(errMsg));
        return;
      }
      const output = stdout.trim();
      if (output) {
        logFn?.(`  ${stripAnsi(output).split('\n').join('\n  ')}`);
      }
      resolve(output);
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
export async function listWorktrees(cwd: string): Promise<WorktreeInfo[]> {
  const output = await exec('git worktree list --porcelain', cwd);
  return parseWorktreeListOutput(output);
}

/**
 * Get the configured default branch from .gw/config.json
 * Falls back to 'main' if not configured or file doesn't exist
 */
export async function getDefaultBranch(cwd: string): Promise<string> {
  try {
    const output = await exec('cat .gw/config.json', cwd);
    const config = JSON.parse(output);
    return config.defaultBranch || 'main';
  } catch {
    // Config doesn't exist or is invalid, fall back to main
    return 'main';
  }
}

/**
 * Branch information
 */
export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  commitHash?: string;
  commitMessage?: string;
  authorName?: string;
  relativeDate?: string;
}

/**
 * List all git branches (local and remote) with commit info
 */
export async function listBranches(cwd: string): Promise<BranchInfo[]> {
  // Use for-each-ref to get branch info with commit details
  // Format: refname|objectname:short|subject|authorname|committerdate:relative
  const format = '%(refname)|%(objectname:short)|%(subject)|%(authorname)|%(committerdate:relative)';
  const output = await exec(`git for-each-ref --format='${format}' refs/heads refs/remotes`, cwd);
  const lines = output.split('\n').filter((line) => line.trim());

  // Get current branch name
  let currentBranch = '';
  try {
    currentBranch = await exec('git rev-parse --abbrev-ref HEAD', cwd);
  } catch {
    // Ignore - might be in detached HEAD state
  }

  return lines
    .map((line) => {
      const [refname, commitHash, commitMessage, authorName, relativeDate] = line.split('|');

      // Parse refname to get clean branch name and determine if remote
      let name = refname;
      let isRemote = false;

      if (refname.startsWith('refs/heads/')) {
        name = refname.replace('refs/heads/', '');
      } else if (refname.startsWith('refs/remotes/')) {
        name = refname.replace('refs/remotes/', '');
        isRemote = true;
      }

      // Skip HEAD pointer entries
      if (name.endsWith('/HEAD')) {
        return null;
      }

      const isCurrent = name === currentBranch;

      return {
        name,
        isRemote,
        isCurrent,
        commitHash,
        commitMessage,
        authorName,
        relativeDate,
      };
    })
    .filter((b): b is BranchInfo => b !== null);
}

/**
 * Get the git root directory for a given path
 */
export async function getGitRoot(cwd: string): Promise<string> {
  try {
    return await exec('git rev-parse --show-toplevel', cwd);
  } catch {
    // Could be bare repo - try common dir
    return await exec('git rev-parse --git-common-dir', cwd);
  }
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
 * Create a new worktree from staged files via gw checkout --from-staged
 */
export function createWorktreeFromStaged(cwd: string, branchName: string): Promise<string> {
  return exec(`gw checkout ${branchName} --from-staged`, cwd);
}

/**
 * Check if there are staged files in the current worktree
 */
export async function hasStagedFiles(cwd: string): Promise<boolean> {
  try {
    const output = await exec('git diff --cached --name-only', cwd);
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the path of a worktree by branch name
 */
export async function getWorktreePath(cwd: string, branchName: string): Promise<string | undefined> {
  const worktrees = await listWorktrees(cwd);
  const worktree = worktrees.find((w) => w.branch === branchName);
  return worktree?.path;
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
  opts: { merge?: boolean; rebase?: boolean; from?: string } = {}
): Promise<UpdateResult> {
  const args: string[] = [];
  if (opts.merge) args.push('--merge');
  if (opts.rebase) args.push('--rebase');
  if (opts.from) args.push('--from', opts.from);

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
