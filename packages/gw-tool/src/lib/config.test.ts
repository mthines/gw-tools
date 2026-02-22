/**
 * Tests for config.ts
 */

import { assertEquals, assertRejects } from '$std/assert';
import { join } from '$std/path';
import { loadConfig, saveConfig, saveConfigTemplate } from './config.ts';
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

    const config = createConfigWithHooks(repo.path, ['echo pre-checkout'], ['echo post-checkout']);
    await saveConfig(repo.path, config);

    const saved = await readTestConfig(repo.path);
    assertEquals(saved.hooks?.checkout?.pre, ['echo pre-checkout']);
    assertEquals(saved.hooks?.checkout?.post, ['echo post-checkout']);
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

Deno.test('loadConfig - parses JSONC with single-line comments', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create config with single-line comments
    const jsoncConfig = `{
  "root": "${repo.path}",
  // This is the default branch
  "defaultBranch": "main",
  "cleanThreshold": 7 // days before cleanup
}`;
    await Deno.mkdir(join(repo.path, '.gw'), { recursive: true });
    await Deno.writeTextFile(join(repo.path, '.gw', 'config.json'), jsoncConfig);

    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded, gitRoot } = await loadConfig();
      assertEquals(loaded.root, repo.path);
      assertEquals(loaded.defaultBranch, 'main');
      assertEquals(loaded.cleanThreshold, 7);
      assertEquals(gitRoot, repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('loadConfig - parses JSONC with multi-line comments', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create config with multi-line comments
    const jsoncConfig = `{
  "root": "${repo.path}",
  /*
   * Default branch configuration
   * This is used for creating new worktrees
   */
  "defaultBranch": "main",
  "cleanThreshold": 7 /* cleanup threshold */
}`;
    await Deno.mkdir(join(repo.path, '.gw'), { recursive: true });
    await Deno.writeTextFile(join(repo.path, '.gw', 'config.json'), jsoncConfig);

    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded, gitRoot } = await loadConfig();
      assertEquals(loaded.root, repo.path);
      assertEquals(loaded.defaultBranch, 'main');
      assertEquals(loaded.cleanThreshold, 7);
      assertEquals(gitRoot, repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('loadConfig - parses JSONC with trailing commas', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create config with trailing commas
    const jsoncConfig = `{
  "root": "${repo.path}",
  "defaultBranch": "main",
  "autoCopyFiles": [
    ".env",
    "secrets/",
  ],
  "cleanThreshold": 7,
}`;
    await Deno.mkdir(join(repo.path, '.gw'), { recursive: true });
    await Deno.writeTextFile(join(repo.path, '.gw', 'config.json'), jsoncConfig);

    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded, gitRoot } = await loadConfig();
      assertEquals(loaded.root, repo.path);
      assertEquals(loaded.defaultBranch, 'main');
      assertEquals(loaded.autoCopyFiles, ['.env', 'secrets/']);
      assertEquals(loaded.cleanThreshold, 7);
      assertEquals(gitRoot, repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfig - writes clean JSON without comments', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create config with all features
    const config = createConfigWithAutoCopy(repo.path, ['.env', 'secrets/']);
    await saveConfig(repo.path, config);

    // Read the raw file content
    const rawContent = await Deno.readTextFile(join(repo.path, '.gw', 'config.json'));

    // Verify it's clean JSON (no comments)
    assertEquals(rawContent.includes('//'), false);
    assertEquals(rawContent.includes('/*'), false);
    assertEquals(rawContent.includes('*/'), false);

    // Verify it's valid JSON (not JSONC)
    const parsed = JSON.parse(rawContent);
    assertEquals(parsed.root, repo.path);
    assertEquals(parsed.autoCopyFiles, ['.env', 'secrets/']);
  } finally {
    await repo.cleanup();
  }
});

// ============================================================================
// saveConfigTemplate Tests
// ============================================================================

