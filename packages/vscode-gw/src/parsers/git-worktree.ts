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
 * Remove a worktree
 */
export function removeWorktree(cwd: string, worktreePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cp.exec(`git worktree remove "${worktreePath}"`, { cwd }, (err) => {
      if (err) {
        reject(new Error(`Failed to remove worktree: ${err.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Create a new worktree via gw checkout
 */
export function createWorktree(cwd: string, branchName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.exec(`gw checkout ${branchName}`, { cwd }, (err, stdout) => {
      if (err) {
        reject(new Error(`Failed to create worktree: ${err.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}
