/**
 * Tests for add.ts command - the most critical command
 */

import { assertEquals, assertRejects } from '$std/assert';
import { join } from '$std/path';
import { executeAdd } from './add.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import {
  createConfigWithAutoCopy,
  createConfigWithHooks,
  createMinimalConfig,
  writeTestConfig,
} from '../test-utils/fixtures.ts';
import {
  assertBranchExists,
  assertFileContent,
  assertFileExists,
  assertWorktreeExists,
} from '../test-utils/assertions.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';
import { withMockedPrompt } from '../test-utils/mock-prompt.ts';

Deno.test('add command - creates worktree with auto-branch creation', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(['feat-branch']);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, 'feat-branch');

      // Verify branch was created
      await assertBranchExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - creates worktree with slash in name', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(['feat/new-feature']);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, 'feat/new-feature');

      // Verify branch was created
      await assertBranchExists(repo.path, 'feat/new-feature');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - copies auto-copy files from config', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create files to auto-copy
    await repo.createFile('.env', 'SECRET=test123');
    await repo.createFile('secrets/key.txt', 'KEY=abc');
    await repo.createCommit('Add secrets');

    const config = createConfigWithAutoCopy(repo.path, ['.env', 'secrets/']);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(['feat-branch']);

      // Verify files were copied to new worktree
      const worktreePath = join(repo.path, 'feat-branch');
      await assertFileExists(join(worktreePath, '.env'));
      await assertFileExists(join(worktreePath, 'secrets/key.txt'));
      await assertFileContent(join(worktreePath, '.env'), 'SECRET=test123');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - explicit files override auto-copy config', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create files but DON'T commit .env (so it won't be in git checkout)
    await repo.createFile('committed.txt', 'in git');
    await repo.createCommit('Add committed file');

    // Create .env and custom.txt AFTER the commit (not in git)
    await repo.createFile('.env', 'SECRET=test123');
    await repo.createFile('custom.txt', 'custom content');

    const config = createConfigWithAutoCopy(repo.path, ['.env']);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Pass explicit file, should ignore .env from config
      await executeAdd(['feat-branch', 'custom.txt']);

      const worktreePath = join(repo.path, 'feat-branch');

      // custom.txt should be copied
      await assertFileExists(join(worktreePath, 'custom.txt'));
      await assertFileContent(join(worktreePath, 'custom.txt'), 'custom content');

      // .env should NOT be copied (overridden by explicit file list)
      try {
        await Deno.stat(join(worktreePath, '.env'));
        throw new Error('.env should not have been copied');
      } catch (error) {
        assertEquals(error instanceof Deno.errors.NotFound, true);
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - handles leftover directories gracefully', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a leftover directory that's not a valid worktree
    const leftoverPath = join(repo.path, 'feat-branch');
    await Deno.mkdir(leftoverPath);
    await Deno.writeTextFile(join(leftoverPath, 'dummy.txt'), 'test');

    const cwd = new TempCwd(repo.path);
    try {
      // Should automatically clean up leftover and create worktree
      await executeAdd(['feat-branch']);

      // Verify worktree was created successfully
      await assertWorktreeExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - creates worktree with explicit -b flag', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Create worktree with explicit branch name different from worktree name
      await executeAdd(['worktree-name', '-b', 'custom-branch']);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, 'worktree-name');

      // Verify custom branch was created
      await assertBranchExists(repo.path, 'custom-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - detects ref conflicts (branch vs branch/foo)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch that will conflict
    await repo.createBranch('test/foo');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to create "test" branch - should fail due to conflict with "test/foo"
      const { exitCode } = await withMockedExit(() => executeAdd(['test']));

      // Should have exited with error code
      assertEquals(exitCode, 1, 'Should exit with code 1 on ref conflict');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - detects ref conflicts (branch/foo vs branch)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch that will conflict
    await repo.createBranch('test');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to create "test/foo" branch - should fail due to conflict with "test"
      const { exitCode } = await withMockedExit(() => executeAdd(['test/foo']));

      // Should have exited with error code
      assertEquals(exitCode, 1, 'Should exit with code 1 on ref conflict');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - executes pre-add hooks successfully', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a hook that creates a marker file
    const markerPath = join(repo.path, 'hook-ran.txt');
    const hook = `echo "Hook executed" > "${markerPath}"`;

    const config = createConfigWithHooks(repo.path, [hook]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(['feat-branch']);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, 'feat-branch');

      // Verify pre-add hook ran
      await assertFileExists(markerPath);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - aborts on pre-add hook failure', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a hook that fails
    const hook = 'exit 1';

    const config = createConfigWithHooks(repo.path, [hook]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should abort due to hook failure
      const { exitCode } = await withMockedExit(() => executeAdd(['feat-branch']));

      // Should have exited with error code
      assertEquals(exitCode, 1, 'Should exit with code 1 on hook failure');

      // Verify worktree was NOT created
      const worktrees = await repo.listWorktrees();
      assertEquals(
        worktrees.some((wt) => wt.includes('feat-branch')),
        false
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - executes post-add hooks successfully', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a hook that creates a marker file in the new worktree
    const hook = 'echo "Post hook ran" > post-hook.txt';

    const config = createConfigWithHooks(repo.path, undefined, [hook]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(['feat-branch']);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, 'feat-branch');

      // Verify post-add hook ran in the new worktree
      const worktreePath = join(repo.path, 'feat-branch');
      await assertFileExists(join(worktreePath, 'post-hook.txt'));
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - continues on post-add hook failure', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a hook that fails
    const hook = 'exit 1';

    const config = createConfigWithHooks(repo.path, undefined, [hook]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should continue despite hook failure
      await executeAdd(['feat-branch']);

      // Verify worktree was still created (post-add hook failure doesn't abort)
      await assertWorktreeExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - uses existing branch if it exists', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch first
    await repo.createBranch('existing-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should use existing branch instead of creating a new one
      await executeAdd(['existing-branch']);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, 'existing-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - uses existing branch with slashes correctly', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch with slashes first
    await repo.createBranch('test/sb-vite');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should use existing branch "test/sb-vite", not infer "sb-vite" from path basename
      await executeAdd(['test/sb-vite']);

      // Verify worktree directory was created
      const worktreePath = join(repo.path, 'test/sb-vite');
      const stat = await Deno.stat(worktreePath);
      assertEquals(stat.isDirectory, true, 'Worktree directory should exist');

      // Verify the correct branch was checked out (test/sb-vite, not sb-vite)
      await assertBranchExists(repo.path, 'test/sb-vite');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - respects custom defaultBranch in config', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a custom default branch
    await repo.createBranch('develop');

    const config = {
      root: repo.path,
      defaultBranch: 'develop',
      cleanThreshold: 7,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should create new branch from "develop" instead of "main"
      await executeAdd(['feat-branch']);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - prompts to navigate when worktree already exists (yes)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // First create the worktree
      await executeAdd(['feat-branch']);
      await assertWorktreeExists(repo.path, 'feat-branch');

      const home = Deno.env.get('HOME') || '';
      const navFile = join(home, '.gw', 'tmp', 'last-nav');

      // Clean up any existing nav file
      try {
        await Deno.remove(navFile);
      } catch {
        // File might not exist
      }

      // Try to add again - should prompt and write navigation file
      const { exitCode } = await withMockedPrompt(['y'], () => withMockedExit(() => executeAdd(['feat-branch'])));

      // Should exit with code 0 (success - navigating)
      assertEquals(exitCode, 0, 'Should exit with code 0 when navigating');

      // Verify navigation file was created
      const navFileExists = await Deno.stat(navFile)
        .then(() => true)
        .catch(() => false);
      assertEquals(navFileExists, true, 'Should create navigation marker file');

      // Clean up
      try {
        await Deno.remove(navFile);
      } catch {
        // Ignore cleanup errors
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - prompts to navigate when worktree already exists (default yes - empty)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // First create the worktree
      await executeAdd(['feat-branch']);
      await assertWorktreeExists(repo.path, 'feat-branch');

      const home = Deno.env.get('HOME') || '';
      const navFile = join(home, '.gw', 'tmp', 'last-nav');

      // Clean up any existing nav file
      try {
        await Deno.remove(navFile);
      } catch {
        // File might not exist
      }

      // Try to add again - should prompt and accept empty as yes (default)
      const { exitCode } = await withMockedPrompt([''], () => withMockedExit(() => executeAdd(['feat-branch'])));

      // Should exit with code 0 (success - navigating)
      assertEquals(exitCode, 0, 'Should exit with code 0 when navigating');

      // Verify navigation file was created
      const navFileExists = await Deno.stat(navFile)
        .then(() => true)
        .catch(() => false);
      assertEquals(navFileExists, true, 'Should create navigation marker file for default yes');

      // Clean up
      try {
        await Deno.remove(navFile);
      } catch {
        // Ignore cleanup errors
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - prompts to navigate when worktree already exists (no)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // First create the worktree
      await executeAdd(['feat-branch']);
      await assertWorktreeExists(repo.path, 'feat-branch');

      // Capture stdout to check for navigation marker
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      };

      // Try to add again - decline navigation
      const { exitCode } = await withMockedPrompt(['n'], () => withMockedExit(() => executeAdd(['feat-branch'])));

      console.log = originalLog;

      // Should exit with code 0 (cancelled, not an error)
      assertEquals(exitCode, 0, 'Should exit with code 0 when cancelled');

      // Verify NO navigation marker was output
      const hasNavigateMarker = logs.some((log) => log.includes('__GW_NAVIGATE__:'));
      assertEquals(hasNavigateMarker, false, 'Should NOT output navigation marker when declined');

      // Verify cancellation message was shown
      const hasCancelledMessage = logs.some((log) => log.includes('cancelled'));
      assertEquals(hasCancelledMessage, true, 'Should show cancelled message');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - creates branch from specified --from branch', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createBranch('develop');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(['feat-branch', '--from', 'develop']);

      await assertWorktreeExists(repo.path, 'feat-branch');
      await assertBranchExists(repo.path, 'feat-branch');

      // Verify remote tracking points to feat-branch, not develop
      const worktreePath = join(repo.path, 'feat-branch');
      const remoteCmd = new Deno.Command('git', {
        args: ['-C', worktreePath, 'config', 'branch.feat-branch.remote'],
        stdout: 'piped',
      });
      const remoteResult = await remoteCmd.output();
      assertEquals(new TextDecoder().decode(remoteResult.stdout).trim(), 'origin');

      const mergeCmd = new Deno.Command('git', {
        args: ['-C', worktreePath, 'config', 'branch.feat-branch.merge'],
        stdout: 'piped',
      });
      const mergeResult = await mergeCmd.output();
      assertEquals(new TextDecoder().decode(mergeResult.stdout).trim(), 'refs/heads/feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - supports --from=branch equals syntax', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createBranch('develop');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(['feat-branch', '--from=develop']);

      await assertWorktreeExists(repo.path, 'feat-branch');
      await assertBranchExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("add command - --from errors when source branch doesn't exist", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeAdd(['feat-branch', '--from', 'non-existent']));

      assertEquals(exitCode, 1, "Should exit with code 1 when source branch doesn't exist");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - --from overrides defaultBranch config', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createBranch('develop');
    await repo.createBranch('feature-base');

    const config = {
      root: repo.path,
      defaultBranch: 'develop',
      cleanThreshold: 7,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Even though defaultBranch is develop, --from should override it
      await executeAdd(['feat-branch', '--from', 'feature-base']);

      await assertWorktreeExists(repo.path, 'feat-branch');
      await assertBranchExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - --from ignored when branch already exists', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createBranch('develop');
    await repo.createBranch('existing-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Branch already exists, so --from should be ignored
      await executeAdd(['existing-branch', '--from', 'develop']);

      // Should still create worktree successfully
      await assertWorktreeExists(repo.path, 'existing-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - --from works with branch names containing slashes', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createBranch('feat/parent');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(['feat/child', '--from', 'feat/parent']);

      await assertWorktreeExists(repo.path, 'feat/child');
      await assertBranchExists(repo.path, 'feat/child');

      // Verify remote tracking points to feat/child, not feat/parent
      const worktreePath = join(repo.path, 'feat/child');
      const mergeCmd = new Deno.Command('git', {
        args: ['-C', worktreePath, 'config', 'branch.feat/child.merge'],
        stdout: 'piped',
      });
      const mergeResult = await mergeCmd.output();
      assertEquals(new TextDecoder().decode(mergeResult.stdout).trim(), 'refs/heads/feat/child');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - uses local branch directly when it exists', async () => {
  // This test verifies that when a local branch exists, the command
  // uses it directly without trying to fetch
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a local branch
    await repo.createBranch('existing-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Capture console output to verify behavior
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(['existing-branch']);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, 'existing-branch');

      // Verify it used the local branch directly (no fetch attempt)
      const hasLocalMessage = logs.some((log) => log.includes('Using existing local branch'));
      assertEquals(hasLocalMessage, true, 'Should indicate using existing local branch');
    } finally {
      cwd.restore();
      console.log = originalLog;
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - gracefully handles offline fallback for existing branches', async () => {
  // This test verifies that when fetching fails (no remote), the command
  // gracefully falls back to using the local branch
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch first (no remote configured, so fetch will fail)
    await repo.createBranch('offline-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should succeed despite no remote
      await executeAdd(['offline-branch']);

      // Verify worktree was created using local branch
      await assertWorktreeExists(repo.path, 'offline-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('add command - creates local tracking branch from remote-only branch', async () => {
  // Set up a repo with a remote to test remote-only branch case
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

    // Create a branch on remote only (via a clone, then delete local branch)
    const cloneDir = Deno.makeTempDirSync({ prefix: 'gw-test-clone-' });
    try {
      await localRepo.runCommand('git', ['clone', remoteRepo.path, cloneDir]);
      await localRepo.runCommand('git', ['-C', cloneDir, 'config', 'user.email', 'test@example.com']);
      await localRepo.runCommand('git', ['-C', cloneDir, 'config', 'user.name', 'Test User']);
      await localRepo.runCommand('git', ['-C', cloneDir, 'config', 'commit.gpgsign', 'false']);
      await localRepo.runCommand('git', ['-C', cloneDir, 'checkout', '-b', 'remote-only-branch']);
      await localRepo.runCommand('git', ['-C', cloneDir, 'commit', '--allow-empty', '-m', 'Remote only commit']);
      await localRepo.runCommand('git', ['-C', cloneDir, 'push', 'origin', 'remote-only-branch']);
    } finally {
      await Deno.remove(cloneDir, { recursive: true });
    }

    // Fetch to update remote tracking refs (so we know about origin/remote-only-branch)
    await localRepo.runCommand('git', ['fetch', 'origin'], localRepo.path);

    const config = createMinimalConfig(localRepo.path);
    await writeTestConfig(localRepo.path, config);

    const cwd = new TempCwd(localRepo.path);
    try {
      await executeAdd(['remote-only-branch']);

      // Verify worktree was created
      await assertWorktreeExists(localRepo.path, 'remote-only-branch');

      // Verify local branch was created
      await assertBranchExists(localRepo.path, 'remote-only-branch');

      // Verify the worktree has the remote commit
      const worktreePath = join(localRepo.path, 'remote-only-branch');
      const logCmd = new Deno.Command('git', {
        args: ['-C', worktreePath, 'log', '--oneline', '-1'],
        stdout: 'piped',
      });
      const logResult = await logCmd.output();
      const lastCommit = new TextDecoder().decode(logResult.stdout).trim();

      // Should have the "Remote only commit" as HEAD
      assertEquals(lastCommit.includes('Remote only commit'), true, 'Should have the remote commit');
    } finally {
      cwd.restore();
    }
  } finally {
    await remoteRepo.cleanup();
    await localRepo.cleanup();
  }
});
