/**
 * Tests for init.ts command
 */

import { assertEquals, assertRejects } from '$std/assert';
import { join } from '$std/path';
import { executeInit } from './init.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { readTestConfig } from '../test-utils/fixtures.ts';
import { assertFileExists, assertDirExists } from '../test-utils/assertions.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';
import { withMockedPrompt } from '../test-utils/mock-prompt.ts';

Deno.test('init command - creates config with auto-detected root', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit([]);

      // Verify config was created
      await assertFileExists(join(repo.path, '.gw', 'config.json'));

      // Verify config content
      const config = await readTestConfig(repo.path);
      assertEquals(config.root, repo.path);
      assertEquals(config.defaultBranch, 'main');
      assertEquals(config.cleanThreshold, 7);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - creates config with explicit root', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Run init from a different directory
    const tempDir = Deno.makeTempDirSync();
    const cwd = new TempCwd(tempDir);
    try {
      await executeInit(['--root', repo.path]);

      // Verify config was created in the specified root
      await assertFileExists(join(repo.path, '.gw', 'config.json'));

      // Verify config content
      const config = await readTestConfig(repo.path);
      assertEquals(config.root, repo.path);
    } finally {
      cwd.restore();
      await Deno.remove(tempDir, { recursive: true });
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - sets custom default branch', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(['--default-source', 'develop']);

      const config = await readTestConfig(repo.path);
      assertEquals(config.defaultBranch, 'develop');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - configures auto-copy files', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(['--auto-copy-files', '.env,secrets/,config.json']);

      const config = await readTestConfig(repo.path);
      assertEquals(config.autoCopyFiles, ['.env', 'secrets/', 'config.json']);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - configures pre-add hooks', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(['--pre-add', "echo 'Starting...'"]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.hooks?.add?.pre, ["echo 'Starting...'"]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - configures post-add hooks', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(['--post-add', 'cd {worktreePath} && pnpm install']);

      const config = await readTestConfig(repo.path);
      assertEquals(config.hooks?.add?.post, ['cd {worktreePath} && pnpm install']);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - configures multiple hooks', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit([
        '--pre-add',
        "echo 'Pre-hook 1'",
        '--pre-add',
        "echo 'Pre-hook 2'",
        '--post-add',
        "echo 'Post-hook 1'",
      ]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.hooks?.add?.pre, ["echo 'Pre-hook 1'", "echo 'Pre-hook 2'"]);
      assertEquals(config.hooks?.add?.post, ["echo 'Post-hook 1'"]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - configures clean threshold', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(['--clean-threshold', '14']);

      const config = await readTestConfig(repo.path);
      assertEquals(config.cleanThreshold, 14);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - enables auto-clean', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(['--auto-clean']);

      const config = await readTestConfig(repo.path);
      assertEquals(config.autoClean, true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - configures all options together', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit([
        '--default-source',
        'develop',
        '--auto-copy-files',
        '.env,secrets/',
        '--pre-add',
        "echo 'Pre'",
        '--post-add',
        "echo 'Post'",
        '--clean-threshold',
        '21',
        '--auto-clean',
      ]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.defaultBranch, 'develop');
      assertEquals(config.autoCopyFiles, ['.env', 'secrets/']);
      assertEquals(config.hooks?.add?.pre, ["echo 'Pre'"]);
      assertEquals(config.hooks?.add?.post, ["echo 'Post'"]);
      assertEquals(config.cleanThreshold, 21);
      assertEquals(config.autoClean, true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - fails with invalid clean threshold', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await assertRejects(
        () => executeInit(['--clean-threshold', 'invalid']),
        Error,
        '--clean-threshold must be a non-negative number'
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - fails when not in a git repo and no root specified', async () => {
  const tempDir = Deno.makeTempDirSync({ prefix: 'gw-test-notgit-' });
  try {
    const cwd = new TempCwd(tempDir);
    try {
      const { exitCode } = await withMockedExit(() => executeInit([]));

      // Should have exited with error code
      assertEquals(exitCode, 1, 'Should exit with code 1 when not in git repo');
    } finally {
      cwd.restore();
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("init command - fails when specified root doesn't exist", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    const cwd = new TempCwd(tempDir);
    try {
      const { exitCode } = await withMockedExit(() => executeInit(['--root', '/nonexistent/path']));

      // Should have exited with error code
      assertEquals(exitCode, 1, 'Should exit with code 1 for non-existent root');
    } finally {
      cwd.restore();
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// Interactive mode tests

Deno.test('init command - interactive mode with all defaults', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      // Press Enter for all prompts to accept defaults
      const responses = [
        '', // default branch (accept default "main")
        'n', // want auto-copy files
        'n', // want pre-add hooks
        'n', // want post-add hooks
        '', // clean threshold (accept default 7)
        'n', // enable auto-clean
        '', // update strategy (accept default "merge")
      ];

      await withMockedPrompt(responses, () => executeInit(['--interactive']));

      // Verify config was created with defaults
      const config = await readTestConfig(repo.path);
      assertEquals(config.defaultBranch, 'main');
      assertEquals(config.autoCopyFiles, undefined);
      assertEquals(config.hooks, undefined);
      assertEquals(config.cleanThreshold, 7);
      assertEquals(config.autoClean, undefined);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - interactive mode with custom values', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      const responses = [
        'develop', // default branch
        'y', // want auto-copy files
        '.env,.env.local,secrets/', // auto-copy files list
        'n', // want pre-add hooks
        'y', // want post-add hooks
        'pnpm install', // post-add hook 1
        '', // post-add hook 2 (blank to finish)
        '14', // clean threshold
        'y', // enable auto-clean
        'rebase', // update strategy
      ];

      await withMockedPrompt(responses, () => executeInit(['--interactive']));

      const config = await readTestConfig(repo.path);
      assertEquals(config.defaultBranch, 'develop');
      assertEquals(config.autoCopyFiles, ['.env', '.env.local', 'secrets/']);
      assertEquals(config.hooks?.add?.pre, undefined);
      assertEquals(config.hooks?.add?.post, ['pnpm install']);
      assertEquals(config.cleanThreshold, 14);
      assertEquals(config.autoClean, true);
      assertEquals(config.updateStrategy, 'rebase');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - interactive mode with multiple hooks', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      const responses = [
        '', // default branch (default)
        'n', // want auto-copy files
        'y', // want pre-add hooks
        "echo 'Pre-hook 1'", // pre-add hook 1
        "echo 'Pre-hook 2'", // pre-add hook 2
        '', // blank to finish pre-add hooks
        'y', // want post-add hooks
        'cd {worktreePath} && pnpm install', // post-add hook 1
        "echo 'Done!'", // post-add hook 2
        '', // blank to finish post-add hooks
        '', // clean threshold (default)
        'n', // enable auto-clean
        '', // update strategy (default)
      ];

      await withMockedPrompt(responses, () => executeInit(['--interactive']));

      const config = await readTestConfig(repo.path);
      assertEquals(config.hooks?.add?.pre, ["echo 'Pre-hook 1'", "echo 'Pre-hook 2'"]);
      assertEquals(config.hooks?.add?.post, ['cd {worktreePath} && pnpm install', "echo 'Done!'"]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - interactive mode with CLI flags takes precedence', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      // Try to set different values interactively, but CLI flags should win
      const responses = [
        'develop', // default branch (should be ignored, CLI has "staging")
        'y', // want auto-copy files
        '.env.test', // auto-copy files (should be ignored, CLI has ".env")
        'n', // want pre-add hooks
        'n', // want post-add hooks
        '21', // clean threshold (should be ignored, CLI has "10")
        'y', // enable auto-clean (should be ignored, no CLI flag)
        'rebase', // update strategy (should be ignored, CLI has "merge")
      ];

      await withMockedPrompt(responses, () =>
        executeInit([
          '--interactive',
          '--default-source',
          'staging',
          '--auto-copy-files',
          '.env',
          '--clean-threshold',
          '10',
          '--update-strategy',
          'merge',
        ])
      );

      const config = await readTestConfig(repo.path);
      // CLI flags should take precedence
      assertEquals(config.defaultBranch, 'staging');
      assertEquals(config.autoCopyFiles, ['.env']);
      assertEquals(config.cleanThreshold, 10);
      // autoClean not set via CLI, so interactive value should be used
      assertEquals(config.autoClean, true);
      // updateStrategy set via CLI, should take precedence
      assertEquals(config.updateStrategy, 'merge');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - interactive mode with invalid clean threshold', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      const responses = [
        '', // default branch (default)
        'n', // want auto-copy files
        'n', // want pre-add hooks
        'n', // want post-add hooks
        'invalid', // clean threshold (invalid, should use default)
        'n', // enable auto-clean
        '', // update strategy (default)
      ];

      await withMockedPrompt(responses, () => executeInit(['--interactive']));

      const config = await readTestConfig(repo.path);
      // Should fall back to default value of 7
      assertEquals(config.cleanThreshold, 7);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - interactive mode accepts 'yes' and 'y' responses", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      const responses = [
        '', // default branch (default)
        'yes', // want auto-copy files (using "yes")
        '.env', // auto-copy files
        'n', // want pre-add hooks
        'y', // want post-add hooks (using "y")
        'pnpm install', // post-add hook
        '', // blank to finish
        '', // clean threshold (default)
        'yes', // enable auto-clean (using "yes")
        '', // update strategy (default)
      ];

      await withMockedPrompt(responses, () => executeInit(['--interactive']));

      const config = await readTestConfig(repo.path);
      assertEquals(config.autoCopyFiles, ['.env']);
      assertEquals(config.hooks?.add?.post, ['pnpm install']);
      assertEquals(config.autoClean, true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - interactive mode declining all optional features', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      const responses = [
        'main', // default branch
        'n', // want auto-copy files
        'n', // want pre-add hooks
        'n', // want post-add hooks
        '7', // clean threshold
        'n', // enable auto-clean
        '', // update strategy (default)
      ];

      await withMockedPrompt(responses, () => executeInit(['--interactive']));

      const config = await readTestConfig(repo.path);
      assertEquals(config.defaultBranch, 'main');
      assertEquals(config.autoCopyFiles, undefined);
      assertEquals(config.hooks, undefined);
      assertEquals(config.cleanThreshold, 7);
      assertEquals(config.autoClean, undefined);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - interactive mode with whitespace in responses', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      const responses = [
        '  staging  ', // default branch with whitespace (should be trimmed)
        'y', // want auto-copy files
        ' .env , .env.local ', // auto-copy files with spaces (should be trimmed)
        'n', // want pre-add hooks
        'n', // want post-add hooks
        ' 10 ', // clean threshold with whitespace (should be parsed)
        'n', // enable auto-clean
        ' merge ', // update strategy with whitespace (should be trimmed)
      ];

      await withMockedPrompt(responses, () => executeInit(['--interactive']));

      const config = await readTestConfig(repo.path);
      assertEquals(config.defaultBranch, 'staging');
      assertEquals(config.autoCopyFiles, ['.env', '.env.local']);
      assertEquals(config.cleanThreshold, 10);
      assertEquals(config.updateStrategy, 'merge');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
// Clone mode tests

Deno.test('init command - clone mode with file URL', async () => {
  // Create a test repository to clone from
  const sourceRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await sourceRepo.createFile('README.md', '# Test Repo');

    // Create temp directory for clone target
    const targetDir = Deno.realPathSync(Deno.makeTempDirSync({ prefix: 'gw-test-clone-' }));
    const cwd = new TempCwd(targetDir);
    try {
      // Clone using file:// URL (simulates SSH/HTTPS in test environment)
      const cloneUrl = `file://${sourceRepo.path}`;

      // Calculate expected directory name from source repo path
      const sourceDirName = sourceRepo.path.split('/').pop();
      const expectedRepoName = `${sourceDirName}.git`;

      // Mock the shell integration prompt (respond 'n' to decline)
      await withMockedPrompt(['n'], async () => {
        await executeInit([cloneUrl]);
      });

      // Verify the repository was cloned
      const clonedRepoPath = join(targetDir, expectedRepoName);
      await assertDirExists(join(clonedRepoPath, '.git'));

      // Verify config was created
      await assertFileExists(join(clonedRepoPath, '.gw', 'config.json'));

      // Verify config content
      const config = await readTestConfig(clonedRepoPath);
      assertEquals(config.root, clonedRepoPath);

      // Verify default worktree was created (inside the repository directory)
      await assertDirExists(join(clonedRepoPath, 'main'));
    } finally {
      cwd.restore();
      await Deno.remove(targetDir, { recursive: true }).catch(() => {});
    }
  } finally {
    await sourceRepo.cleanup();
  }
});

Deno.test('init command - clone mode with custom directory', async () => {
  const sourceRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await sourceRepo.createFile('README.md', '# Test Repo');

    const targetDir = Deno.realPathSync(Deno.makeTempDirSync({ prefix: 'gw-test-clone-' }));
    const cwd = new TempCwd(targetDir);
    try {
      const cloneUrl = `file://${sourceRepo.path}`;

      // Mock the shell integration prompt (respond 'n' to decline)
      await withMockedPrompt(['n'], async () => {
        await executeInit([cloneUrl, 'custom-name']);
      });

      // Verify cloned to custom directory
      const clonedRepoPath = join(targetDir, 'custom-name');
      await assertDirExists(join(clonedRepoPath, '.git'));
      await assertFileExists(join(clonedRepoPath, '.gw', 'config.json'));

      // Verify config content
      const config = await readTestConfig(clonedRepoPath);
      assertEquals(config.root, clonedRepoPath);
    } finally {
      cwd.restore();
      await Deno.remove(targetDir, { recursive: true }).catch(() => {});
    }
  } finally {
    await sourceRepo.cleanup();
  }
});

