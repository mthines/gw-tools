/**
 * Glob pattern matching for worktree names
 *
 * Uses bash-style globs (`*`, `?`, `[abc]`, `**`) to filter worktrees by
 * their path relative to the git root.
 */

import { globToRegExp } from '@std/path';
import { relative } from '@std/path';
import type { WorktreeInfo } from './git-utils.ts';

/**
 * Check whether a string contains glob metacharacters that would trigger
 * pattern expansion (`*`, `?`, `[`).
 */
export function containsGlob(value: string): boolean {
  return /[*?[]/.test(value);
}

/**
 * Compute a worktree's display name — its path relative to the git root.
 *
 * For a worktree at `/repo/feat/foo` with gitRoot `/repo`, returns `feat/foo`.
 * Falls back to the last path component if the worktree is outside gitRoot.
 */
export function worktreeName(wt: WorktreeInfo, gitRoot: string): string {
  const rel = relative(gitRoot, wt.path);
  // Outside gitRoot — fall back to the last path component
  if (rel.startsWith('..')) {
    return wt.path.split('/').pop() || wt.path;
  }
  // Empty string means wt.path === gitRoot (the repo root itself)
  return rel;
}

/**
 * Match worktrees whose relative name matches the given glob pattern.
 *
 * Pattern semantics follow bash globs:
 * - `*` matches anything except `/`
 * - `**` matches anything including `/`
 * - `?` matches a single character
 * - `[abc]` matches one of `a`, `b`, or `c`
 */
export function matchWorktreesByPattern(worktrees: WorktreeInfo[], pattern: string, gitRoot: string): WorktreeInfo[] {
  const regex = globToRegExp(pattern, { extended: true, globstar: true });
  return worktrees.filter((wt) => {
    const name = worktreeName(wt, gitRoot);
    // Skip the repo root itself — it has an empty name and should never be
    // matched by a user-supplied pattern.
    if (!name) return false;
    return regex.test(name);
  });
}
