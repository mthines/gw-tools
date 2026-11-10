/**
 * Integration tests for the native git post-checkout hook.
 *
 * These run real `git worktree add` / `git checkout` against a temp repo with
 * a `gw` shim on PATH, so they prove the installed hook actually fires.
 */

import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { join } from '@std/path';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { installGitHook, uninstallGitHook } from '../lib/git-hook.ts';
import { TempCwd } from '../test-utils/temp-env.ts';

const MAIN_TS = new URL('../main.ts', import.meta.url).pathname;

/** Create a `gw` executable shim that runs the dev entry point. */
async function makeGwShim(): Promise<string> {
  const dir = Deno.makeTempDirSync({ prefix: 'gw-shim-' });
  const shim = join(dir, 'gw');
  await Deno.writeTextFile(shim, `#!/bin/sh\nexec "${Deno.execPath()}" run --allow-all "${MAIN_TS}" "$@"\n`);
  await Deno.chmod(shim, 0o755);
  return dir;
}

async function git(cwd: string, args: string[], shimDir: string, extraEnv: Record<string, string> = {}): Promise<void> {
  const { code, stderr } = await new Deno.Command('git', {
    args,
    cwd,
    stdout: 'null',
    stderr: 'piped',
    env: { PATH: `${shimDir}:${Deno.env.get('PATH')}`, ...extraEnv },
  }).output();
  if (code !== 0) throw new Error(`git ${args.join(' ')} failed: ${new TextDecoder().decode(stderr)}`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Repo with .env, autoCopyFiles + a post hook writing hook.out, hook installed. */
async function setup(hooks: Record<string, unknown> = {}) {
  const repo = new GitTestRepo();
  await repo.init();
  await repo.createFile('.env', 'SECRET=1\n');
  await repo.createFile('.gitignore', '.env\n');
  await repo.createCommit('add gitignore');
  const config = {
    configVersion: 3,
    defaultBranch: 'main',
    autoCopyFiles: ['.env'],
    hooks: { checkout: { post: ['echo {branch} > hook.out'] }, ...hooks },
  };
  await repo.createFile('.gw/config.json', JSON.stringify(config));
  const shimDir = await makeGwShim();
  const cwd = new TempCwd(repo.path);
  try {
    const result = await installGitHook();
    assertEquals(result.status, 'installed');
  } finally {
    cwd.restore();
  }
  const wt = (name: string) => join(repo.path, '..', `${repo.path.split('/').pop()}-${name}`);
  return { repo, shimDir, wt };
}

Deno.test('git hook - git worktree add copies autoCopyFiles and runs post-checkout hooks', async () => {
  const { repo, shimDir, wt } = await setup();
  const target = wt('feat');
  try {
    await git(repo.path, ['worktree', 'add', '-b', 'feat-x', target], shimDir);

    assertEquals(await Deno.readTextFile(join(target, '.env')), 'SECRET=1\n');
    assertEquals((await Deno.readTextFile(join(target, 'hook.out'))).trim(), 'feat-x');
  } finally {
    await Deno.remove(target, { recursive: true }).catch(() => {});
    await repo.cleanup();
  }
});

Deno.test('git hook - does not fire for a regular git checkout', async () => {
  const { repo, shimDir } = await setup();
  try {
    await git(repo.path, ['checkout', '-b', 'other'], shimDir);
    await git(repo.path, ['checkout', 'main'], shimDir);
    assert(!(await exists(join(repo.path, 'hook.out'))));
  } finally {
    await repo.cleanup();
  }
});

Deno.test('git hook - hooks.gitWorktreeAdd=false disables it at runtime', async () => {
  const { repo, shimDir, wt } = await setup({ gitWorktreeAdd: false });
  const target = wt('off');
  try {
    await git(repo.path, ['worktree', 'add', '-b', 'feat-off', target], shimDir);
    assert(!(await exists(join(target, 'hook.out'))));
    assert(!(await exists(join(target, '.env'))));
  } finally {
    await Deno.remove(target, { recursive: true }).catch(() => {});
    await repo.cleanup();
  }
});

Deno.test('git hook - skipped when GW_CHECKOUT_ACTIVE is set (gw checkout handles it itself)', async () => {
  const { repo, shimDir, wt } = await setup();
  const target = wt('guard');
  try {
    await git(repo.path, ['worktree', 'add', '-b', 'feat-guard', target], shimDir, { GW_CHECKOUT_ACTIVE: '1' });
    assert(!(await exists(join(target, 'hook.out'))));
  } finally {
    await Deno.remove(target, { recursive: true }).catch(() => {});
    await repo.cleanup();
  }
});

Deno.test('git hook - install preserves an existing hook, is idempotent, and uninstall restores it', async () => {
  const repo = new GitTestRepo();
  await repo.init();
  const hookPath = join(repo.path, '.git', 'hooks', 'post-checkout');
  const original = '#!/bin/sh\necho existing\n';
  await Deno.mkdir(join(repo.path, '.git', 'hooks'), { recursive: true });
  await Deno.writeTextFile(hookPath, original);
  await Deno.chmod(hookPath, 0o755);
  const cwd = new TempCwd(repo.path);
  try {
    assertEquals((await installGitHook()).status, 'installed');
    assertEquals((await installGitHook()).status, 'already-installed');
    const installed = await Deno.readTextFile(hookPath);
    assertStringIncludes(installed, 'echo existing');
    assertStringIncludes(installed, 'gw _post-worktree-add');

    assert(await uninstallGitHook());
    assertEquals(await Deno.readTextFile(hookPath), original);
  } finally {
    cwd.restore();
    await repo.cleanup();
  }
});

Deno.test('git hook - install is skipped when core.hooksPath is set', async () => {
  const repo = new GitTestRepo();
  await repo.init();
  await new Deno.Command('git', { args: ['config', 'core.hooksPath', '.husky'], cwd: repo.path }).output();
  const cwd = new TempCwd(repo.path);
  try {
    const result = await installGitHook();
    assertEquals(result.status, 'skipped');
    assertStringIncludes(result.reason ?? '', 'core.hooksPath');
  } finally {
    cwd.restore();
    await repo.cleanup();
  }
});

Deno.test('git hook - install never writes through a symlinked hook', async () => {
  const repo = new GitTestRepo();
  await repo.init();
  const script = join(repo.path, 'post-checkout-script');
  await Deno.writeTextFile(script, '#!/bin/sh\necho tracked\n');
  await Deno.chmod(script, 0o755);
  await Deno.mkdir(join(repo.path, '.git', 'hooks'), { recursive: true });
  await Deno.symlink(script, join(repo.path, '.git', 'hooks', 'post-checkout'));
  const cwd = new TempCwd(repo.path);
  try {
    const result = await installGitHook();
    assertEquals(result.status, 'skipped');
    assertStringIncludes(result.reason ?? '', 'symlink');
    assertEquals(await Deno.readTextFile(script), '#!/bin/sh\necho tracked\n');
  } finally {
    cwd.restore();
    await repo.cleanup();
  }
});

Deno.test('git hook - install does not re-enable a non-executable (disabled) hook', async () => {
  const repo = new GitTestRepo();
  await repo.init();
  const hookPath = join(repo.path, '.git', 'hooks', 'post-checkout');
  await Deno.mkdir(join(repo.path, '.git', 'hooks'), { recursive: true });
  await Deno.writeTextFile(hookPath, '#!/bin/sh\necho existing\n');
  await Deno.chmod(hookPath, 0o644);
  const cwd = new TempCwd(repo.path);
  try {
    const result = await installGitHook();
    assertEquals(result.status, 'skipped');
    assertEquals((await Deno.stat(hookPath)).mode! & 0o777, 0o644);
    assertEquals(await Deno.readTextFile(hookPath), '#!/bin/sh\necho existing\n');
  } finally {
    cwd.restore();
    await repo.cleanup();
  }
});

Deno.test('git hook - install preserves the mode of an existing executable hook', async () => {
  const repo = new GitTestRepo();
  await repo.init();
  const hookPath = join(repo.path, '.git', 'hooks', 'post-checkout');
  await Deno.mkdir(join(repo.path, '.git', 'hooks'), { recursive: true });
  await Deno.writeTextFile(hookPath, '#!/bin/sh\necho existing\n');
  await Deno.chmod(hookPath, 0o750);
  const cwd = new TempCwd(repo.path);
  try {
    assertEquals((await installGitHook()).status, 'installed');
    assertEquals((await Deno.stat(hookPath)).mode! & 0o777, 0o750);
  } finally {
    cwd.restore();
    await repo.cleanup();
  }
});
