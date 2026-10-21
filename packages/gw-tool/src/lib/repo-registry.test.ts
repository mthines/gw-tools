/**
 * Tests for repo-registry.ts — the global registry of gw repositories
 */

import { assertEquals } from '@std/assert';
import { fromFileUrl, join } from '@std/path';
import {
  autoRegisterCurrentRepo,
  getGlobalConfigDir,
  getRegistryPath,
  loadRegistry,
  pruneMissingRepos,
  registerRepo,
} from './repo-registry.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd, TempEnv } from '../test-utils/temp-env.ts';
import { createMinimalConfig, writeTestConfig } from '../test-utils/fixtures.ts';

const MAIN_TS = fromFileUrl(new URL('../main.ts', import.meta.url));

/**
 * Run a test with XDG_CONFIG_HOME pointed at a fresh temp dir
 */
async function withTempConfigHome(fn: (configHome: string) => Promise<void>): Promise<void> {
  const configHome = await Deno.makeTempDir({ prefix: 'gw-registry-test-' });
  const env = new TempEnv();
  env.set('XDG_CONFIG_HOME', configHome);
  try {
    await fn(configHome);
  } finally {
    env.restore();
    await Deno.remove(configHome, { recursive: true });
  }
}

/**
 * Run the real gw CLI in a subprocess
 */
async function runGw(args: string[], cwd: string, env: Record<string, string>): Promise<number> {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ['run', '--allow-all', MAIN_TS, ...args],
    cwd,
    env,
    stdout: 'null',
    stderr: 'null',
    stdin: 'null',
  });
  const { code } = await cmd.output();
  return code;
}

Deno.test('repo-registry - stores registry under XDG_CONFIG_HOME/gw/repos.json', async () => {
  await withTempConfigHome(async (configHome) => {
    assertEquals(getGlobalConfigDir(), join(configHome, 'gw'));
    assertEquals(getRegistryPath(), join(configHome, 'gw', 'repos.json'));

    const added = await registerRepo('/tmp/some-repo');
    assertEquals(added, true);

    const raw = JSON.parse(await Deno.readTextFile(join(configHome, 'gw', 'repos.json')));
    assertEquals(raw.repos.length, 1);
    assertEquals(raw.repos[0].path, '/tmp/some-repo');
  });
});

Deno.test('repo-registry - falls back to ~/.config/gw when XDG_CONFIG_HOME is unset', () => {
  const env = new TempEnv();
  env.delete('XDG_CONFIG_HOME');
  env.set('HOME', '/home/tester');
  try {
    assertEquals(getRegistryPath(), '/home/tester/.config/gw/repos.json');
  } finally {
    env.restore();
  }
});

Deno.test('repo-registry - does not register the same repo twice', async () => {
  await withTempConfigHome(async () => {
    assertEquals(await registerRepo('/tmp/repo-a'), true);
    assertEquals(await registerRepo('/tmp/repo-a/'), false);
    assertEquals(await registerRepo('/tmp/repo-b'), true);

    const repos = await loadRegistry();
    assertEquals(
      repos.map((r) => r.path),
      ['/tmp/repo-a', '/tmp/repo-b']
    );
  });
});

Deno.test('repo-registry - corrupt registry is treated as empty', async () => {
  await withTempConfigHome(async (configHome) => {
    await Deno.mkdir(join(configHome, 'gw'), { recursive: true });
    await Deno.writeTextFile(join(configHome, 'gw', 'repos.json'), '{ not json');

    assertEquals(await loadRegistry(), []);
    assertEquals(await registerRepo('/tmp/repo-a'), true);
    assertEquals((await loadRegistry()).length, 1);
  });
});

Deno.test('repo-registry - auto-registers the current gw repo', async () => {
  await withTempConfigHome(async () => {
    const repo = new GitTestRepo();
    try {
      await repo.init();
      await writeTestConfig(repo.path, createMinimalConfig());
      await repo.createWorktree('feat-x');

      // Running from inside a worktree registers the repo root, not the worktree
      const cwd = new TempCwd(join(repo.path, 'feat-x'));
      try {
        assertEquals(await autoRegisterCurrentRepo(), true);
        assertEquals(await autoRegisterCurrentRepo(), false);
      } finally {
        cwd.restore();
      }

      assertEquals(
        (await loadRegistry()).map((r) => r.path),
        [repo.path]
      );
    } finally {
      await repo.cleanup();
    }
  });
});

Deno.test('repo-registry - auto-registers skips git repos without gw config', async () => {
  await withTempConfigHome(async () => {
    const repo = new GitTestRepo();
    try {
      await repo.init();
      const cwd = new TempCwd(repo.path);
      try {
        assertEquals(await autoRegisterCurrentRepo(), false);
      } finally {
        cwd.restore();
      }
      assertEquals(await loadRegistry(), []);
    } finally {
      await repo.cleanup();
    }
  });
});

Deno.test('repo-registry - auto-registers an unregistered repo when running any gw command', async () => {
  await withTempConfigHome(async (configHome) => {
    const repo = new GitTestRepo();
    try {
      await repo.init();
      await writeTestConfig(repo.path, createMinimalConfig());

      const code = await runGw(['list'], repo.path, { XDG_CONFIG_HOME: configHome, NO_COLOR: '1' });
      assertEquals(code, 0);

      assertEquals(
        (await loadRegistry()).map((r) => r.path),
        [repo.path]
      );
    } finally {
      await repo.cleanup();
    }
  });
});

Deno.test('repo-registry - registry write failure does not break registration callers', async () => {
  await withTempConfigHome(async (configHome) => {
    // Make the gw config dir impossible to create: a regular file sits where
    // the directory should be.
    await Deno.writeTextFile(join(configHome, 'gw'), 'not a directory');

    const repo = new GitTestRepo();
    try {
      await repo.init();
      await writeTestConfig(repo.path, createMinimalConfig());

      const cwd = new TempCwd(repo.path);
      try {
        assertEquals(await autoRegisterCurrentRepo(), false);
      } finally {
        cwd.restore();
      }
    } finally {
      await repo.cleanup();
    }
  });
});

Deno.test('repo-registry - registry write failure does not fail the gw command', async () => {
  await withTempConfigHome(async (configHome) => {
    await Deno.writeTextFile(join(configHome, 'gw'), 'not a directory');

    const repo = new GitTestRepo();
    try {
      await repo.init();
      await writeTestConfig(repo.path, createMinimalConfig());

      const code = await runGw(['list'], repo.path, { XDG_CONFIG_HOME: configHome, NO_COLOR: '1' });
      assertEquals(code, 0);
    } finally {
      await repo.cleanup();
    }
  });
});

Deno.test('repo-registry - missing path is dropped by pruneMissingRepos', async () => {
  await withTempConfigHome(async () => {
    const existingDir = await Deno.makeTempDir({ prefix: 'gw-registry-existing-' });
    try {
      await registerRepo(existingDir);
      await registerRepo('/definitely/not/a/real/path/gw-repo');

      const { existing, removed } = await pruneMissingRepos();
      assertEquals(
        existing.map((r) => r.path),
        [existingDir]
      );
      assertEquals(
        removed.map((r) => r.path),
        ['/definitely/not/a/real/path/gw-repo']
      );

      // Persisted: the missing repo is gone from the registry
      assertEquals(
        (await loadRegistry()).map((r) => r.path),
        [existingDir]
      );
    } finally {
      await Deno.remove(existingDir, { recursive: true });
    }
  });
});