Deno.test('init command - clone mode with configuration options', async () => {
  const sourceRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await sourceRepo.createFile('README.md', '# Test Repo');

    const targetDir = Deno.realPathSync(Deno.makeTempDirSync({ prefix: 'gw-test-clone-' }));
    const cwd = new TempCwd(targetDir);
    try {
      const cloneUrl = `file://${sourceRepo.path}`;

      // Calculate expected directory name from source repo path
      const sourceDirName = sourceRepo.path.split('/').pop();
      const expectedRepoName = `${sourceDirName}.git`;

      // Mock the shell integration prompt (respond 'n' to decline)
      await withMockedPrompt(['n'], async () => {
        await executeInit([
          cloneUrl,
          '--auto-copy-files',
          '.env,secrets/',
          '--post-add',
          'echo "installed"',
          '--clean-threshold',
          '14',
        ]);
      });

      const clonedRepoPath = join(targetDir, expectedRepoName);
      const config = await readTestConfig(clonedRepoPath);

      assertEquals(config.autoCopyFiles, ['.env', 'secrets/']);
      assertEquals(config.hooks?.add?.post, ['echo "installed"']);
      assertEquals(config.cleanThreshold, 14);
    } finally {
      cwd.restore();
      await Deno.remove(targetDir, { recursive: true }).catch(() => {});
    }
  } finally {
    await sourceRepo.cleanup();
  }
});

