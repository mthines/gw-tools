/**
 * Tests for remove.ts command
 */

import { assertEquals } from '@std/assert';
import { join } from '@std/path';
import { executeRemove } from './remove.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { createMinimalConfig, writeTestConfig } from '../test-utils/fixtures.ts';
import { assertPathNotExists, assertWorktreeExists, assertWorktreeNotExists } from '../test-utils/assertions.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';
import { withMockedPrompt } from '../test-utils/mock-prompt.ts';
import { assertShellRemoveNavigationWorks } from '../test-utils/assert-shell-nav.ts';

Deno.test('remove command - removes worktree with --yes flag', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-branch', 'feat-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove with --yes to skip confirmation
      await executeRemove(['--yes', 'feat-branch']);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - removes worktree with -y flag', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-branch', 'feat-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove with -y shorthand
      await executeRemove(['-y', 'feat-branch']);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - automatically removes leftover directory', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a leftover directory (not a valid worktree)
    const leftoverPath = join(repo.path, 'leftover');
    await Deno.mkdir(leftoverPath);
    await Deno.writeTextFile(join(leftoverPath, 'test.txt'), 'content');

    const cwd = new TempCwd(repo.path);
    try {
      // Should automatically remove leftover directory without prompting
      await executeRemove(['leftover']);

      // Verify directory was removed
      await assertPathNotExists(leftoverPath);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - exits with error for non-existent worktree', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should exit with error
      const { exitCode } = await withMockedExit(() => executeRemove(['--yes', 'non-existent']));

      // Should have exited with error code
      assertEquals(exitCode, 1, 'Should exit with code 1 for non-existent worktree');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - handles worktree with slash in name', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a worktree with slash in name
    await repo.createWorktree('feat/new-feature', 'feat/new-feature');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeRemove(['--yes', 'feat/new-feature']);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, 'feat/new-feature');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - removes clean worktree without prompting', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-branch', 'feat-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove without --yes flag
      // Should succeed without prompting because worktree is clean (no uncommitted changes, no unpushed commits)
      await executeRemove(['feat-branch']);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - removes worktree with --force flag without prompting', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-branch', 'feat-branch');

    // Add uncommitted changes to make worktree "dirty"
    const worktreePath = join(repo.path, 'feat-branch');
    await Deno.writeTextFile(join(worktreePath, 'test.txt'), 'uncommitted change');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove with --force flag
      // Should succeed without prompting even though worktree is dirty
      await executeRemove(['--force', 'feat-branch']);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, 'feat-branch');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - suggests similar matches when exact match not found', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create worktrees with paths that contain "tmp" but aren't exact matches
    await repo.createWorktree('tmp-1', 'tmp-1');
    await repo.createWorktree('tmp-2', 'tmp-2');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to remove "tmp" which doesn't exist, but tmp-1 and tmp-2 do
      // Should suggest similar matches
      const { exitCode } = await withMockedExit(() => executeRemove(['tmp']));

      // Should exit with error code 1 (no exact match)
      assertEquals(exitCode, 1, 'Should exit with error when no exact match found');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - does not delete parent directory containing worktrees', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create worktrees in a subdirectory structure: tmp/1 and tmp/2
    const tmpDir = join(repo.path, 'tmp');
    await Deno.mkdir(tmpDir);

    await repo.createWorktree('tmp/1', 'tmp-1');
    await repo.createWorktree('tmp/2', 'tmp-2');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to remove "tmp" which is a directory containing worktrees
      // Should NOT delete the directory, should suggest the worktrees instead
      const { exitCode } = await withMockedExit(() => executeRemove(['tmp']));

      // Should exit with error code 1
      assertEquals(exitCode, 1, 'Should exit with error when trying to remove parent directory');

      // Verify the tmp directory still exists
      const tmpExists = await Deno.stat(tmpDir)
        .then(() => true)
        .catch(() => false);
      assertEquals(tmpExists, true, 'Parent directory should still exist');

      // Verify the worktrees still exist
      const tmp1Exists = await Deno.stat(join(tmpDir, '1'))
        .then(() => true)
        .catch(() => false);
      const tmp2Exists = await Deno.stat(join(tmpDir, '2'))
        .then(() => true)
        .catch(() => false);
      assertEquals(tmp1Exists, true, 'Worktree tmp/1 should still exist');
      assertEquals(tmp2Exists, true, 'Worktree tmp/2 should still exist');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - dirty-worktree prompt defaults to yes (empty Enter proceeds)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-dirty', 'feat-dirty');

    // Make the worktree dirty (uncommitted change)
    const worktreePath = join(repo.path, 'feat-dirty');
    await Deno.writeTextFile(join(worktreePath, 'uncommitted.txt'), 'dirty');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // User just hits Enter at the data-loss prompt — default should be yes
      await withMockedPrompt([''], () => executeRemove(['feat-dirty']));

      await assertWorktreeNotExists(repo.path, 'feat-dirty');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - parent-of-worktrees error suggests a glob pattern', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const tmpDir = join(repo.path, 'tmp');
    await Deno.mkdir(tmpDir);
    await repo.createWorktree('tmp/1', 'tmp-1');
    await repo.createWorktree('tmp/2', 'tmp-2');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Capture stdout to inspect the suggestion
      const originalLog = console.log;
      const captured: string[] = [];
      console.log = (...args: unknown[]) => {
        captured.push(args.map(String).join(' '));
      };

      try {
        await withMockedExit(() => executeRemove(['tmp']));
      } finally {
        console.log = originalLog;
      }

      const output = captured.join('\n');
      const suggestsGlob = output.includes('gw rm tmp/*');
      assertEquals(suggestsGlob, true, `Expected the error to suggest a glob pattern. Got:\n${output}`);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test(
  'remove command - trailing slash on parent directory is treated as parent-of-worktrees, not leftover',
  async () => {
    const repo = new GitTestRepo();
    try {
      await repo.init();

      const tmpDir = join(repo.path, 'tmp');
      await Deno.mkdir(tmpDir);
      await repo.createWorktree('tmp/1', 'tmp-1');
      await repo.createWorktree('tmp/2', 'tmp-2');

      const config = createMinimalConfig(repo.path);
      await writeTestConfig(repo.path, config);

      const cwd = new TempCwd(repo.path);
      try {
        // 'tmp/' (with trailing slash) used to bypass the parent-of-worktrees guard
        // and attempt to remove tmp/ as a leftover directory, taking the worktrees with it.
        const { exitCode } = await withMockedExit(() => executeRemove(['tmp/']));

        // Should exit with error (parent-of-worktrees path), not silently remove.
        assertEquals(exitCode, 1, 'Should refuse to remove parent directory containing worktrees');

        // Worktrees must still be there
        const tmp1Exists = await Deno.stat(join(tmpDir, '1'))
          .then(() => true)
          .catch(() => false);
        assertEquals(tmp1Exists, true, 'tmp/1 should survive');
      } finally {
        cwd.restore();
      }
    } finally {
      await repo.cleanup();
    }
  }
);

