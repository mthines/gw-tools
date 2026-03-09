/**
 * Git worktree parser - runs `git worktree list --porcelain` and parses the output
 */

import * as cp from 'child_process';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
}

/**
 * Run a shell command and return stdout
 */
function exec(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.exec(command, { cwd }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.trim() || err.message));
        return;
      }
      resolve(stdout.trim());
    });
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
 * Remove a worktree using gw remove
 */
export function removeWorktree(cwd: string, worktreePath: string): Promise<void> {
  return exec(`gw remove "${worktreePath}" --yes`, cwd).then(() => undefined);
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
