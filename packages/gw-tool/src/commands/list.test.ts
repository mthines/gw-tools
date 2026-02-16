/**
 * Tests for list.ts command
 */

import { assertEquals } from '$std/assert';
import { executeList } from './list.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { createMinimalConfig, writeTestConfig } from '../test-utils/fixtures.ts';

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
      // executeList forwards to git and outputs to stdout
      // We just verify it doesn't throw an error
      await executeList([]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('list command - handles --porcelain flag', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-1', 'feat-1');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Test that --porcelain flag is passed through
      // If we got here without error, the flag was accepted
      await executeList(['--porcelain']);
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
      // Should list just the main worktree
      await executeList([]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
