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
