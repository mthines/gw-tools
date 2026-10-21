/**
 * Tests for clean-stats.ts — cleanup statistics, ids, and the overview chart
 */

import { assertEquals } from '@std/assert';
import {
  branchId,
  formatBytes,
  isProtectedWorktree,
  parseItemId,
  type RepoStats,
  renderOverviewChart,
  worktreeId,
} from './clean-stats.ts';

function repo(name: string, removable: number, sizeBytes: number | null = null): RepoStats {
  const worktrees = Array.from({ length: removable }, (_, i) => ({
    id: worktreeId(`/r/${name}/wt${i}`),
    branch: `wt${i}`,
    path: `/r/${name}/wt${i}`,
    ageDays: 1,
    uncommitted: false,
    unpushed: false,
    protected: false,
    sizeBytes: null,
  }));
  return {
    name,
    path: `/r/${name}`,
    defaultBranch: 'main',
    worktrees,
    branches: [],
    orphans: [],
    totals: { worktrees: removable, branches: 0, orphans: 0, removable, sizeBytes },
  };
}

/** Strip ANSI color codes */
function plain(lines: string[]): string[] {
  // deno-lint-ignore no-control-regex
  return lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
}

Deno.test('overview chart - ranks repos by removable items, largest first', () => {
  const lines = plain(renderOverviewChart([repo('small', 1), repo('big', 6), repo('mid', 3)]));
  assertEquals(lines[0].startsWith('Overview — 3 repos · 10 worktrees'), true);
  assertEquals(
    lines.slice(1).map((l) => l.trim().split(/\s+/)[0]),
    ['big', 'mid', 'small']
  );
  // The top repo gets the full-width bar
  assertEquals(lines[1].includes('█'.repeat(20)), true);
});

Deno.test('overview chart - ranks by disk usage when sizes were measured', () => {
  const lines = plain(
    renderOverviewChart([repo('many-small', 9, 1024 * 1024), repo('few-huge', 1, 5 * 1024 * 1024 * 1024)])
  );
  assertEquals(lines[1].trim().startsWith('few-huge'), true);
  assertEquals(lines[1].includes('5.0 GB'), true);
  assertEquals(lines[0].includes('GB'), true);
});

Deno.test('overview chart - limits rows and summarizes the rest', () => {
  const stats = Array.from({ length: 8 }, (_, i) => repo(`r${i}`, i + 1));
  const lines = plain(renderOverviewChart(stats, 3));
  assertEquals(lines.length, 5); // title + 3 rows + "… 5 more"
  assertEquals(lines[4].trim(), '… 5 more');
});

Deno.test('overview chart - reports nothing to clean', () => {
  const lines = plain(renderOverviewChart([repo('clean', 0)]));
  assertEquals(lines[1].trim(), 'Nothing to clean up');
});

Deno.test('clean-stats - item ids round-trip through parseItemId', () => {
  assertEquals(parseItemId(worktreeId('/a/b:c')), { kind: 'worktree', path: '/a/b:c' });
  assertEquals(parseItemId(branchId('/repos/x.git', 'feat/a-b')), {
    kind: 'branch',
    repoPath: '/repos/x.git',
    branch: 'feat/a-b',
  });
  assertEquals(parseItemId('nope'), null);
  assertEquals(parseItemId('br:/no-branch'), null);
  assertEquals(parseItemId('wt:'), null);
});

Deno.test('clean-stats - default worktree is protected by location even when detached', () => {
  const settings = { defaultBranch: 'main', userProtected: [] };
  assertEquals(isProtectedWorktree({ branch: '', path: '/r/x.git/main' }, '/r/x.git', settings), true);
  assertEquals(isProtectedWorktree({ branch: '', path: '/r/x' }, '/r/x', settings), true);
  assertEquals(isProtectedWorktree({ branch: '', path: '/r/x.git/feat' }, '/r/x.git', settings), false);
  assertEquals(isProtectedWorktree({ branch: 'feat', path: '/r/x.git/feat' }, '/r/x.git', settings), false);
});

Deno.test('clean-stats - formatBytes', () => {
  assertEquals(formatBytes(512), '512 B');
  assertEquals(formatBytes(1536), '1.5 KB');
  assertEquals(formatBytes(20 * 1024 * 1024), '20 MB');
});