Deno.test('remove command - prevents removal of default branch', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create develop worktree and set it as default
    await repo.createWorktree('develop', 'develop');

    const config = {
      root: repo.path,
      defaultBranch: 'develop',
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to remove the default branch worktree
      const { exitCode } = await withMockedExit(() => executeRemove(['develop']));

      // Should exit with error code 1
      assertEquals(exitCode, 1, 'Should exit with error when trying to remove default branch');

      // Verify develop worktree still exists
      const worktrees = await repo.listWorktrees();
      const hasDevelop = worktrees.some((wt) => wt.includes('develop'));
      assertEquals(hasDevelop, true, 'Default branch worktree should not be removed');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - prevents removal of gw_root', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create gw_root worktree
    await repo.createWorktree('gw_root', 'gw_root');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to remove the gw_root worktree
      const { exitCode } = await withMockedExit(() => executeRemove(['gw_root']));

      // Should exit with error code 1
      assertEquals(exitCode, 1, 'Should exit with error when trying to remove gw_root');

      // Verify gw_root worktree still exists
      const worktrees = await repo.listWorktrees();
      const hasGwRoot = worktrees.some((wt) => wt.includes('gw_root'));
      assertEquals(hasGwRoot, true, 'gw_root worktree should not be removed');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - deletes local branch by default', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-delete-branch', 'feat-delete-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove worktree without --preserve-branch
      await executeRemove(['--yes', 'feat-delete-branch']);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, 'feat-delete-branch');

      // Verify branch was also deleted
      const branchListCmd = new Deno.Command('git', {
        args: ['-C', repo.path, 'branch', '--list', 'feat-delete-branch'],
        stdout: 'piped',
      });
      const branchResult = await branchListCmd.output();
      const branchList = new TextDecoder().decode(branchResult.stdout).trim();
      assertEquals(branchList, '', 'Branch should have been deleted');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - preserves branch with --preserve-branch flag', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-keep-branch', 'feat-keep-branch');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove worktree WITH --preserve-branch
      await executeRemove(['--yes', '--preserve-branch', 'feat-keep-branch']);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, 'feat-keep-branch');

      // Verify branch was NOT deleted
      const branchListCmd = new Deno.Command('git', {
        args: ['-C', repo.path, 'branch', '--list', 'feat-keep-branch'],
        stdout: 'piped',
      });
      const branchResult = await branchListCmd.output();
      const branchList = new TextDecoder().decode(branchResult.stdout).trim();
      assertEquals(branchList.includes('feat-keep-branch'), true, 'Branch should have been preserved');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - does not delete protected branches (main)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a worktree on a non-main branch, but test that 'main' branch protection works
    // We can't easily test removing a main worktree since it's protected at worktree level too
    // So we'll verify by checking that the main branch exists after a different removal
    await repo.createWorktree('feat-test', 'feat-test');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeRemove(['--yes', 'feat-test']);

      // Verify the main branch still exists (wasn't accidentally deleted)
      const branchListCmd = new Deno.Command('git', {
        args: ['-C', repo.path, 'branch', '--list', 'main'],
        stdout: 'piped',
      });
      const branchResult = await branchListCmd.output();
      const branchList = new TextDecoder().decode(branchResult.stdout).trim();
      assertEquals(branchList.includes('main'), true, 'Main branch should still exist');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - handles unmerged branch gracefully', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-unmerged', 'feat-unmerged');

    // Make a commit in the worktree to make it "unmerged"
    const worktreePath = join(repo.path, 'feat-unmerged');
    await Deno.writeTextFile(join(worktreePath, 'new-file.txt'), 'new content');
    await repo.runCommand('git', ['-C', worktreePath, 'add', 'new-file.txt']);
    await repo.runCommand('git', ['-C', worktreePath, 'commit', '-m', 'Add new file']);

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove worktree - branch deletion should warn but not fail
      // Using --force for worktree removal but not forcing branch deletion
      await executeRemove(['--force', 'feat-unmerged']);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, 'feat-unmerged');

      // The branch might or might not be deleted depending on merge status
      // The key is that the command doesn't fail
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

