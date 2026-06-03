/**
 * Tests for branch-protection.ts
 */

import { assertEquals } from '@std/assert';
import { CANONICAL_TRUNK_BRANCHES, isProtectedBranch } from './branch-protection.ts';

Deno.test('isProtectedBranch - protects default branch', () => {
  assertEquals(isProtectedBranch('main', 'main'), true);
  assertEquals(isProtectedBranch('master', 'master'), true);
  assertEquals(isProtectedBranch('develop', 'develop'), true);
});

Deno.test('isProtectedBranch - protects gw_root', () => {
  assertEquals(isProtectedBranch('gw_root', 'main'), true);
  assertEquals(isProtectedBranch('gw_root', 'master'), true);
});

Deno.test('isProtectedBranch - allows removal of feature branches', () => {
  assertEquals(isProtectedBranch('feat/my-feature', 'main'), false);
  assertEquals(isProtectedBranch('fix/bug-123', 'main'), false);
  assertEquals(isProtectedBranch('chore/cleanup', 'main'), false);
});

Deno.test('isProtectedBranch - handles undefined branch', () => {
  assertEquals(isProtectedBranch(undefined, 'main'), false);
});

Deno.test('isProtectedBranch - canonical trunk names are always protected', () => {
  // Regression for the bug where `gw clean` deleted a local `main` branch
  // because the configured defaultBranch was something else (e.g. master).
  // Git's canonical trunk names (main, master) must be protected regardless
  // of which one is currently the configured default.
  assertEquals(isProtectedBranch('main', 'master'), true);
  assertEquals(isProtectedBranch('master', 'main'), true);
  assertEquals(isProtectedBranch('main', 'develop'), true);
  assertEquals(isProtectedBranch('master', 'develop'), true);
});

Deno.test('isProtectedBranch - case sensitive matching', () => {
  // Branch names are case-sensitive in git
  assertEquals(isProtectedBranch('Main', 'main'), false);
  assertEquals(isProtectedBranch('MAIN', 'main'), false);
  assertEquals(isProtectedBranch('GW_ROOT', 'main'), false);
});

Deno.test('CANONICAL_TRUNK_BRANCHES contains main and master', () => {
  assertEquals(CANONICAL_TRUNK_BRANCHES.includes('main'), true);
  assertEquals(CANONICAL_TRUNK_BRANCHES.includes('master'), true);
});
