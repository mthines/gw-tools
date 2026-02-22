/**
 * Git utility functions for worktree operations
 */

import { join } from '$std/path';

/**
 * Worktree information from git worktree list
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
}

/**
 * Get list of all worktrees
 */
export async function listWorktrees(): Promise<WorktreeInfo[]> {
  const cmd = new Deno.Command('git', {
    args: ['worktree', 'list', '--porcelain'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    const errorMsg = new TextDecoder().decode(stderr);
    throw new Error(`Failed to list worktrees: ${errorMsg}`);
  }

  const output = new TextDecoder().decode(stdout);
  const lines = output.trim().split('\n');
  const worktrees: WorktreeInfo[] = [];

  let current: Partial<WorktreeInfo> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      current.path = line.substring('worktree '.length);
    } else if (line.startsWith('HEAD ')) {
      current.head = line.substring('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      // Keep the full branch name, just remove the refs/heads/ prefix
      const fullRef = line.substring('branch '.length);
      current.branch = fullRef.replace(/^refs\/heads\//, '');
    } else if (line === 'bare') {
      current.bare = true;
    } else if (line === '') {
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch || '',
          head: current.head || '',
          bare: current.bare || false,
        });
      }
      current = {};
    }
  }

  // Handle last worktree
  if (current.path) {
    worktrees.push({
      path: current.path,
      branch: current.branch || '',
      head: current.head || '',
      bare: current.bare || false,
    });
  }

  return worktrees;
}

/**
 * Run git worktree prune to clean up stale administrative files
 * @param silent If true, suppresses all output
 */
export async function pruneWorktrees(silent = true): Promise<void> {
  const cmd = new Deno.Command('git', {
    args: ['worktree', 'prune'],
    stdout: silent ? 'null' : 'inherit',
    stderr: silent ? 'null' : 'inherit',
  });

  const { code } = await cmd.output();

  // Don't throw on error - prune failures shouldn't break clean
  // Just silently continue if prune fails
  if (code !== 0 && !silent) {
    console.error('Warning: git worktree prune encountered errors');
  }
}

