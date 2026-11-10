/**
 * Tests for git-hook.ts
 */

import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import {
  addHookBlock,
  GIT_HOOK_BEGIN,
  GIT_HOOK_END,
  hasHookBlock,
  isGitHookEnabled,
  isZeroOid,
  removeHookBlock,
  renderHookBlock,
} from './git-hook.ts';

Deno.test('isZeroOid - detects sha1 and sha256 zero oids', () => {
  assert(isZeroOid('0'.repeat(40)));
  assert(isZeroOid('0'.repeat(64)));
  assert(!isZeroOid('abc123'));
  assert(!isZeroOid('0000000000000000000000000000000000000001'));
  assert(!isZeroOid(undefined));
  assert(!isZeroOid(''));
});

Deno.test('addHookBlock - creates a new hook when none exists', () => {
  const result = addHookBlock(null) as string;
  assert(result.startsWith('#!/bin/sh\n'));
  assertStringIncludes(result, GIT_HOOK_BEGIN);
  assertStringIncludes(result, 'gw _post-worktree-add');
});

Deno.test('addHookBlock - inserts after shebang, preserving the existing hook', () => {
  const existing = '#!/bin/bash\necho hi\nexit 0\n';
  const result = addHookBlock(existing) as string;
  assert(result.startsWith('#!/bin/bash\n' + GIT_HOOK_BEGIN));
  assert(result.indexOf(GIT_HOOK_END) < result.indexOf('echo hi'));
  assertStringIncludes(result, 'exit 0');
});

Deno.test('addHookBlock - adds shebang to a hook without one', () => {
  const result = addHookBlock('echo hi\n') as string;
  assert(result.startsWith('#!/bin/sh\n' + GIT_HOOK_BEGIN));
  assertStringIncludes(result, 'echo hi');
});

Deno.test('addHookBlock - is idempotent', () => {
  const once = addHookBlock('#!/bin/sh\necho hi\n') as string;
  assertEquals(addHookBlock(once), null);
});

Deno.test('addHookBlock - refuses non-shell hooks', () => {
  assertEquals(addHookBlock('#!/usr/bin/env node\nconsole.log(1)\n'), 'unsupported');
});

Deno.test('removeHookBlock - restores the original hook', () => {
  const original = '#!/bin/bash\necho hi\n';
  const installed = addHookBlock(original) as string;
  assertEquals(removeHookBlock(installed), original);
});

Deno.test('removeHookBlock - returns null when only the gw block was present', () => {
  const installed = addHookBlock(null) as string;
  assertEquals(removeHookBlock(installed), null);
});

Deno.test('hasHookBlock / renderHookBlock', () => {
  assert(hasHookBlock(renderHookBlock()));
  assert(!hasHookBlock('#!/bin/sh\n'));
});

Deno.test('renderHookBlock - skips when gw checkout is active', () => {
  assertStringIncludes(renderHookBlock(), 'GW_CHECKOUT_ACTIVE');
});

Deno.test('isGitHookEnabled - defaults to true, false only when explicitly disabled', () => {
  assert(isGitHookEnabled({}));
  assert(isGitHookEnabled({ hooks: {} }));
  assert(isGitHookEnabled({ hooks: { gitWorktreeAdd: true } }));
  assert(!isGitHookEnabled({ hooks: { gitWorktreeAdd: false } }));
});
