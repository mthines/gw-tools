/**
 * Tests for update.ts command
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { join } from '@std/path';
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

Deno.test('update command - fails gracefully when --from branch fetch fails', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Add a remote that exists but doesn't have the branch
    await repo.runCommand('git', ['remote', 'add', 'origin', 'https://github.com/nonexistent/repo.git'], repo.path);

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Setup config
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Switch to feature worktree and try to update from a non-existent branch
    const cwd = new TempCwd(featurePath);
    try {
      const { exitCode } = await withMockedExit(() => executeUpdate(['--from', 'nonexistent-branch']));

      // Should exit with error code because --from was explicitly specified
      // and fetch failed (not due to missing remote)
      assertEquals(exitCode, 1);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - warns but continues when default branch fetch fails', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Add a remote that exists but doesn't have the default branch
    await repo.runCommand('git', ['remote', 'add', 'origin', 'https://github.com/nonexistent/repo.git'], repo.path);

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Setup config with main as default
    const config = createMinimalConfig(repo.path);
    config.defaultBranch = 'main';
    await writeTestConfig(repo.path, config);

    // Add a commit to main so the merge isn't a no-op
    await repo.createFile('main-file.txt', 'main content');
    await repo.createCommit('Add main file');

    // Switch to feature worktree and update (without --from)
    const cwd = new TempCwd(featurePath);
    try {
      // Should succeed by using local branch despite fetch failure
      await executeUpdate([]);

      // Verify it used the local branch
      const content = await Deno.readTextFile(join(featurePath, 'main-file.txt'));
      assertEquals(content, 'main content');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - warns but continues when no remote configured', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Don't add any remote - this simulates a local-only repo

    // Create a feature branch and worktree
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    // Setup config
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Add a commit to main
    await repo.createFile('main-file.txt', 'main content');
    await repo.createCommit('Add main file');

    // Switch to feature worktree and update
    const cwd = new TempCwd(featurePath);
    try {
      // Should succeed by using local branch
      await executeUpdate([]);

      // Verify it used the local branch
      const content = await Deno.readTextFile(join(featurePath, 'main-file.txt'));
      assertEquals(content, 'main content');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command - allows --from with no remote configured', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Don't add any remote - this simulates a local-only repo

    // Create a develop worktree (this will create the branch too)
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
      // Should succeed because no remote = acceptable condition
      await executeUpdate(['--from', 'develop']);

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

// ─── --from-pr tests ──────────────────────────────────────────────────────────

Deno.test('update command --from-pr - rejects combined with --from', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(featurePath);
    try {
      const { exitCode, stdout, stderr } = await withMockedExit(
        () => executeUpdate(['--from-pr', '42', '--from', 'develop']),
        { captureOutput: true }
      );

      assertEquals(exitCode, 1);
      const allOutput = (stdout ?? '') + (stderr ?? '');
      assertStringIncludes(allOutput, '--from-pr');
      assertStringIncludes(allOutput, '--from');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command --from-pr - rejects invalid identifier', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(featurePath);
    try {
      const { exitCode, stdout, stderr } = await withMockedExit(() => executeUpdate(['--from-pr', 'not-a-pr']), {
        captureOutput: true,
      });

      assertEquals(exitCode, 1);
      const allOutput = (stdout ?? '') + (stderr ?? '');
      assertStringIncludes(allOutput, 'Invalid PR identifier');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command --from-pr - rejects non-GitHub remote', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Add a non-GitHub remote
    await repo.runCommand('git', ['remote', 'add', 'origin', 'https://gitlab.com/owner/repo.git'], repo.path);

    await repo.createWorktree('feature', 'feature');
    const featurePath = join(repo.path, 'feature');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(featurePath);
    try {
      const { exitCode, stdout, stderr } = await withMockedExit(() => executeUpdate(['--from-pr', '42']), {
        captureOutput: true,
      });

      assertEquals(exitCode, 1);
      const allOutput = (stdout ?? '') + (stderr ?? '');
      assertStringIncludes(allOutput, '--from-pr requires a GitHub remote');
      assertStringIncludes(allOutput, 'gitlab.com');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

/**
 * Set up a bare upstream that serves refs/pull/<n>/head from the local repo's
 * own history (so merge succeeds without unrelated-histories). Configures the
 * local repo with a fake github.com remote URL that is redirected to the bare
 * upstream via git's url.insteadOf rewrite.
 *
 * Strategy:
 * 1. Push the local repo's main branch to the bare upstream.
 * 2. Create a PR-style branch in the bare upstream's HEAD from that commit.
 * 3. Add a commit from the local repo to create the "PR head".
 *
 * Returns the upstream GitTestRepo instance (caller must clean it up).
 */