/**
 * Check if worktree has uncommitted changes
 */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  const cmd = new Deno.Command('git', {
    args: ['-C', worktreePath, 'status', '--porcelain'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout } = await cmd.output();
  if (code !== 0) return true; // Treat error as "has changes" for safety

  const output = new TextDecoder().decode(stdout).trim();
  return output.length > 0;
}

/**
 * Check if worktree has unpushed commits
 */
export async function hasUnpushedCommits(worktreePath: string): Promise<boolean> {
  // First check if there's a remote tracking branch
  const trackingCmd = new Deno.Command('git', {
    args: ['-C', worktreePath, 'rev-parse', '--abbrev-ref', '@{u}'],
    stdout: 'piped',
    stderr: 'null',
  });

  const trackingResult = await trackingCmd.output();
  if (trackingResult.code !== 0) {
    // No upstream branch - no unpushed commits
    return false;
  }

  // Check for commits ahead of upstream
  const revListCmd = new Deno.Command('git', {
    args: ['-C', worktreePath, 'rev-list', '@{u}..HEAD', '--count'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout } = await revListCmd.output();
  if (code !== 0) return true; // Treat error as "has unpushed" for safety

  const count = parseInt(new TextDecoder().decode(stdout).trim(), 10);
  return count > 0;
}

/**
 * Get the age of a worktree in days
 */
export async function getWorktreeAgeDays(worktreePath: string): Promise<number> {
  try {
    // Use .git file modification time as proxy for worktree creation time
    const gitPath = join(worktreePath, '.git');
    const stat = await Deno.stat(gitPath);
    const mtime = stat.mtime;

    if (!mtime) return 0;

    const now = new Date();
    const ageMs = now.getTime() - mtime.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    return Math.floor(ageDays);
  } catch {
    return 0; // On error, return 0 (won't be cleaned)
  }
}

/**
 * Remove a worktree
 */
export async function removeWorktree(worktreePath: string, force = false): Promise<void> {
  const args = ['worktree', 'remove'];
  if (force) args.push('--force');
  args.push(worktreePath);

  const cmd = new Deno.Command('git', {
    args,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error(`Failed to remove worktree: ${worktreePath}`);
  }
}

/**
 * Fetch the latest version of a branch from remote and update local branch
 * @param branchName Branch to fetch (e.g., "main")
 * @param remoteName Remote name (default: "origin")
 * @returns Object with startPoint and whether fetch succeeded
 */
export async function fetchAndGetStartPoint(
  branchName: string,
  remoteName = 'origin'
): Promise<{ startPoint: string; fetchSucceeded: boolean; message?: string }> {
  const remoteRef = `${remoteName}/${branchName}`;

  // First check if remote exists
  const remoteCheckCmd = new Deno.Command('git', {
    args: ['remote', 'get-url', remoteName],
    stdout: 'null',
    stderr: 'null',
  });

  const remoteCheckResult = await remoteCheckCmd.output();
  if (remoteCheckResult.code !== 0) {
    return {
      startPoint: branchName,
      fetchSucceeded: false,
      message: `No remote '${remoteName}' configured`,
    };
  }

  // Fetch explicitly into the remote-tracking branch reference.
  // This is the most reliable strategy across bare and non-bare repos:
  // - Does not require the local branch to exist or be unchecked-out
  // - Always updates origin/<branch> so the merge/rebase target is fresh
  const fetchCmd = new Deno.Command('git', {
    args: ['fetch', remoteName, `refs/heads/${branchName}:refs/remotes/${remoteName}/${branchName}`],
    stdout: 'piped',
    stderr: 'piped',
  });

  const fetchResult = await fetchCmd.output();

  if (fetchResult.code === 0) {
    // Verify the remote-tracking branch is now resolvable
    const verifyRemoteCmd = new Deno.Command('git', {
      args: ['rev-parse', '--verify', remoteRef],
      stdout: 'null',
      stderr: 'null',
    });

    const verifyRemoteResult = await verifyRemoteCmd.output();
    if (verifyRemoteResult.code === 0) {
      return {
        startPoint: remoteRef,
        fetchSucceeded: true,
      };
    }
  }

  // Explicit remote-tracking fetch failed — fall back to a plain fetch
  // and use FETCH_HEAD (guaranteed to point at what was just fetched)
  const simpleFetchCmd = new Deno.Command('git', {
    args: ['fetch', remoteName, branchName],
    stdout: 'piped',
    stderr: 'piped',
  });

  const simpleFetchResult = await simpleFetchCmd.output();

  if (simpleFetchResult.code === 0) {
    // Check if remote-tracking branch became available after plain fetch
    const verifyRemoteCmd = new Deno.Command('git', {
      args: ['rev-parse', '--verify', remoteRef],
      stdout: 'null',
      stderr: 'null',
    });

    const verifyRemoteResult = await verifyRemoteCmd.output();
    if (verifyRemoteResult.code === 0) {
      return {
        startPoint: remoteRef,
        fetchSucceeded: true,
      };
    }

    // Use FETCH_HEAD as last resort
    const verifyFetchHeadCmd = new Deno.Command('git', {
      args: ['rev-parse', '--verify', 'FETCH_HEAD'],
      stdout: 'null',
      stderr: 'null',
    });

    const verifyFetchHeadResult = await verifyFetchHeadCmd.output();
    if (verifyFetchHeadResult.code === 0) {
      return {
        startPoint: 'FETCH_HEAD',
        fetchSucceeded: true,
        message: `Using FETCH_HEAD (remote-tracking branch not available)`,
      };
    }
  }

  // Both fetch attempts failed — collect error info for diagnostics
  const stderr = new TextDecoder().decode(fetchResult.stderr) || new TextDecoder().decode(simpleFetchResult.stderr);
  const errorMsg = stderr.includes('fatal')
    ? stderr.split('\n')[0].replace('fatal: ', '')
    : 'Unable to fetch from remote';

  // Check if local branch exists as offline fallback
  const localCheckCmd = new Deno.Command('git', {
    args: ['rev-parse', '--verify', branchName],
    stdout: 'null',
    stderr: 'null',
  });

  const localCheckResult = await localCheckCmd.output();
  if (localCheckResult.code === 0) {
    return {
      startPoint: branchName,
      fetchSucceeded: false,
      message: `${errorMsg}, using local branch`,
    };
  }

  // Neither remote nor local exists
  throw new Error(`Branch '${branchName}' does not exist locally or on remote '${remoteName}'`);
}

/**
 * Get the current worktree path
 * @returns Absolute path to the current worktree, or empty string if not in a worktree
 */
export async function getCurrentWorktreePath(): Promise<string> {
  const cmd = new Deno.Command('git', {
    args: ['rev-parse', '--show-toplevel'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    const errorMsg = new TextDecoder().decode(stderr).trim();
    // If we're not in a work tree (e.g., in bare repo root) or not in a git repo at all,
    // return empty string
    if (
      errorMsg.includes('not a work tree') ||
      errorMsg.includes('must be run in a work tree') ||
      errorMsg.includes('not a git repository')
    ) {
      return '';
    }
    // For other errors, still throw
    throw new Error(`Failed to get current worktree path: ${errorMsg}`);
  }

  return new TextDecoder().decode(stdout).trim();
}

/**
 * Get the current branch name
 * @param worktreePath Path to the worktree
 * @returns Current branch name, or empty string if in detached HEAD
 */
export async function getCurrentBranch(worktreePath: string): Promise<string> {
  const cmd = new Deno.Command('git', {
    args: ['-C', worktreePath, 'branch', '--show-current'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout } = await cmd.output();

  if (code !== 0) {
    return ''; // Detached HEAD or error
  }

  return new TextDecoder().decode(stdout).trim();
}

/**
 * Check if worktree is in detached HEAD state
 * @param worktreePath Path to the worktree
 * @returns True if in detached HEAD state
 */
export async function isDetachedHead(worktreePath: string): Promise<boolean> {
  const branch = await getCurrentBranch(worktreePath);
  return branch === '';
}

/**
 * Merge a branch into the current branch
 * @param worktreePath Path to the worktree
 * @param sourceBranch Branch to merge from
 * @returns Result of the merge operation
 */
export async function mergeBranch(
  worktreePath: string,
  sourceBranch: string
): Promise<{
  success: boolean;
  message?: string;
  conflicted?: boolean;
  filesChanged?: number;
  fileStats?: string[];
}> {
  const cmd = new Deno.Command('git', {
    args: ['-C', worktreePath, 'merge', sourceBranch],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  const errorOutput = new TextDecoder().decode(stderr);

  if (code === 0) {
    // Merge succeeded
    // Try to extract files changed count from output
    const filesChangedMatch = output.match(/(\d+) files? changed/);
    const filesChanged = filesChangedMatch ? parseInt(filesChangedMatch[1], 10) : undefined;

    // Check if already up to date
    if (output.includes('Already up to date')) {
      return {
        success: true,
        message: 'Already up to date',
        filesChanged: 0,
      };
    }

    // Parse file stats from output
    // Git merge output shows files like: " path/to/file.ts | 10 ++++++++++""
    const fileStats: string[] = [];
    const lines = output.split('\n');
    for (const line of lines) {
      // Match lines that contain file stats (have " | " in them)
      if (line.includes(' | ')) {
        // Trim the line and add it to stats
        const trimmed = line.trim();
        if (trimmed) {
          fileStats.push(trimmed);
        }
      }
    }

    return {
      success: true,
      filesChanged,
      fileStats: fileStats.length > 0 ? fileStats : undefined,
    };
  }

  // Check if it's a merge conflict
  if (output.includes('CONFLICT') || errorOutput.includes('CONFLICT')) {
    return {
      success: false,
      conflicted: true,
      message: 'Merge conflict detected',
    };
  }

  // Other error
  const errorMsg = errorOutput || output || 'Merge failed';
  return {
    success: false,
    message: errorMsg,
  };
}

/**
 * Rebase current branch onto a branch
 * @param worktreePath Path to the worktree
 * @param sourceBranch Branch to rebase onto
 * @returns Result of the rebase operation
 */
export async function rebaseBranch(
  worktreePath: string,
  sourceBranch: string
): Promise<{
  success: boolean;
  message?: string;
  conflicted?: boolean;
  filesChanged?: number;
  fileStats?: string[];
}> {
  const cmd = new Deno.Command('git', {
    args: ['-C', worktreePath, 'rebase', sourceBranch],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  const errorOutput = new TextDecoder().decode(stderr);

  if (code === 0) {
    // Rebase succeeded
    // Check if already up to date
    if (output.includes('is up to date') || output.includes('Current branch')) {
      return {
        success: true,
        message: 'Already up to date',
        filesChanged: 0,
      };
    }

    // Parse file stats from output
    // Git rebase output may include file stats in the final summary
    const fileStats: string[] = [];
    const lines = output.split('\n');
    for (const line of lines) {
      // Match lines that contain file stats (have " | " in them)
      if (line.includes(' | ')) {
        const trimmed = line.trim();
        if (trimmed) {
          fileStats.push(trimmed);
        }
      }
    }

    // Try to extract files changed count from output
    const filesChangedMatch = output.match(/(\d+) files? changed/);
    const filesChanged = filesChangedMatch ? parseInt(filesChangedMatch[1], 10) : undefined;

    return {
      success: true,
      filesChanged,
      fileStats: fileStats.length > 0 ? fileStats : undefined,
    };
  }

  // Check if it's a rebase conflict
  if (
    output.includes('CONFLICT') ||
    errorOutput.includes('CONFLICT') ||
    output.includes('could not apply') ||
    errorOutput.includes('could not apply')
  ) {
    return {
      success: false,
      conflicted: true,
      message: 'Rebase conflict detected',
    };
  }

  // Other error
  const errorMsg = errorOutput || output || 'Rebase failed';
  return {
    success: false,
    message: errorMsg,
  };
}

/**
 * Check if a branch is checked out in another worktree
 * @param branchName Branch name to check
 * @returns True if branch is checked out in another worktree
 */
export async function isBranchCheckedOutElsewhere(branchName: string): Promise<boolean> {
  const worktrees = await listWorktrees();
  // Filter out bare repos and check if any other worktree has this branch
  return worktrees.some((wt) => !wt.bare && wt.branch === branchName);
}

/**
 * Delete a local branch
 * @param branchName Branch name to delete
 * @param force Use -D instead of -d (force delete even if unmerged)
 * @returns Result with success status and message
 */
export async function deleteLocalBranch(
  branchName: string,
  force = false
): Promise<{ success: boolean; message?: string }> {
  const flag = force ? '-D' : '-d';
  const cmd = new Deno.Command('git', {
    args: ['branch', flag, branchName],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await cmd.output();
  const output = new TextDecoder().decode(stdout).trim();
  const errorOutput = new TextDecoder().decode(stderr).trim();

  if (code === 0) {
    return { success: true, message: output };
  }

  // Parse common error cases
  if (errorOutput.includes('not fully merged')) {
    return {
      success: false,
      message: `Branch '${branchName}' is not fully merged. Use --force to delete anyway.`,
    };
  }

  if (errorOutput.includes('checked out')) {
    return {
      success: false,
      message: `Cannot delete branch '${branchName}' - it is checked out in another worktree.`,
    };
  }

  if (errorOutput.includes('not found')) {
    return {
      success: false,
      message: `Branch '${branchName}' not found.`,
    };
  }

  return { success: false, message: errorOutput || 'Failed to delete branch' };
}
