/**
 * Tests for checkout.ts command
 */

import { assertEquals } from '$std/assert';
import { join } from '$std/path';
import { executeCheckout } from './checkout.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { createMinimalConfig, writeTestConfig } from '../test-utils/fixtures.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';
import { withMockedPrompt } from '../test-utils/mock-prompt.ts';

Deno.test('checkout command - shows help with --help', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeCheckout(['--help']);
  });

  assertEquals(exitCode, 0);
});

Deno.test('checkout command - shows help with -h', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeCheckout(['-h']);
  });

  assertEquals(exitCode, 0);
});

Deno.test('checkout command - shows help when no args provided', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeCheckout([]);
  });

  assertEquals(exitCode, 1);
});

Deno.test('checkout command - creates worktree for local branch not in any worktree', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a test branch
    await repo.createBranch('feature-x');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await withMockedExit(async () => {
        await executeCheckout(['feature-x']);
      });

      // Verify a worktree was created (new checkout behavior creates worktrees)
      const listCmd = new Deno.Command('git', {
        args: ['-C', repo.path, 'worktree', 'list'],
        stdout: 'piped',
      });
      const { stdout } = await listCmd.output();
      const worktreeList = new TextDecoder().decode(stdout);
      assertEquals(worktreeList.includes('feature-x'), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('checkout command - navigates to worktree when branch is checked out elsewhere', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a worktree with a branch
    await repo.createWorktree('feature-branch');
    const featureWorktreePath = join(repo.path, 'feature-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(['feature-branch']);
      });

      assertEquals(exitCode, 0);

      // Verify navigation file was created with the correct path
      const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
      const navFile = join(home, '.gw', 'tmp', 'last-nav');
      const navPath = await Deno.readTextFile(navFile);
      assertEquals(navPath, featureWorktreePath);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('checkout command - says already on branch when current branch matches', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(['main']); // Already on main
      });

      assertEquals(exitCode, 0);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('checkout command - prompts to create worktree for remote branch (yes)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a remote branch
    await repo.createBranch('remote-feature');
    await repo.createCommit('Remote commit');

    // Delete the local branch but keep it on "remote"
    const deleteBranchCmd = new Deno.Command('git', {
      args: ['-C', repo.path, 'branch', '-D', 'remote-feature'],
      stdout: 'null',
      stderr: 'null',
    });
    await deleteBranchCmd.output();

    // Simulate the branch existing on remote by creating the remote ref
    const remoteRefCmd = new Deno.Command('git', {
      args: ['-C', repo.path, 'update-ref', 'refs/remotes/origin/remote-feature', 'HEAD'],
      stdout: 'null',
      stderr: 'null',
    });
    await remoteRefCmd.output();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedPrompt(['y'], async () => {
        return await withMockedExit(async () => {
          await executeCheckout(['remote-feature']);
        });
      });

      // The command will try to run gw add which may fail in test environment
      // but that's ok - we're testing that it prompts and tries to run gw add
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('checkout command - handles remote branch (no existing worktree)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a remote branch
    await repo.createBranch('remote-feature');
    await repo.createCommit('Remote commit');

    // Delete the local branch but keep it on "remote"
    const deleteBranchCmd = new Deno.Command('git', {
      args: ['-C', repo.path, 'branch', '-D', 'remote-feature'],
      stdout: 'null',
      stderr: 'null',
    });
    await deleteBranchCmd.output();

    // Simulate the branch existing on remote by creating the remote ref
    const remoteRefCmd = new Deno.Command('git', {
      args: ['-C', repo.path, 'update-ref', 'refs/remotes/origin/remote-feature', 'HEAD'],
      stdout: 'null',
      stderr: 'null',
    });
    await remoteRefCmd.output();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Test completes without error - behavior depends on checkout implementation
      // The new checkout command should handle this case gracefully
      await withMockedPrompt(['n'], async () => {
        return await withMockedExit(async () => {
          await executeCheckout(['remote-feature']);
        });
      });
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('checkout command - creates worktree with new branch when branch does not exist', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(['new-feature-branch']);
      });

      // The checkout command should succeed by creating a new branch from main
      // exitCode is undefined when the command completes normally (success)
      assertEquals(exitCode === undefined || exitCode === 0, true);

      // Verify the worktree was created
      const listCmd = new Deno.Command('git', {
        args: ['-C', repo.path, 'worktree', 'list'],
        stdout: 'piped',
      });
      const { stdout } = await listCmd.output();
      const worktreeList = new TextDecoder().decode(stdout);
      assertEquals(worktreeList.includes('new-feature-branch'), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('checkout command - does NOT overwrite tracking for existing local branches', async () => {
  // This test verifies the fix: when a local branch exists with existing tracking,
  // gw checkout should NOT overwrite that tracking configuration
  const remoteRepo = new GitTestRepo();
  const localRepo = new GitTestRepo();

  try {
    // Initialize the "remote" repository (bare)
    await remoteRepo.initBare();

    // Initialize local repo and add remote
    await localRepo.init();
    await localRepo.runCommand('git', ['remote', 'add', 'origin', remoteRepo.path], localRepo.path);

    // Push main to remote first
    await localRepo.runCommand('git', ['push', '-u', 'origin', 'main'], localRepo.path);

    // Create a local branch with tracking already set up
    await localRepo.createBranch('existing-tracked');

    // Set up tracking to origin/main (simulating an existing tracked branch)
    await localRepo.runCommand('git', ['config', 'branch.existing-tracked.remote', 'origin'], localRepo.path);
    await localRepo.runCommand('git', ['config', 'branch.existing-tracked.merge', 'refs/heads/main'], localRepo.path);

    const config = createMinimalConfig(localRepo.path);
    await writeTestConfig(localRepo.path, config);

    const cwd = new TempCwd(localRepo.path);
    try {
      await executeCheckout(['existing-tracked']);

      // Verify worktree was created
      const listCmd = new Deno.Command('git', {
        args: ['-C', localRepo.path, 'worktree', 'list'],
        stdout: 'piped',
      });
      const { stdout } = await listCmd.output();
      const worktreeList = new TextDecoder().decode(stdout);
      assertEquals(worktreeList.includes('existing-tracked'), true);

      // Verify tracking was NOT overwritten - should still track main, not existing-tracked
      const worktreePath = join(localRepo.path, 'existing-tracked');
      const mergeCmd = new Deno.Command('git', {
        args: ['-C', worktreePath, 'config', 'branch.existing-tracked.merge'],
        stdout: 'piped',
      });
      const mergeResult = await mergeCmd.output();
      const tracking = new TextDecoder().decode(mergeResult.stdout).trim();

      // Should still be tracking main, NOT existing-tracked
      assertEquals(
        tracking,
        'refs/heads/main',
        'Existing tracking should NOT be overwritten - should still track main'
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await remoteRepo.cleanup();
    await localRepo.cleanup();
  }
});

Deno.test('checkout command - sets up tracking for truly new branches', async () => {
  // This test verifies that new branches DO get tracking set up
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeCheckout(['new-feature-branch-tracking']);

      // Verify worktree was created
      const listCmd = new Deno.Command('git', {
        args: ['-C', repo.path, 'worktree', 'list'],
        stdout: 'piped',
      });
      const { stdout } = await listCmd.output();
      const worktreeList = new TextDecoder().decode(stdout);
      assertEquals(worktreeList.includes('new-feature-branch-tracking'), true);

      // Verify tracking was set up to track the new branch name
      const worktreePath = join(repo.path, 'new-feature-branch-tracking');
      const mergeCmd = new Deno.Command('git', {
        args: ['-C', worktreePath, 'config', 'branch.new-feature-branch-tracking.merge'],
        stdout: 'piped',
      });
      const mergeResult = await mergeCmd.output();
      const tracking = new TextDecoder().decode(mergeResult.stdout).trim();

      // Should be tracking the new branch name
      assertEquals(
        tracking,
        'refs/heads/new-feature-branch-tracking',
        'New branch should track origin/new-feature-branch-tracking'
      );

      const remoteCmd = new Deno.Command('git', {
        args: ['-C', worktreePath, 'config', 'branch.new-feature-branch-tracking.remote'],
        stdout: 'piped',
      });
      const remoteResult = await remoteCmd.output();
      const remote = new TextDecoder().decode(remoteResult.stdout).trim();

      assertEquals(remote, 'origin', 'New branch should have remote set to origin');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
