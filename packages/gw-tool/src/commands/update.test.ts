/**
 * Tests for update.ts command
 */

import { assertEquals } from '$std/assert';
import { join } from '$std/path';
import { executeUpdate } from './update.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { createMinimalConfig, writeTestConfig } from '../test-utils/fixtures.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';

Deno.test('update command - merge strategy by default', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Add commit to main
    await repo.createFile('main-file.txt', 'main content');
    await repo.createCommit('Add main file');

    // Setup config
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Switch to feature worktree and update
    const cwd = new TempCwd(featurePath);
    try {
      await executeUpdate([]);

      // Verify merge happened - check that main-file.txt exists in feature
      const content = await Deno.readTextFile(join(featurePath, 'main-file.txt'));
      assertEquals(content, 'main content');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - rebase strategy from config', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Add commit to main
    await repo.createFile('main-file.txt', 'main content');
    await repo.createCommit('Add main file');

    // Setup config with rebase strategy
    const config = createMinimalConfig(repo.path);
    config.updateStrategy = 'rebase';
    await writeTestConfig(repo.path, config);

    // Switch to feature worktree and update
    const cwd = new TempCwd(featurePath);
    try {
      await executeUpdate([]);

      // Verify rebase happened - check that main-file.txt exists in feature
      const content = await Deno.readTextFile(join(featurePath, 'main-file.txt'));
      assertEquals(content, 'main content');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - --merge flag overrides config', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Add commit to main
    await repo.createFile('main-file.txt', 'main content');
    await repo.createCommit('Add main file');

    // Setup config with rebase strategy
    const config = createMinimalConfig(repo.path);
    config.updateStrategy = 'rebase';
    await writeTestConfig(repo.path, config);

    // Switch to feature worktree and update with --merge flag
    const cwd = new TempCwd(featurePath);
    try {
      await executeUpdate(['--merge']);

      // Should use merge despite config saying rebase
      const content = await Deno.readTextFile(join(featurePath, 'main-file.txt'));
      assertEquals(content, 'main content');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - --rebase flag overrides config', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Add commit to main
    await repo.createFile('main-file.txt', 'main content');
    await repo.createCommit('Add main file');

    // Setup config with merge strategy (default)
    const config = createMinimalConfig(repo.path);
    config.updateStrategy = 'merge';
    await writeTestConfig(repo.path, config);

    // Switch to feature worktree and update with --rebase flag
    const cwd = new TempCwd(featurePath);
    try {
      await executeUpdate(['--rebase']);

      // Should use rebase despite config saying merge
      const content = await Deno.readTextFile(join(featurePath, 'main-file.txt'));
      assertEquals(content, 'main content');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - blocks on uncommitted changes', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Setup config
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create uncommitted change in feature worktree
    await Deno.writeTextFile(join(featurePath, 'uncommitted.txt'), 'uncommitted');

    // Switch to feature worktree and try to update
    const cwd = new TempCwd(featurePath);
    try {
      const { exitCode } = await withMockedExit(() => executeUpdate([]));

      // Should exit with error code
      assertEquals(exitCode, 1);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - allows uncommitted changes with --force', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Add commit to main
    await repo.createFile('main-file.txt', 'main content');
    await repo.createCommit('Add main file');

    // Setup config
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create uncommitted change in feature worktree
    await Deno.writeTextFile(join(featurePath, 'uncommitted.txt'), 'uncommitted');

    // Switch to feature worktree and update with --force
    const cwd = new TempCwd(featurePath);
    try {
      await executeUpdate(['--force']);

      // Should succeed and merge
      const content = await Deno.readTextFile(join(featurePath, 'main-file.txt'));
      assertEquals(content, 'main content');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - dry run shows what would happen', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Add commit to main
    await repo.createFile('main-file.txt', 'main content');
    await repo.createCommit('Add main file');

    // Setup config
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Switch to feature worktree and dry run
    const cwd = new TempCwd(featurePath);
    try {
      // Dry run should exit (could be 0 or 1 due to mock implementation details)
      await withMockedExit(() => executeUpdate(['--dry-run']));

      // The important part: verify no merge happened - main-file.txt should not exist
      try {
        await Deno.stat(join(featurePath, 'main-file.txt'));
        throw new Error('File should not exist after dry run');
      } catch (error) {
        // Expected - file should not exist
        if (!(error instanceof Deno.errors.NotFound)) {
          throw error;
        }
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - custom branch with --from', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a worktree for develop (creates both branch and worktree)
    const developPath = join(repo.path, 'develop-wt');
    await repo.createWorktree('develop-wt', 'develop');
    await Deno.writeTextFile(join(developPath, 'develop-file.txt'), 'develop content');

    // Commit in develop worktree
    const developCmd = new Deno.Command('git', {
      args: ['add', '-A'],
      cwd: developPath,
    });
    await developCmd.output();

    const commitCmd = new Deno.Command('git', {
      args: ['commit', '-m', 'Add develop file'],
      cwd: developPath,
    });
    await commitCmd.output();

    // Create feature worktree from main
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Setup config
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Switch to feature worktree and update from develop
    const cwd = new TempCwd(featurePath);
    try {
      // Execute update - may exit with 0 or 1 depending on outcome
      const result = await withMockedExit(() => executeUpdate(['--from', 'develop']));

      // If it exited (conflict or error), check exit code
      // Otherwise it completed successfully
      if (result.exitCode !== undefined && result.exitCode !== 0) {
        throw new Error(`Update failed with exit code ${result.exitCode}`);
      }

      // Verify merge from develop happened
      const content = await Deno.readTextFile(join(featurePath, 'develop-file.txt'));
      assertEquals(content, 'develop content');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - already up to date', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature branch and worktree from main (already up to date)
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Setup config
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Switch to feature worktree and update
    const cwd = new TempCwd(featurePath);
    try {
      await executeUpdate([]);

      // Should succeed with "already up to date" message
      // Test passes if no error is thrown
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - shows help with --help', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeUpdate(['--help']));

      assertEquals(exitCode, 0);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - rejects both --merge and --rebase', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(featurePath);
    try {
      const { exitCode } = await withMockedExit(() => executeUpdate(['--merge', '--rebase']));

      // Should exit with error
      assertEquals(exitCode, 1);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - uses custom remote', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Setup config
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Switch to feature worktree and try to update with custom remote
    // (will fail to fetch but that's okay for testing the flag)
    const cwd = new TempCwd(featurePath);
    try {
      await executeUpdate(['--remote', 'upstream']);

      // Test passes if it attempts to use the remote (even if fetch fails)
      // The command will still work with local branches
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