Deno.test('init command - clone mode fails when directory exists', async () => {
  const sourceRepo = new GitTestRepo();
  try {
    await sourceRepo.init();

    const targetDir = Deno.realPathSync(Deno.makeTempDirSync({ prefix: 'gw-test-clone-' }));
    const cwd = new TempCwd(targetDir);
    try {
      // Calculate expected directory name from source repo path
      const sourceDirName = sourceRepo.path.split('/').pop();
      const expectedRepoName = `${sourceDirName}.git`;

      // Create a directory with the target name
      const existingDir = join(targetDir, expectedRepoName);
      await Deno.mkdir(existingDir);

      const cloneUrl = `file://${sourceRepo.path}`;
      const { exitCode } = await withMockedExit(() => executeInit([cloneUrl]));

      // Should exit with error code
      assertEquals(exitCode, 1, 'Should exit with code 1 when directory exists');
    } finally {
      cwd.restore();
      await Deno.remove(targetDir, { recursive: true }).catch(() => {});
    }
  } finally {
    await sourceRepo.cleanup();
  }
});

Deno.test('init command - existing repo mode when already initialized', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      // First initialization
      await executeInit([]);

      // Verify config exists
      await assertFileExists(join(repo.path, '.gw', 'config.json'));

      // Try to initialize again (should skip with message)
      await executeInit([]);

      // Config should still exist and be unchanged
      const config = await readTestConfig(repo.path);
      assertEquals(config.root, repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('init command - interactive mode prompts for URL when not in git repo', async () => {
  const tempDir = Deno.realPathSync(Deno.makeTempDirSync({ prefix: 'gw-test-no-git-' }));
  try {
    const cwd = new TempCwd(tempDir);
    try {
      // Create a source repo to clone from
      const sourceRepo = new GitTestRepo();
      try {
        await sourceRepo.init();
        await sourceRepo.createFile('README.md', '# Test');

        // Mock prompt to provide URL
        const cloneUrl = `file://${sourceRepo.path}`;

        // Calculate expected directory name from source repo path
        const sourceDirName = sourceRepo.path.split('/').pop();
        const expectedRepoName = `${sourceDirName}.git`;

        const responses = [
          cloneUrl, // Repository URL prompt
          '', // default branch (accept default "main")
          'n', // want auto-copy files
          'n', // want pre-add hooks
          'n', // want post-add hooks
          '', // clean threshold (accept default 7)
          'n', // enable auto-clean
          '', // update strategy (accept default "merge")
          'n', // shell integration install prompt (decline)
        ];

        await withMockedPrompt(responses, () => executeInit(['--interactive']));

        // Verify repository was cloned (with .git suffix)
        const clonedRepoPath = join(tempDir, expectedRepoName);
        await assertDirExists(join(clonedRepoPath, '.git'));
        await assertFileExists(join(clonedRepoPath, '.gw', 'config.json'));

        // Verify config
        const config = await readTestConfig(clonedRepoPath);
        assertEquals(config.root, clonedRepoPath);
      } finally {
        await sourceRepo.cleanup();
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});

Deno.test('init command - interactive mode exits when URL prompt is skipped', async () => {
  const tempDir = Deno.realPathSync(Deno.makeTempDirSync({ prefix: 'gw-test-no-git-' }));
  try {
    const cwd = new TempCwd(tempDir);
    try {
      // Mock prompt to skip URL (press Enter with empty input)
      const responses = [
        '', // Empty URL (skip)
      ];

      const { exitCode } = await withMockedExit(() =>
        withMockedPrompt(responses, () => executeInit(['--interactive']))
      );

      // Should exit with error code
      assertEquals(exitCode, 1, 'Should exit with code 1 when URL is skipped');
    } finally {
      cwd.restore();
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});
