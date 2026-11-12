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

Deno.test('getBranchRemoteStatuses - merged needs an upstream, so fresh local branches are never merged', async () => {
  const dir = await Deno.makeTempDir();
  const prev = Deno.cwd();
  try {
    await git(dir, 'init', '-q', '-b', 'main');
    await git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
    await git(dir, 'branch', 'fresh'); // no commits of its own
    await git(dir, 'switch', '-q', '-c', 'done');
    await git(dir, 'commit', '-q', '--allow-empty', '-m', 'work');
    await git(dir, 'switch', '-q', 'main');
    await git(dir, 'merge', '-q', '--no-ff', 'done', '-m', 'merge');
    await git(dir, 'branch', '--set-upstream-to=main', 'done'); // stands in for a pushed branch
    // gw checkout style: upstream configured before any push, remote ref never created
    await git(dir, 'remote', 'add', 'origin', dir);
    await git(dir, 'branch', 'gwfresh');
    await git(dir, 'config', 'branch.gwfresh.remote', 'origin');
    await git(dir, 'config', 'branch.gwfresh.merge', 'refs/heads/gwfresh');
    // pushed (tracking) branch with no work of its own, then main moves on
    await git(dir, 'branch', 'pushedfresh');
    await git(dir, 'branch', '--set-upstream-to=main', 'pushedfresh');
    await git(dir, 'commit', '-q', '--allow-empty', '-m', 'main moves on');
    await git(dir, 'switch', '-q', '-c', 'open');
    await git(dir, 'commit', '-q', '--allow-empty', '-m', 'wip');

    Deno.chdir(dir);
    const statuses = await getBranchRemoteStatuses('main');
    assertEquals(statuses.get('done')?.merged, true);
    assertEquals(statuses.get('fresh')?.merged, false);
    assertEquals(statuses.get('pushedfresh')?.remote, 'tracking');
    assertEquals(statuses.get('pushedfresh')?.merged, false);
    assertEquals(statuses.get('gwfresh')?.remote, 'gone');
    assertEquals(statuses.get('gwfresh')?.merged, false);
    assertEquals(statuses.get('open')?.merged, false);
    assertEquals(statuses.get('open')?.remote, 'none');
  } finally {
    Deno.chdir(prev);
    await Deno.remove(dir, { recursive: true });
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
