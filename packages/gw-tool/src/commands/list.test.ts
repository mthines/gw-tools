/**
 * Tests for list.ts command
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { executeList, renderAnnotatedList, shouldUseRawProxy } from './list.ts';
import { _drainAutoClean } from '../lib/auto-clean.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { createMinimalConfig, writeTestConfig } from '../test-utils/fixtures.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';

// ── shouldUseRawProxy ───────────────────────────────────────────────────────

Deno.test('shouldUseRawProxy - returns true for --porcelain', () => {
  assertEquals(shouldUseRawProxy(['--porcelain']), true);
});

Deno.test('shouldUseRawProxy - returns true for -z', () => {
  assertEquals(shouldUseRawProxy(['-z']), true);
});

Deno.test('shouldUseRawProxy - returns true for --verbose', () => {
  assertEquals(shouldUseRawProxy(['--verbose']), true);
});

Deno.test('shouldUseRawProxy - returns true for -v', () => {
  assertEquals(shouldUseRawProxy(['-v']), true);
});

Deno.test('shouldUseRawProxy - returns false for empty args', () => {
  assertEquals(shouldUseRawProxy([]), false);
});

Deno.test('shouldUseRawProxy - returns false for unknown flags', () => {
  assertEquals(shouldUseRawProxy(['--some-unknown']), false);
});

// ── renderAnnotatedList ─────────────────────────────────────────────────────

Deno.test('renderAnnotatedList - annotates user-protected branch', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-branch', 'feat-branch');

    const cwd = new TempCwd(repo.path);
    const logLines: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logLines.push(args.map(String).join(' '));
    };

    try {
      await renderAnnotatedList(['feat-branch'], 'main');

      // At least one line should contain [protected]
      const hasProtectedLine = logLines.some((line) => line.includes('[protected]'));
      assertEquals(hasProtectedLine, true);
    } finally {
      console.log = origLog;
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('renderAnnotatedList - tags system-protected default branch even without user opt-in', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    const logLines: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logLines.push(args.map(String).join(' '));
    };

    try {
      // main is system-protected because it is the configured default branch.
      // System protection is real protection from cleanup, so the tag must
      // reflect that — otherwise users see "main" listed without [protected]
      // and assume it can be removed by clean.
      await renderAnnotatedList([], 'main');

      const mainLine = logLines.find((line) => line.includes('[main]'));
      assertStringIncludes(mainLine ?? '', '[protected]');
    } finally {
      console.log = origLog;
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('renderAnnotatedList - does not annotate unprotected branch', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-branch', 'feat-branch');

    const cwd = new TempCwd(repo.path);
    const logLines: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logLines.push(args.map(String).join(' '));
    };

    try {
      // feat-branch is not in the user-protected list, and not system-protected
      await renderAnnotatedList([], 'main');

      // Find the feat-branch line specifically
      const featLine = logLines.find((line) => line.includes('feat-branch'));
      // It should not have [protected]
      assertEquals(featLine !== undefined, true);
      assertEquals(featLine?.includes('[protected]'), false);
    } finally {
      console.log = origLog;
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

// ── executeList integration ─────────────────────────────────────────────────

Deno.test('list command - lists all worktrees', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-1', 'feat-1');
    await repo.createWorktree('feat-2', 'feat-2');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // executeList should not throw
      await executeList([]);
      await _drainAutoClean();
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('list command - handles --porcelain flag (raw proxy)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-1', 'feat-1');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should fall back to raw proxy without throwing
      await executeList(['--porcelain']);
      await _drainAutoClean();
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('list command - handles -v flag (raw proxy)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeList(['-v']);
      await _drainAutoClean();
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('list command - works with no worktrees (just main)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeList([]);
      await _drainAutoClean();
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('list command - shows help and exits 0', async () => {
  const { exitCode } = await withMockedExit(() => executeList(['--help']));
  assertEquals(exitCode, 0);
});

Deno.test('list command - shows [protected] tag for user-protected branch', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('staging', 'staging');

    const config = { ...createMinimalConfig(repo.path), protectedBranches: ['staging'] };
    await writeTestConfig(repo.path, config);

    const logLines: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logLines.push(args.map(String).join(' '));
    };

    const cwd = new TempCwd(repo.path);
    try {
      await executeList([]);
      await _drainAutoClean();

      const stagingLine = logLines.find((line) => line.includes('staging'));
      assertStringIncludes(stagingLine ?? '', '[protected]');
    } finally {
      console.log = origLog;
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('list command - shows [protected] from any worktree, not just the cwd worktree', async () => {
  // Cross-worktree visibility regression: `gw protect` writes the list to the
  // git-root config. `gw ls` run from a different worktree must read that
  // same canonical list — otherwise the tag disappears when the user navigates
  // away from the worktree where they ran `gw protect`.
  const repo = new GitTestRepo();
  try {
    await repo.init();
    // Protection lives in the git-root config (single source of truth).
    const rootConfig = { ...createMinimalConfig(repo.path), protectedBranches: ['staging'] };
    await writeTestConfig(repo.path, rootConfig);

    await repo.createWorktree('staging', 'staging');
    // Sibling worktree without staging in its local config — the cwd for the test.
    const siblingPath = await repo.createWorktree('feat-y', 'feat-y');
    await writeTestConfig(siblingPath, createMinimalConfig(siblingPath));

    const logLines: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logLines.push(args.map(String).join(' '));
    };

    const cwd = new TempCwd(siblingPath);
    try {
      await executeList([]);
      await _drainAutoClean();

      const stagingLine = logLines.find((line) => line.includes('[staging]'));
      assertStringIncludes(stagingLine ?? '', '[protected]');
    } finally {
      console.log = origLog;
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
