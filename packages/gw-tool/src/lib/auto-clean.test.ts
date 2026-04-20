/**
 * Tests for auto-clean.ts
 */

import { assertEquals } from '@std/assert';
import { join } from '@std/path';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { createConfigWithAutoClean, writeTestConfig } from '../test-utils/fixtures.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { executeAutoClean } from './auto-clean.ts';

/**
 * Helper to make a worktree appear old by backdating
 * its .git file
 * @param worktreePath Path to the worktree
 * @param daysOld How many days old to make it
 */
async function makeWorktreeOld(worktreePath: string, daysOld: number): Promise<void> {
  const gitFilePath = join(worktreePath, '.git');
  const oldTime = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  await Deno.utime(gitFilePath, oldTime, oldTime);

  // Backdate the last commit so getWorktreeAgeDays
  // (which checks commit date) sees it as old
  const oldDate = oldTime.toISOString();
  const cmd = new Deno.Command('git', {
    args: ['-C', worktreePath, 'commit', '--allow-empty', '--amend', '--no-edit', '--date', oldDate],
    stdout: 'null',
    stderr: 'null',
    env: {
      ...Deno.env.toObject(),
      GIT_COMMITTER_DATE: oldDate,
    },
  });
  await cmd.output();
}

Deno.test('executeAutoClean - returns empty result when disabled', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = {
      defaultBranch: 'main',
      cleanThreshold: 7,
      autoClean: false,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const result = await executeAutoClean();
      assertEquals(result.removed.length, 0);
      assertEquals(result.removed, []);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('executeAutoClean - never removes defaultBranch worktree', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createConfigWithAutoClean(repo.path, 1);
    await writeTestConfig(repo.path, config);

    // Make the main worktree "old"
    // (but it should still not be cleaned)
    await makeWorktreeOld(repo.path, 10);

    const cwd = new TempCwd(repo.path);
    try {
      const result = await executeAutoClean();
      assertEquals(result.removed.length, 0);

      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(repo.path), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('executeAutoClean - removes old worktrees and returns names', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const featureWorktreePath = await repo.createWorktree('feat-old-branch', 'feat-old-branch');
    await makeWorktreeOld(featureWorktreePath, 10);

    const config = createConfigWithAutoClean(repo.path, 1);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const result = await executeAutoClean();
      assertEquals(result.removed.length, 1);
      assertEquals(result.removed, ['feat-old-branch']);

      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(featureWorktreePath), false);
      assertEquals(worktrees.includes(repo.path), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('executeAutoClean - does not remove young worktrees', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const featureWorktreePath = await repo.createWorktree('feat-young-branch', 'feat-young-branch');

    const config = createConfigWithAutoClean(repo.path, 7);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const result = await executeAutoClean();
      assertEquals(result.removed.length, 0);
      assertEquals(result.removed, []);

      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(featureWorktreePath), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('executeAutoClean - protects custom defaultBranch', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const developWorktreePath = await repo.createWorktree('develop', 'develop');
    await makeWorktreeOld(developWorktreePath, 10);

    const config = {
      defaultBranch: 'develop',
      cleanThreshold: 1,
      autoClean: true,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const result = await executeAutoClean();
      assertEquals(result.removed.length, 0);

      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(developWorktreePath), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('executeAutoClean - never removes gw_root worktree', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const gwRootPath = await repo.createWorktree('gw_root', 'gw_root');
    await makeWorktreeOld(gwRootPath, 10);

    const config = createConfigWithAutoClean(repo.path, 1);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const result = await executeAutoClean();
      assertEquals(result.removed.length, 0);

      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(gwRootPath), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('executeAutoClean - removes multiple old worktrees', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const wt1 = await repo.createWorktree('feat-alpha', 'feat-alpha');
    const wt2 = await repo.createWorktree('feat-beta', 'feat-beta');
    await makeWorktreeOld(wt1, 10);
    await makeWorktreeOld(wt2, 15);

    const config = createConfigWithAutoClean(repo.path, 1);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const result = await executeAutoClean();
      assertEquals(result.removed.length, 2);
      assertEquals(result.removed.includes('feat-alpha'), true);
      assertEquals(result.removed.includes('feat-beta'), true);

      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(wt1), false);
      assertEquals(worktrees.includes(wt2), false);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

