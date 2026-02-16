/**
 * Tests for config.ts
 */

import { assertEquals, assertRejects } from '$std/assert';
import { join } from '$std/path';
import { loadConfig, saveConfig } from './config.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import {
  createMinimalConfig,
  createConfigWithAutoCopy,
  createConfigWithHooks,
  readTestConfig,
  writeTestConfig,
} from '../test-utils/fixtures.ts';
import { assertFileExists } from '../test-utils/assertions.ts';
import { TempCwd } from '../test-utils/temp-env.ts';

Deno.test("saveConfig - creates .gw directory if it doesn't exist", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await saveConfig(repo.path, config);

    await assertFileExists(join(repo.path, '.gw', 'config.json'));
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfig - writes valid JSON', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await saveConfig(repo.path, config);

    const saved = await readTestConfig(repo.path);
    assertEquals(saved.root, repo.path);
    assertEquals(saved.defaultBranch, 'main');
    assertEquals(saved.cleanThreshold, 7);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfig - preserves autoCopyFiles', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createConfigWithAutoCopy(repo.path, ['.env', 'secrets/']);
    await saveConfig(repo.path, config);

    const saved = await readTestConfig(repo.path);
    assertEquals(saved.autoCopyFiles, ['.env', 'secrets/']);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfig - preserves hooks', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createConfigWithHooks(repo.path, ['echo pre-add'], ['echo post-add']);
    await saveConfig(repo.path, config);

    const saved = await readTestConfig(repo.path);
    assertEquals(saved.hooks?.add?.pre, ['echo pre-add']);
    assertEquals(saved.hooks?.add?.post, ['echo post-add']);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('loadConfig - finds config in current directory', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded, gitRoot } = await loadConfig();
      assertEquals(loaded.root, repo.path);
      assertEquals(gitRoot, repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('loadConfig - walks up directory tree to find config', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a subdirectory and change to it
    const subdir = join(repo.path, 'subdir', 'nested');
    await Deno.mkdir(subdir, { recursive: true });

    const cwd = new TempCwd(subdir);
    try {
      const { config: loaded, gitRoot } = await loadConfig();
      assertEquals(loaded.root, repo.path);
      assertEquals(gitRoot, repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('loadConfig - auto-detects git root if no config exists', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded, gitRoot } = await loadConfig();
      // Config should be auto-created with detected root
      assertEquals(gitRoot, repo.path);
      assertEquals(loaded.root, repo.path);
      assertEquals(loaded.defaultBranch, 'main');

      // Config file should have been created
      await assertFileExists(join(repo.path, '.gw', 'config.json'));
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('loadConfig - throws error if not in a git repo and no config', async () => {
  const tempDir = Deno.makeTempDirSync({ prefix: 'gw-test-noconf-' });
  try {
    const cwd = new TempCwd(tempDir);
    try {
      await assertRejects(() => loadConfig(), Error, 'Could not auto-detect git root');
    } finally {
      cwd.restore();
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('loadConfig - handles config with missing root field', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create config without root field
    const config = { defaultBranch: 'main', cleanThreshold: 7 };
    await Deno.mkdir(join(repo.path, '.gw'), { recursive: true });
    await Deno.writeTextFile(join(repo.path, '.gw', 'config.json'), JSON.stringify(config, null, 2));

    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded, gitRoot } = await loadConfig();
      // Should auto-detect and update config with root
      assertEquals(gitRoot, repo.path);
      assertEquals(loaded.root, repo.path);

      // Config should be updated with root
      const saved = await readTestConfig(repo.path);
      assertEquals(saved.root, repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('loadConfig - validates config structure', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create invalid config (autoCopyFiles as string instead of array)
    const invalidConfig = {
      root: repo.path,
      defaultBranch: 'main',
      autoCopyFiles: '.env', // Should be array
    };
    await Deno.mkdir(join(repo.path, '.gw'), { recursive: true });
    await Deno.writeTextFile(join(repo.path, '.gw', 'config.json'), JSON.stringify(invalidConfig, null, 2));

    const cwd = new TempCwd(repo.path);
    try {
      await assertRejects(() => loadConfig(), Error, 'Invalid configuration file format');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