// =============================================================================
// Shell integration navigation tests
// =============================================================================

Deno.test('remove - shell integration navigates to git root after removal', async () => {
  await assertShellRemoveNavigationWorks('remove');
});

Deno.test('rm - shell integration navigates to git root after removal', async () => {
  await assertShellRemoveNavigationWorks('rm');
});

// =============================================================================
// Glob pattern + multi-arg removal tests
// =============================================================================

Deno.test('remove command - glob pattern removes all matching worktrees', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('test/foo', 'test/foo');
    await repo.createWorktree('test/bar', 'test/bar');
    await repo.createWorktree('feat/keep', 'feat/keep');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // --yes skips the confirmation prompt
      await executeRemove(['--yes', 'test/*']);

      await assertWorktreeNotExists(repo.path, 'test/foo');
      await assertWorktreeNotExists(repo.path, 'test/bar');

      // feat/keep should still exist
      const worktrees = await repo.listWorktrees();
      const hasKeep = worktrees.some((wt) => wt.includes('feat/keep'));
      assertEquals(hasKeep, true, 'feat/keep worktree should still exist');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - glob with no matches exits with error', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat/foo', 'feat/foo');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeRemove(['--yes', 'nope/*']));
      assertEquals(exitCode, 1, 'Should exit with code 1 when pattern matches nothing');

      // Existing worktree untouched
      const worktrees = await repo.listWorktrees();
      assertEquals(
        worktrees.some((wt) => wt.includes('feat/foo')),
        true
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - glob skips a worktree on a protected branch', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    // master is in the protected set; create a worktree on it alongside a removable one
    await repo.createWorktree('protected-wt', 'master');
    await repo.createWorktree('feat-removable', 'feat-removable');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Pattern matches both top-level worktree names; the master one is filtered out
      await executeRemove(['--yes', '*']);

      // protected-wt should still exist; feat-removable should be gone
      const worktrees = await repo.listWorktrees();
      assertEquals(
        worktrees.some((wt) => wt.endsWith('/protected-wt')),
        true,
        'protected worktree should survive'
      );
      assertEquals(
        worktrees.some((wt) => wt.endsWith('/feat-removable')),
        false,
        'removable worktree should be gone'
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - multiple literal args remove each worktree', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-a', 'feat-a');
    await repo.createWorktree('feat-b', 'feat-b');
    await repo.createWorktree('feat-c', 'feat-c');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeRemove(['--yes', 'feat-a', 'feat-b']);

      await assertWorktreeNotExists(repo.path, 'feat-a');
      await assertWorktreeNotExists(repo.path, 'feat-b');

      // feat-c should remain
      const worktrees = await repo.listWorktrees();
      assertEquals(
        worktrees.some((wt) => wt.endsWith('/feat-c')),
        true
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - dedupes overlapping glob and literal args', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('test/foo', 'test/foo');
    await repo.createWorktree('test/bar', 'test/bar');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // 'test/*' matches both, and 'test/foo' overlaps — should not double-remove
      await executeRemove(['--yes', 'test/*', 'test/foo']);

      await assertWorktreeNotExists(repo.path, 'test/foo');
      await assertWorktreeNotExists(repo.path, 'test/bar');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - -n is a short alias for --dry-run', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-foo', 'feat-foo');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeRemove(['-n', 'feat-foo']);

      await assertWorktreeExists(repo.path, 'feat-foo');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - --dry-run with glob removes nothing', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('test/foo', 'test/foo');
    await repo.createWorktree('test/bar', 'test/bar');
    await repo.createWorktree('feat/keep', 'feat/keep');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeRemove(['--dry-run', 'test/*']);

      // Every worktree should still exist
      await assertWorktreeExists(repo.path, 'test/foo');
      await assertWorktreeExists(repo.path, 'test/bar');
      await assertWorktreeExists(repo.path, 'feat/keep');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - --dry-run leaves a literal worktree intact', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-foo', 'feat-foo');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeRemove(['--dry-run', 'feat-foo']);

      // Worktree should still exist on disk and in git's worktree list
      await assertWorktreeExists(repo.path, 'feat-foo');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('remove command - batch confirmation prompt defaults to yes (empty Enter proceeds)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feat-a', 'feat-a');
    await repo.createWorktree('feat-b', 'feat-b');

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Simulate the user just pressing Enter at the prompt
      await withMockedPrompt([''], () => executeRemove(['feat-a', 'feat-b']));

      // With default=yes, both worktrees should be removed
      await assertWorktreeNotExists(repo.path, 'feat-a');
      await assertWorktreeNotExists(repo.path, 'feat-b');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
