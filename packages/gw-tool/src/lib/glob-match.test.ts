/**
 * Tests for glob-match.ts
 */

import { assertEquals } from '@std/assert';
import { containsGlob, matchWorktreesByPattern, worktreeName } from './glob-match.ts';
import type { WorktreeInfo } from './git-utils.ts';

function makeWorktree(path: string, branch = ''): WorktreeInfo {
  return { path, branch, head: 'abc123', bare: false };
}

const gitRoot = '/repo';
const worktrees: WorktreeInfo[] = [
  makeWorktree('/repo/main', 'main'),
  makeWorktree('/repo/test/foo', 'test/foo'),
  makeWorktree('/repo/test/bar', 'test/bar'),
  makeWorktree('/repo/test/sub/deep', 'test/sub/deep'),
  makeWorktree('/repo/feat/login', 'feat/login'),
  makeWorktree('/repo/spike-1', 'spike-1'),
  makeWorktree('/repo/spike-a', 'spike-a'),
];

Deno.test('containsGlob - detects glob metacharacters', () => {
  assertEquals(containsGlob('test/*'), true);
  assertEquals(containsGlob('feat/**'), true);
  assertEquals(containsGlob('spike-?'), true);
  assertEquals(containsGlob('[abc]'), true);
  assertEquals(containsGlob('feat-branch'), false);
  assertEquals(containsGlob('feat/login'), false);
});

Deno.test('worktreeName - returns path relative to gitRoot', () => {
  assertEquals(worktreeName(makeWorktree('/repo/feat/foo'), gitRoot), 'feat/foo');
  assertEquals(worktreeName(makeWorktree('/repo/single'), gitRoot), 'single');
});

Deno.test('worktreeName - falls back to basename when outside gitRoot', () => {
  assertEquals(worktreeName(makeWorktree('/elsewhere/foo'), gitRoot), 'foo');
});

Deno.test('matchWorktreesByPattern - * matches single path segment', () => {
  const matches = matchWorktreesByPattern(worktrees, 'test/*', gitRoot).map((w) => w.path);
  assertEquals(matches.sort(), ['/repo/test/bar', '/repo/test/foo'].sort());
});

Deno.test('matchWorktreesByPattern - ** matches across segments', () => {
  const matches = matchWorktreesByPattern(worktrees, 'test/**', gitRoot).map((w) => w.path);
  assertEquals(matches.sort(), ['/repo/test/bar', '/repo/test/foo', '/repo/test/sub/deep'].sort());
});

Deno.test('matchWorktreesByPattern - ? matches single character', () => {
  const matches = matchWorktreesByPattern(worktrees, 'spike-?', gitRoot).map((w) => w.path);
  assertEquals(matches.sort(), ['/repo/spike-1', '/repo/spike-a'].sort());
});

Deno.test('matchWorktreesByPattern - returns empty array when no matches', () => {
  const matches = matchWorktreesByPattern(worktrees, 'nope/*', gitRoot);
  assertEquals(matches.length, 0);
});

Deno.test('matchWorktreesByPattern - skips repo root (empty relative name)', () => {
  const withRoot = [...worktrees, makeWorktree('/repo', 'main')];
  const matches = matchWorktreesByPattern(withRoot, '*', gitRoot).map((w) => w.path);
  // Root /repo would have an empty name and must not be matched
  assertEquals(matches.includes('/repo'), false);
});

Deno.test('matchWorktreesByPattern - * does not match across /', () => {
  const matches = matchWorktreesByPattern(worktrees, '*', gitRoot).map((w) => w.path);
  // Only top-level: main, spike-1, spike-a
  assertEquals(matches.sort(), ['/repo/main', '/repo/spike-1', '/repo/spike-a'].sort());
});
