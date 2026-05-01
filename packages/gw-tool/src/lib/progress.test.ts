/**
 * Unit tests for the progress event emitter (progress.ts)
 */

import { assertEquals, assertExists } from '@std/assert';
import { emitProgress, initProgress, isProgressEnabled } from './progress.ts';

/**
 * Helper: capture Deno.stderr.writeSync calls and return the written text.
 * Returns a restore function to undo the patch.
 */
function captureStderrSync(): { getOutput: () => string; restore: () => void } {
  let captured = '';
  const original = Deno.stderr.writeSync.bind(Deno.stderr);

  // @ts-ignore - intentional patch for testing
  Deno.stderr.writeSync = (data: Uint8Array): number => {
    captured += new TextDecoder().decode(data);
    return data.length;
  };

  return {
    getOutput: () => captured,
    restore: () => {
      // @ts-ignore - restoring original
      Deno.stderr.writeSync = original;
    },
  };
}

// Reset progress mode between tests by always initialising to a known state.
function resetProgress(): void {
  initProgress(undefined);
}

// ── initProgress / isProgressEnabled ─────────────────────────────────────────

Deno.test('initProgress("json") enables progress mode', () => {
  resetProgress();
  initProgress('json');
  assertEquals(isProgressEnabled(), true);
  resetProgress();
});

Deno.test('initProgress(undefined) disables progress mode', () => {
  initProgress('json');
  initProgress(undefined);
  assertEquals(isProgressEnabled(), false);
});

Deno.test('initProgress with unknown value disables progress mode', () => {
  resetProgress();
  initProgress('text');
  assertEquals(isProgressEnabled(), false);
});

Deno.test('isProgressEnabled returns false before any initProgress call', () => {
  resetProgress();
  assertEquals(isProgressEnabled(), false);
});

// ── emitProgress — disabled ───────────────────────────────────────────────────

Deno.test('emitProgress is a no-op when progress is disabled', () => {
  resetProgress();
  const { getOutput, restore } = captureStderrSync();
  try {
    emitProgress({ stage: 'create-worktree', status: 'start' });
    assertEquals(getOutput(), '');
  } finally {
    restore();
  }
});

// ── emitProgress — enabled ────────────────────────────────────────────────────

Deno.test('emitProgress writes valid JSON + newline to stderr when enabled', () => {
  initProgress('json');
  const { getOutput, restore } = captureStderrSync();
  try {
    emitProgress({ stage: 'create-worktree', status: 'start' });
    const output = getOutput();
    // Must end with a newline (NDJSON requirement)
    assertEquals(output.endsWith('\n'), true);
    // Must be valid JSON
    const parsed = JSON.parse(output.trim());
    assertExists(parsed);
  } finally {
    restore();
    resetProgress();
  }
});

Deno.test('every emitted event has version: 1', () => {
  initProgress('json');
  const { getOutput, restore } = captureStderrSync();
  try {
    emitProgress({ stage: 'create-worktree', status: 'start' });
    const parsed = JSON.parse(getOutput().trim());
    assertEquals(parsed.version, 1);
  } finally {
    restore();
    resetProgress();
  }
});

Deno.test('start event does NOT contain durationMs field', () => {
  initProgress('json');
  const { getOutput, restore } = captureStderrSync();
  try {
    emitProgress({ stage: 'create-worktree', status: 'start' });
    const parsed = JSON.parse(getOutput().trim());
    assertEquals('durationMs' in parsed, false, 'start event must not have durationMs');
  } finally {
    restore();
    resetProgress();
  }
});

Deno.test('end event contains durationMs field', () => {
  initProgress('json');
  const { getOutput, restore } = captureStderrSync();
  try {
    emitProgress({ stage: 'create-worktree', status: 'end', durationMs: 1234 });
    const parsed = JSON.parse(getOutput().trim());
    assertEquals(parsed.durationMs, 1234);
  } finally {
    restore();
    resetProgress();
  }
});

Deno.test('error event contains message and exitCode fields', () => {
  initProgress('json');
  const { getOutput, restore } = captureStderrSync();
  try {
    emitProgress({
      stage: 'create-worktree',
      status: 'error',
      message: 'git worktree add failed with exit code 128',
      exitCode: 128,
    });
    const parsed = JSON.parse(getOutput().trim());
    assertEquals(parsed.status, 'error');
    assertEquals(parsed.message, 'git worktree add failed with exit code 128');
    assertEquals(parsed.exitCode, 128);
  } finally {
    restore();
    resetProgress();
  }
});

Deno.test('hook event contains hook, of, and command fields', () => {
  initProgress('json');
  const { getOutput, restore } = captureStderrSync();
  try {
    emitProgress({
      stage: 'post-checkout-hooks',
      status: 'start',
      hook: 2,
      of: 3,
      command: 'pnpm install',
    });
    const parsed = JSON.parse(getOutput().trim());
    assertEquals(parsed.hook, 2);
    assertEquals(parsed.of, 3);
    assertEquals(parsed.command, 'pnpm install');
  } finally {
    restore();
    resetProgress();
  }
});

Deno.test('multiple emitProgress calls produce multiple NDJSON lines', () => {
  initProgress('json');
  const { getOutput, restore } = captureStderrSync();
  try {
    emitProgress({ stage: 'create-worktree', status: 'start' });
    emitProgress({ stage: 'create-worktree', status: 'end', durationMs: 500 });
    const lines = getOutput().trim().split('\n');
    assertEquals(lines.length, 2);
    const first = JSON.parse(lines[0]);
    const second = JSON.parse(lines[1]);
    assertEquals(first.status, 'start');
    assertEquals(second.status, 'end');
    assertEquals(second.durationMs, 500);
  } finally {
    restore();
    resetProgress();
  }
});

Deno.test('all stage values are accepted without throwing', () => {
  initProgress('json');
  const { restore } = captureStderrSync();
  try {
    const stages = [
      'pre-checkout-hooks',
      'create-worktree',
      'copy-files',
      'copy-staged-files',
      'post-checkout-hooks',
    ] as const;
    for (const stage of stages) {
      emitProgress({ stage, status: 'start' });
    }
    // No assertion needed — we just verify no error is thrown
  } finally {
    restore();
    resetProgress();
  }
});
