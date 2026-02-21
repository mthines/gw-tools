/**
 * Tests for sync (copy) command
 */

import { join } from '$std/path';
import { executeCopy } from './sync.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { writeTestConfig } from '../test-utils/fixtures.ts';
import { assertFileContent, assertFileExists } from '../test-utils/assertions.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';
import type { Config } from '../lib/types.ts';

/**
 * Helper to set up a bare repo with main and feature worktrees.
 * Returns { repo, mainPath, featurePath } where mainPath is the main worktree.
 */
async function setupBareRepoWithWorktrees(
  featureName = 'feat-branch'
): Promise<{ repo: GitTestRepo; mainPath: string; featurePath: string }> {
  const repo = new GitTestRepo();
  await repo.initBare();

  // Create main worktree with an initial commit
  const mainPath = join(repo.path, 'main');
  await repo.runCommand('git', ['worktree', 'add', mainPath, '--orphan', '-b', 'main'], repo.path);
  await repo.runCommand('git', ['commit', '--allow-empty', '-m', 'Initial commit'], mainPath);

  // Create feature worktree
  const featurePath = join(repo.path, featureName);
  await repo.runCommand('git', ['worktree', 'add', '-b', featureName, featurePath, 'main'], repo.path);

  return { repo, mainPath, featurePath };
}

function createConfig(root: string, autoCopyFiles?: string[]): Config {
  return {
    root,
    defaultBranch: 'main',
    autoCopyFiles,
    cleanThreshold: 7,
  };
}

Deno.test('sync command - syncs with explicit target', async () => {
  const { repo, mainPath } = await setupBareRepoWithWorktrees();
  try {
    // Create source file in main worktree
    await Deno.writeTextFile(join(mainPath, '.env'), 'SECRET=abc');

    const config = createConfig(repo.path, ['.env']);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(mainPath);
    try {
      await executeCopy(['feat-branch']);

      await assertFileExists(join(repo.path, 'feat-branch', '.env'));
      await assertFileContent(join(repo.path, 'feat-branch', '.env'), 'SECRET=abc');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('sync command - defaults to current worktree when no target given', async () => {
  const { repo, mainPath, featurePath } = await setupBareRepoWithWorktrees();
  try {
    // Create source file in main worktree
    await Deno.writeTextFile(join(mainPath, '.env'), 'MY_SECRET=123');

    const config = createConfig(repo.path, ['.env']);
    await writeTestConfig(repo.path, config);

    // cd into the feature worktree so getCurrentWorktreePath() detects it
    const cwd = new TempCwd(featurePath);
    try {
      // No positional args — should default to current worktree
      await executeCopy([]);

      await assertFileExists(join(featurePath, '.env'));
      await assertFileContent(join(featurePath, '.env'), 'MY_SECRET=123');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('sync command - errors when no target and not in a worktree', async () => {
  const { repo } = await setupBareRepoWithWorktrees();
  try {
    const config = createConfig(repo.path, ['.env']);
    await writeTestConfig(repo.path, config);

    // cd into the bare repo root (not a worktree)
    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode, stderr } = await withMockedExit(() => executeCopy([]), {
        captureOutput: true,
      });

      if (exitCode !== 1) {
        throw new Error(`Expected exit code 1, got ${exitCode}`);
      }
      if (!stderr?.includes('Target worktree required')) {
        throw new Error(`Expected error about target worktree, got: ${stderr}`);
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('sync command - syncs with --from and no explicit target (uses current worktree)', async () => {
  const { repo, featurePath } = await setupBareRepoWithWorktrees();
  try {
    // Create a develop worktree as source
    const developPath = join(repo.path, 'develop');
    await repo.runCommand('git', ['worktree', 'add', '-b', 'develop', developPath, 'main'], repo.path);
    await Deno.writeTextFile(join(developPath, '.env'), 'FROM_DEVELOP=yes');

    const config = createConfig(repo.path, ['.env']);
    await writeTestConfig(repo.path, config);

    // cd into feat-branch worktree
    const cwd = new TempCwd(featurePath);
    try {
      // Use --from to specify source, no target arg
      await executeCopy(['--from', 'develop']);

      await assertFileExists(join(featurePath, '.env'));
      await assertFileContent(join(featurePath, '.env'), 'FROM_DEVELOP=yes');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('sync command - errors when trying to sync worktree to itself', async () => {
  const { repo, mainPath } = await setupBareRepoWithWorktrees();
  try {
    await Deno.writeTextFile(join(mainPath, '.env'), 'SECRET=abc');

    const config = createConfig(repo.path, ['.env']);
    await writeTestConfig(repo.path, config);

    // cd into main worktree and try to sync without args (source=main, target=main)
    const cwd = new TempCwd(mainPath);
    try {
      const { exitCode, stderr } = await withMockedExit(() => executeCopy([]), {
        captureOutput: true,
      });

      if (exitCode !== 1) {
        throw new Error(`Expected exit code 1, got ${exitCode}`);
      }
      if (!stderr?.includes('Cannot sync worktree to itself')) {
        throw new Error(`Expected error about syncing to self, got: ${stderr}`);
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