Deno.test('saveConfigTemplate - generates valid JSONC with comments', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await saveConfigTemplate(repo.path, config);

    // Read the raw file content
    const rawContent = await Deno.readTextFile(join(repo.path, '.gw', 'config.json'));

    // Verify it has comments
    assertEquals(rawContent.includes('//'), true);
    assertEquals(rawContent.includes('gw Configuration File'), true);
    assertEquals(rawContent.includes('Documentation:'), true);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfigTemplate - template is parseable by loadConfig', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await saveConfigTemplate(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded, gitRoot } = await loadConfig();
      assertEquals(loaded.root, repo.path);
      assertEquals(loaded.defaultBranch, 'main');
      assertEquals(loaded.cleanThreshold, 7);
      assertEquals(gitRoot, repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfigTemplate - shows active autoCopyFiles uncommented', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createConfigWithAutoCopy(repo.path, ['.env', 'secrets/']);
    await saveConfigTemplate(repo.path, config);

    const rawContent = await Deno.readTextFile(join(repo.path, '.gw', 'config.json'));

    // Verify autoCopyFiles section is uncommented
    assertEquals(rawContent.includes('"autoCopyFiles": ['), true);
    assertEquals(rawContent.includes('".env"'), true);
    assertEquals(rawContent.includes('"secrets/"'), true);

    // Verify it loads correctly
    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded } = await loadConfig();
      assertEquals(loaded.autoCopyFiles, ['.env', 'secrets/']);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfigTemplate - shows inactive autoCopyFiles as commented examples', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await saveConfigTemplate(repo.path, config);

    const rawContent = await Deno.readTextFile(join(repo.path, '.gw', 'config.json'));

    // Verify autoCopyFiles section is commented
    assertEquals(rawContent.includes('// "autoCopyFiles": ['), true);
    assertEquals(rawContent.includes('//   ".env"'), true);
    assertEquals(rawContent.includes('// Environment variables'), true);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfigTemplate - shows active hooks uncommented', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createConfigWithHooks(repo.path, ['echo pre-checkout'], ['cd {worktreePath} && npm install']);
    await saveConfigTemplate(repo.path, config);

    const rawContent = await Deno.readTextFile(join(repo.path, '.gw', 'config.json'));

    // Verify hooks section is uncommented
    assertEquals(rawContent.includes('"hooks": {'), true);
    assertEquals(rawContent.includes('"checkout": {'), true);
    assertEquals(rawContent.includes('"pre": ['), true);
    assertEquals(rawContent.includes('"echo pre-checkout"'), true);
    assertEquals(rawContent.includes('"post": ['), true);
    assertEquals(rawContent.includes('cd {worktreePath} && npm install'), true);

    // Verify it loads correctly
    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded } = await loadConfig();
      assertEquals(loaded.hooks?.checkout?.pre, ['echo pre-checkout']);
      assertEquals(loaded.hooks?.checkout?.post, ['cd {worktreePath} && npm install']);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfigTemplate - shows inactive hooks as commented examples', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await saveConfigTemplate(repo.path, config);

    const rawContent = await Deno.readTextFile(join(repo.path, '.gw', 'config.json'));

    // Verify hooks section is commented
    assertEquals(rawContent.includes('// "hooks": {'), true);
    assertEquals(rawContent.includes('//   "checkout": {'), true);
    assertEquals(rawContent.includes('//     "pre": ['), true);
    assertEquals(rawContent.includes('//     "post": ['), true);
    assertEquals(rawContent.includes('Available variables:'), true);
    assertEquals(rawContent.includes('{worktree}'), true);
    assertEquals(rawContent.includes('{worktreePath}'), true);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfigTemplate - includes advanced options when configured', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    config.autoClean = true;
    config.updateStrategy = 'rebase';
    await saveConfigTemplate(repo.path, config);

    const rawContent = await Deno.readTextFile(join(repo.path, '.gw', 'config.json'));

    // Verify advanced options are uncommented
    assertEquals(rawContent.includes('"autoClean": true'), true);
    assertEquals(rawContent.includes('"updateStrategy": "rebase"'), true);

    // Verify it loads correctly
    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded } = await loadConfig();
      assertEquals(loaded.autoClean, true);
      assertEquals(loaded.updateStrategy, 'rebase');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfigTemplate - shows commented examples for unconfigured advanced options', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await saveConfigTemplate(repo.path, config);

    const rawContent = await Deno.readTextFile(join(repo.path, '.gw', 'config.json'));

    // Verify advanced options are commented
    assertEquals(rawContent.includes('// "autoClean": false'), true);
    assertEquals(rawContent.includes('// "updateStrategy": "merge"'), true);
    assertEquals(rawContent.includes('Automatically clean stale worktrees'), true);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfigTemplate - preserves all config values', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a config with all features enabled
    const config = createConfigWithAutoCopy(repo.path, ['.env', '.env.local', 'secrets/']);
    config.hooks = {
      checkout: {
        pre: ['echo Creating {worktree}'],
        post: ['cd {worktreePath} && npm install', 'cd {worktreePath} && npm run build'],
      },
    };
    config.autoClean = true;
    config.updateStrategy = 'rebase';
    config.cleanThreshold = 14;

    await saveConfigTemplate(repo.path, config);

    // Load and verify all values are preserved
    const cwd = new TempCwd(repo.path);
    try {
      const { config: loaded } = await loadConfig();
      assertEquals(loaded.root, repo.path);
      assertEquals(loaded.defaultBranch, 'main');
      assertEquals(loaded.cleanThreshold, 14);
      assertEquals(loaded.autoCopyFiles, ['.env', '.env.local', 'secrets/']);
      assertEquals(loaded.hooks?.checkout?.pre, ['echo Creating {worktree}']);
      assertEquals(loaded.hooks?.checkout?.post, ['cd {worktreePath} && npm install', 'cd {worktreePath} && npm run build']);
      assertEquals(loaded.autoClean, true);
      assertEquals(loaded.updateStrategy, 'rebase');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('saveConfigTemplate - includes section headers and documentation', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await saveConfigTemplate(repo.path, config);

    const rawContent = await Deno.readTextFile(join(repo.path, '.gw', 'config.json'));

    // Verify section headers
    assertEquals(rawContent.includes('Core Settings'), true);
    assertEquals(rawContent.includes('Auto-Copy Files'), true);
    assertEquals(rawContent.includes('Hooks'), true);
    assertEquals(rawContent.includes('Advanced Options'), true);

    // Verify documentation elements
    assertEquals(rawContent.includes('Documentation: https://github.com/mthines/gw-tools'), true);
    assertEquals(rawContent.includes('All fields except'), true);
    assertEquals(rawContent.includes('Internal fields (managed automatically)'), true);
  } finally {
    await repo.cleanup();
  }
});
