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
 * Compile a user-supplied pattern to a RegExp matched against the full
 * worktree name (path relative to gitRoot, e.g. "fix/agent0-foo").
 *
 * Two modes, picked by whether the pattern contains a `/`:
 *
 * 1. Path-aware (`fix/*`, `feat/**`, `team/x?/sub`):
 *    Use bash-style globs via globToRegExp — `*` is bounded by `/`, `**`
 *    crosses `/`. Users who type a `/` are being explicit about path shape.
 *
 * 2. Bare (`fix*`, `fi*`, `spike-?`, `[abc]*`):
 *    Treat `*` as "anything including /" so `fix*` matches `fix/agent0-foo`
 *    as well as `fix-branch`. Without this, `fix*` looks broken because
 *    most worktree names are scoped (`<scope>/<name>`) and `*` would never
 *    cross the `/`.
 */
function patternToRegex(pattern: string): RegExp {
  if (pattern.includes('/')) {
    return globToRegExp(pattern, { extended: true, globstar: true });
  }
  // Bare-name mode: build the regex manually so `*` is greedy across `/`.
  // Supported: `*` (any chars), `?` (one char), `[abc]` / `[!abc]` character classes.
  // Other regex specials are escaped.
  let body = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      body += '.*';
    } else if (ch === '?') {
      body += '.';
    } else if (ch === '[') {
      const end = pattern.indexOf(']', i);
      if (end === -1) {
        body += '\\[';
      } else {
        // Translate [!abc] → [^abc]; otherwise pass through verbatim.
        let cls = pattern.substring(i + 1, end);
        if (cls.startsWith('!')) {
          cls = '^' + cls.slice(1);
        }
        body += '[' + cls + ']';
        i = end;
      }
    } else if (/[.+^${}()|\\]/.test(ch)) {
      body += '\\' + ch;
    } else {
      body += ch;
    }
    i++;
  }
  return new RegExp(`^${body}$`);
}

/**
 * Match worktrees whose relative name matches the given pattern.
 * See patternToRegex for the two pattern modes.
 */
export function matchWorktreesByPattern(worktrees: WorktreeInfo[], pattern: string, gitRoot: string): WorktreeInfo[] {
  const regex = patternToRegex(pattern);
  return worktrees.filter((wt) => {
    const name = worktreeName(wt, gitRoot);
    // Skip the repo root itself — it has an empty name and should never be
    // matched by a user-supplied pattern.
    if (!name) return false;
    return regex.test(name);
  });
}
