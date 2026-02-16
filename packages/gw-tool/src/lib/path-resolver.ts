/**
 * Path resolution and validation utilities
 */

import { join, normalize, resolve } from '$std/path';

/**
 * Resolve a worktree path relative to a repository root
 *
 * Handles both:
 * - Relative worktree names: "feat-branch" -> "/repo/root/feat-branch"
 * - Absolute paths with repo prefix: "/repo/root/feat-branch" -> "/repo/root/feat-branch"
 *
 * @param repoPath Absolute path to the repository root
 * @param worktreeName Worktree name (relative) or full path (absolute)
 * @returns Absolute path to the worktree
 */
export function resolveWorktreePath(repoPath: string, worktreeName: string): string {
  // If the worktree name is already an absolute path starting with the repo prefix,
  // just return it normalized
  if (worktreeName.startsWith(repoPath)) {
    return normalize(worktreeName);
  }

  // If it's an absolute path but not within our repo, return it as-is
  // (user might be specifying a different location)
  if (worktreeName.startsWith('/') || worktreeName.match(/^[A-Za-z]:\\/)) {
    return normalize(worktreeName);
  }

  // Otherwise, treat it as a relative path within the repo
  return normalize(join(repoPath, worktreeName));
}

/**
 * Validate that a path exists and is of the expected type
 *
 * @param path Path to validate
 * @param expectedType Expected type: "file" or "directory"
 * @throws Error if path doesn't exist or is wrong type
 */
export async function validatePathExists(path: string, expectedType: 'file' | 'directory'): Promise<void> {
  try {
    const stat = await Deno.stat(path);

    if (expectedType === 'file' && !stat.isFile) {
      throw new Error(`Path exists but is not a file: ${path}`);
    }

    if (expectedType === 'directory' && !stat.isDirectory) {
      throw new Error(`Path exists but is not a directory: ${path}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`${expectedType === 'file' ? 'File' : 'Directory'} not found: ${path}`);
    }
    throw error;
  }
}

/**
 * Check if a path exists (file or directory)
 *
 * @param path Path to check
 * @returns true if path exists, false otherwise
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

/**
 * Check if a path is a directory
 *
 * @param path Path to check
 * @returns true if path is a directory, false otherwise
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isDirectory;
  } catch {
    return false;
  }
}

/**
 * Normalize a path (resolve relative paths, clean up separators)
 *
 * @param path Path to normalize
 * @returns Normalized absolute path
 */
export function normalizePath(path: string): string {
  return normalize(resolve(path));
}

/**
 * Find the git repository root by walking up the directory tree
 *
 * For git worktrees, returns the parent directory containing all worktrees.
 * For regular repos, returns the directory containing .git directory.
 *
 * @param startPath Starting directory path (defaults to current working directory)
 * @returns Absolute path to the git repository root
 * @throws Error if no git repository is found
 */
export async function findGitRoot(startPath?: string): Promise<string> {
  let currentPath = startPath ? resolve(startPath) : Deno.cwd();

  // Walk up the directory tree looking for .git or bare repo markers
  while (true) {
    const gitPath = join(currentPath, '.git');

    // Check for .git file/directory
    if (await pathExists(gitPath)) {
      // Check if .git is a file (worktree) or directory (regular repo)
      const stat = await Deno.stat(gitPath);

      if (stat.isFile) {
        // This is a git worktree - .git is a file pointing to the actual git dir
        // Read the file to get the gitdir path
        const gitFileContent = await Deno.readTextFile(gitPath);
        // Format: "gitdir: /path/to/repo/.git/worktrees/name" (non-bare)
        //     or: "gitdir: /path/to/repo.git/worktrees/name" (bare)
        const match = gitFileContent.match(/gitdir:\s*(.+)/);
        if (match) {
          const gitDir = match[1].trim();
          // Check if this is a bare repository or not
          // Bare: /path/to/repo.git/worktrees/name
          // Non-bare: /path/to/repo/.git/worktrees/name

          if (gitDir.includes('/.git/worktrees/')) {
            // Non-bare repository
            // Go up from .git/worktrees/name to .git, then to repo root
            const dotGitDir = resolve(gitDir, '../..');
            return resolve(dotGitDir, '..');
          } else {
            // Bare repository - gitdir is directly under repo root
            // Go up from worktrees/name to repo root
            return resolve(gitDir, '../..');
          }
        }
        // Fallback if we can't parse the file
        return resolve(currentPath, '..');
      } else {
        // This is a regular git repo - .git is a directory
        return currentPath;
      }
    }

    // Check if this is a bare repository by looking for git metadata files
    // Bare repos have HEAD, config, refs/, and objects/ directly in the repo dir
    const headPath = join(currentPath, 'HEAD');
    const configPath = join(currentPath, 'config');
    const refsPath = join(currentPath, 'refs');
    const objectsPath = join(currentPath, 'objects');

    if (
      (await pathExists(headPath)) &&
      (await pathExists(configPath)) &&
      (await pathExists(refsPath)) &&
      (await pathExists(objectsPath))
    ) {
      // This is a bare repository
      return currentPath;
    }

    // Additional heuristic: check if directory name ends with .git
    // Many bare repos follow this convention (e.g., repo.git)
    if (currentPath.endsWith('.git') && (await pathExists(headPath)) && (await pathExists(configPath))) {
      // Likely a bare repository with minimal checks
      return currentPath;
    }

    const parentPath = resolve(currentPath, '..');

    // If we've reached the root without finding .git
    if (parentPath === currentPath) {
      throw new Error('Not in a git repository. Please run this command from within a git repository.');
    }

    currentPath = parentPath;
  }
}