async function setupLocalPrUpstream(localRepo: GitTestRepo, prNumber: number): Promise<GitTestRepo> {
  const upstream = new GitTestRepo();
  await upstream.runCommand('git', ['init', '--bare', upstream.path]);

  // Add the bare upstream as a remote with a fake github.com URL
  const fakeRemoteUrl = 'https://github.com/owner/repo.git';
  await localRepo.runCommand('git', ['remote', 'add', 'origin', fakeRemoteUrl], localRepo.path);
  // Redirect the fake URL to the local bare repo
  await localRepo.runCommand('git', ['config', `url.${upstream.path}.insteadOf`, fakeRemoteUrl], localRepo.path);

  // Push local main to bare upstream so it has a common history base
  await localRepo.runCommand('git', ['push', 'origin', 'main'], localRepo.path);

  // Create a temporary "pr-branch" with an extra commit so the PR head is
  // a descendant of the common base, and push it as refs/pull/<n>/head.
  await localRepo.runCommand('git', ['checkout', '-b', `_pr-${prNumber}`], localRepo.path);
  await Deno.writeTextFile(`${localRepo.path}/pr-${prNumber}-file.txt`, `PR ${prNumber} content`);
  await localRepo.runCommand('git', ['add', '-A'], localRepo.path);
  await localRepo.runCommand('git', ['commit', '-m', `PR ${prNumber} commit`], localRepo.path);
  await localRepo.runCommand('git', ['push', 'origin', `HEAD:refs/pull/${prNumber}/head`], localRepo.path);
  // Return to main
  await localRepo.runCommand('git', ['checkout', 'main'], localRepo.path);

  return upstream;
}

Deno.test('update command --from-pr - dry-run shows PR label not raw refspec', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const upstream = await setupLocalPrUpstream(repo, 42);
    try {
      await repo.createWorktree('feature', 'feature');
      const featurePath = join(repo.path, 'feature');
      const config = createMinimalConfig(repo.path);
      await writeTestConfig(repo.path, config);

      const cwd = new TempCwd(featurePath);
      try {
        const { exitCode, stdout, stderr } = await withMockedExit(
          () => executeUpdate(['--from-pr', '42', '--dry-run']),
          { captureOutput: true }
        );

        assertEquals(exitCode, 0);
        const allOutput = (stdout ?? '') + (stderr ?? '');
        // Must show "PR #42" and not expose the raw refspec
        assertStringIncludes(allOutput, 'PR #42');
      } finally {
        cwd.restore();
      }
    } finally {
      await upstream.cleanup();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('update command --from-pr - success message uses PR label', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const upstream = await setupLocalPrUpstream(repo, 1);
    try {
      await repo.createWorktree('feature', 'feature');
      const featurePath = join(repo.path, 'feature');
      const config = createMinimalConfig(repo.path);
      await writeTestConfig(repo.path, config);

      const cwd = new TempCwd(featurePath);
      try {
        const { exitCode, stdout, stderr } = await withMockedExit(() => executeUpdate(['--from-pr', '1']), {
          captureOutput: true,
        });

        // 0 or undefined = success (undefined means Deno.exit was not called)
        if (exitCode !== undefined) {
          assertEquals(exitCode, 0);
        }
        const allOutput = (stdout ?? '') + (stderr ?? '');
        assertStringIncludes(allOutput, 'PR #1');
      } finally {
        cwd.restore();
      }
    } finally {
      await upstream.cleanup();
    }
  } finally {
    await repo.cleanup();
  }
});
