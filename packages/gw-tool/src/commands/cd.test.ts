/**
 * Tests for cd.ts command
 */

import { assertEquals, assertStringIncludes } from '$std/assert';
import { join } from '$std/path';
import { executeCd } from './cd.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';

Deno.test('cd command - errors when no pattern given', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeCd([]);
  });

  assertEquals(exitCode, 1);
});

Deno.test('cd command - exact branch match preferred over multi-match', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    // main worktree is already on branch 'main' at repo.path
    // Create another worktree with branch 'maintenance'
    await repo.createWorktree('maintenance-wt', 'maintenance');

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode, stdout } = await withMockedExit(
        async () => {
          await executeCd(['main']);
        },
        { captureOutput: true },
      );

      // Should resolve to the exact branch match (main), not error
      assertEquals(exitCode, undefined);
      assertEquals(stdout?.trim(), repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('cd command - non exact multi-match still errors', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('maintenance-wt', 'maintenance');

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode, stderr } = await withMockedExit(
        async () => {
          await executeCd(['mai']);
        },
        { captureOutput: true },
      );

      assertEquals(exitCode, 1);
      assertStringIncludes(stderr ?? '', 'Multiple worktrees match');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('cd command - single partial match works', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feature-abc', 'feature-abc');
    const featurePath = join(repo.path, 'feature-abc');

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode, stdout } = await withMockedExit(
        async () => {
          await executeCd(['feat']);
        },
        { captureOutput: true },
      );

      assertEquals(exitCode, undefined);
      assertEquals(stdout?.trim(), featurePath);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('cd command - errors when no match found', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feature-abc', 'feature-abc');

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode, stderr } = await withMockedExit(
        async () => {
          await executeCd(['xyz']);
        },
        { captureOutput: true },
      );

      assertEquals(exitCode, 1);
      assertStringIncludes(stderr ?? '', 'No worktree found matching: xyz');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
