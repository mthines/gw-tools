/**
 * Tests for the recency and remote-status helpers behind `gw clean`
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import {
  formatRelativeTime,
  getBranchRemoteStatuses,
  listWorktrees,
  parsePorcelainPaths,
  removeWorktree,
} from './git-utils.ts';

Deno.test('formatRelativeTime - buckets into minutes, hours and days', () => {
  const now = 1_000_000_000_000;
  assertEquals(formatRelativeTime(0, now), 'unknown');
  assertEquals(formatRelativeTime(now - 10_000, now), 'just now');
  assertEquals(formatRelativeTime(now - 5 * 60_000, now), '5m ago');
  assertEquals(formatRelativeTime(now - 3 * 3_600_000, now), '3h ago');
  assertEquals(formatRelativeTime(now - 12 * 86_400_000, now), '12d ago');
});

Deno.test('parsePorcelainPaths - skips the old-path entry that follows a rename', () => {
  const raw = ' M src/a.ts\0R  new name.ts\0old name.ts\0?? untracked.txt\0';
  assertEquals(parsePorcelainPaths(raw), ['src/a.ts', 'new name.ts', 'untracked.txt']);
});

async function git(cwd: string, ...args: string[]): Promise<void> {
  const { code, stderr } = await new Deno.Command('git', {
    args: [
      '-C',
      cwd,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'tag.gpgsign=false',
      ...args,
    ],
    stdout: 'null',
    stderr: 'piped',
  }).output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
}

Deno.test('getBranchRemoteStatuses - merged and tracking need a real pushed remote branch', async () => {
  const dir = await Deno.makeTempDir();
  const remote = await Deno.makeTempDir();
  const prev = Deno.cwd();
  try {
    await git(remote, 'init', '-q', '--bare', '-b', 'main');
    await git(dir, 'init', '-q', '-b', 'main');
    await git(dir, 'remote', 'add', 'origin', remote);
    await git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
    await git(dir, 'push', '-q', 'origin', 'main');
    await git(dir, 'branch', 'fresh'); // local only, no commits of its own
    await git(dir, 'branch', '--track', 'tracksmain', 'origin/main'); // cut from origin/main, never pushed
    await git(dir, 'branch', '--track', 'hotfix', 'origin/main'); // upstream's name only ends like the branch
    await git(dir, 'push', '-q', 'origin', 'main:refs/heads/hot/hotfix');
    await git(dir, 'fetch', '-q', 'origin');
    await git(dir, 'branch', '--set-upstream-to=origin/hot/hotfix', 'hotfix');
    await git(dir, 'switch', '-q', '-c', 'done');
    await git(dir, 'commit', '-q', '--allow-empty', '-m', 'work');
    await git(dir, 'push', '-q', '-u', 'origin', 'done');
    await git(dir, 'switch', '-q', 'main');
    await git(dir, 'merge', '-q', '--no-ff', 'done', '-m', 'merge');
    // gw checkout style: upstream configured before any push, remote ref never created
    for (const [name, commit] of [
      ['gwfresh', false],
      ['gwwork', true],
    ] as const) {
      await git(dir, 'switch', '-q', '-c', name);
      if (commit) await git(dir, 'commit', '-q', '--allow-empty', '-m', 'unpushed work');
      await git(dir, 'config', `branch.${name}.remote`, 'origin');
      await git(dir, 'config', `branch.${name}.merge`, `refs/heads/${name}`);
      await git(dir, 'switch', '-q', 'main');
    }
    // pushed branch with no work of its own, then main moves on
    await git(dir, 'branch', 'pushedfresh');
    await git(dir, 'push', '-q', '-u', 'origin', 'pushedfresh');
    await git(dir, 'commit', '-q', '--allow-empty', '-m', 'main moves on');
    await git(dir, 'switch', '-q', '-c', 'open');
    await git(dir, 'commit', '-q', '--allow-empty', '-m', 'wip');

    Deno.chdir(dir);
    const statuses = await getBranchRemoteStatuses('main');
    assertEquals(statuses.get('done'), { remote: 'tracking', merged: true, ahead: 0 });
    assertEquals(statuses.get('fresh')?.merged, false);
    assertEquals(statuses.get('tracksmain')?.remote, 'none');
    assertEquals(statuses.get('hotfix')?.remote, 'none');
    assertEquals(statuses.get('pushedfresh')?.remote, 'tracking');
    assertEquals(statuses.get('pushedfresh')?.merged, false);
    assertEquals(statuses.get('gwfresh'), { remote: 'gone', merged: false, ahead: 0 });
    assertEquals(statuses.get('gwwork'), { remote: 'gone', merged: false, ahead: 1 });
    assertEquals(statuses.get('open')?.merged, false);
    assertEquals(statuses.get('open')?.remote, 'none');
  } finally {
    Deno.chdir(prev);
    await Deno.remove(dir, { recursive: true });
    await Deno.remove(remote, { recursive: true });
  }
});

Deno.test('removeWorktree - a locked worktree needs overrideLock and reports the lock reason', async () => {
  const dir = await Deno.makeTempDir();
  const prev = Deno.cwd();
  try {
    await git(dir, 'init', '-q', '-b', 'main');
    await git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
    const wtPath = `${dir}-wt`;
    await git(dir, 'worktree', 'add', '-q', wtPath, '-b', 'feat-locked');
    await git(dir, 'worktree', 'lock', '--reason', 'fan-out experiment', wtPath);
    await Deno.writeTextFile(`${wtPath}/dirty.txt`, 'x');

    Deno.chdir(dir);
    const wt = (await listWorktrees()).find((w) => w.branch === 'feat-locked');
    assertEquals(wt?.locked, 'fan-out experiment');

    let message = '';
    try {
      await removeWorktree(wtPath, true);
    } catch (error) {
      message = (error as Error).message;
    }
    assertStringIncludes(message, 'fan-out experiment');

    await removeWorktree(wtPath, true, true);
    assertEquals(
      (await listWorktrees()).some((w) => w.branch === 'feat-locked'),
      false
    );
  } finally {
    Deno.chdir(prev);
    await Deno.remove(dir, { recursive: true });
  }
});
