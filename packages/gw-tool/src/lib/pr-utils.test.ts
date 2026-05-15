/**
 * Unit tests for pr-utils.ts
 */

import { assertEquals } from '@std/assert';
import { extractRemoteHost, fetchPrRef, parsePrIdentifier } from './pr-utils.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';

// ─── parsePrIdentifier ────────────────────────────────────────────────────────

Deno.test('parsePrIdentifier - bare number', () => {
  const result = parsePrIdentifier('42');
  assertEquals(result, { prNumber: 42 });
});

Deno.test('parsePrIdentifier - large number', () => {
  const result = parsePrIdentifier('99999');
  assertEquals(result, { prNumber: 99999 });
});

Deno.test('parsePrIdentifier - full HTTPS URL', () => {
  const result = parsePrIdentifier('https://github.com/owner/repo/pull/42');
  assertEquals(result, { prNumber: 42, owner: 'owner', repo: 'repo' });
});

Deno.test('parsePrIdentifier - HTTP URL', () => {
  const result = parsePrIdentifier('http://github.com/owner/repo/pull/42');
  assertEquals(result?.prNumber, 42);
});

Deno.test('parsePrIdentifier - URL without protocol', () => {
  const result = parsePrIdentifier('github.com/owner/repo/pull/42');
  assertEquals(result?.prNumber, 42);
});

Deno.test('parsePrIdentifier - URL with trailing /files', () => {
  const result = parsePrIdentifier('https://github.com/owner/repo/pull/42/files');
  assertEquals(result?.prNumber, 42);
});

Deno.test('parsePrIdentifier - URL with trailing /commits', () => {
  const result = parsePrIdentifier('https://github.com/owner/repo/pull/42/commits');
  assertEquals(result?.prNumber, 42);
});

Deno.test('parsePrIdentifier - URL with anchor fragment', () => {
  const result = parsePrIdentifier('https://github.com/owner/repo/pull/42#discussion_r123');
  assertEquals(result?.prNumber, 42);
});

Deno.test('parsePrIdentifier - invalid string', () => {
  assertEquals(parsePrIdentifier('not-a-pr'), null);
});

Deno.test('parsePrIdentifier - zero is invalid', () => {
  assertEquals(parsePrIdentifier('0'), null);
});

Deno.test('parsePrIdentifier - empty string', () => {
  assertEquals(parsePrIdentifier(''), null);
});

Deno.test('parsePrIdentifier - GitLab URL returns null', () => {
  assertEquals(parsePrIdentifier('https://gitlab.com/owner/repo/merge_requests/42'), null);
});

// ─── extractRemoteHost ────────────────────────────────────────────────────────

Deno.test('extractRemoteHost - HTTPS URL', () => {
  assertEquals(extractRemoteHost('https://github.com/owner/repo.git'), 'github.com');
});

Deno.test('extractRemoteHost - SCP-style git@', () => {
  assertEquals(extractRemoteHost('git@github.com:owner/repo.git'), 'github.com');
});

Deno.test('extractRemoteHost - SSH URL', () => {
  assertEquals(extractRemoteHost('ssh://git@github.com/owner/repo.git'), 'github.com');
});

Deno.test('extractRemoteHost - GitLab HTTPS', () => {
  assertEquals(extractRemoteHost('https://gitlab.com/owner/repo.git'), 'gitlab.com');
});

Deno.test('extractRemoteHost - local filesystem path', () => {
  assertEquals(extractRemoteHost('/tmp/local-bare-repo'), null);
});

Deno.test('extractRemoteHost - empty string', () => {
  assertEquals(extractRemoteHost(''), null);
});

// ─── fetchPrRef ───────────────────────────────────────────────────────────────

Deno.test('fetchPrRef - fetches PR head into remote-tracking ref', async () => {
  // Set up a bare "upstream" repo that simulates GitHub's refs/pull/<n>/head
  const upstream = new GitTestRepo();
  const local = new GitTestRepo();

  try {
    // Init upstream as a bare repo
    await upstream.runCommand('git', ['init', '--bare', upstream.path]);

    // Init local repo
    await local.init();

    // Create a commit in a temp clone so we can push to upstream
    const clone = new GitTestRepo();
    try {
      await clone.runCommand('git', ['clone', upstream.path, clone.path]);
      await clone.runCommand('git', ['config', 'user.email', 'test@example.com'], clone.path);
      await clone.runCommand('git', ['config', 'user.name', 'Test User'], clone.path);
      await clone.runCommand('git', ['config', 'commit.gpgsign', 'false'], clone.path);
      await Deno.writeTextFile(`${clone.path}/pr-file.txt`, 'pr content');
      await clone.runCommand('git', ['add', '-A'], clone.path);
      await clone.runCommand('git', ['commit', '-m', 'PR commit'], clone.path);

      // Push to upstream under refs/pull/1/head — simulates GitHub's PR ref
      await clone.runCommand('git', ['push', upstream.path, 'HEAD:refs/pull/1/head'], clone.path);
    } finally {
      await clone.cleanup();
    }

    // Add upstream as a remote in local repo
    await local.runCommand('git', ['remote', 'add', 'origin', upstream.path], local.path);

    // Fetch the PR ref directly (bypasses executeUpdate host guard)
    const result = await fetchPrRef(1, 'origin', local.path);

    // Verify
    assertEquals(result.success, true);
    assertEquals(result.ref, 'refs/remotes/origin/pr/1');

    // Verify the ref actually exists
    const checkRef = new Deno.Command('git', {
      args: ['rev-parse', '--verify', 'refs/remotes/origin/pr/1'],
      cwd: local.path,
      stdout: 'piped',
      stderr: 'piped',
    });
    const { code } = await checkRef.output();
    assertEquals(code, 0, 'refs/remotes/origin/pr/1 should exist after fetchPrRef');
  } finally {
    await upstream.cleanup();
    await local.cleanup();
  }
});

Deno.test('fetchPrRef - returns failure on unknown remote', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Use a non-existent remote — should fail gracefully
    const result = await fetchPrRef(42, 'nonexistent-remote', repo.path);
    assertEquals(result.success, false);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('fetchPrRef - stale ref is overwritten (force-fetch)', async () => {
  const upstream = new GitTestRepo();
  const local = new GitTestRepo();

  try {
    await upstream.runCommand('git', ['init', '--bare', upstream.path]);
    await local.init();
    await local.runCommand('git', ['remote', 'add', 'origin', upstream.path], local.path);

    // Helper: push a commit to upstream refs/pull/1/head and return the SHA
    const pushPrHead = async (label: string): Promise<string> => {
      const clone = new GitTestRepo();
      try {
        // Clone may warn about empty repo on first push; ignore stderr
        const cloneCmd = new Deno.Command('git', {
          args: ['clone', upstream.path, clone.path],
          stdout: 'null',
          stderr: 'null',
        });
        await cloneCmd.output();

        await clone.runCommand('git', ['config', 'user.email', 'test@example.com'], clone.path);
        await clone.runCommand('git', ['config', 'user.name', 'Test User'], clone.path);
        await clone.runCommand('git', ['config', 'commit.gpgsign', 'false'], clone.path);
        await Deno.writeTextFile(`${clone.path}/file.txt`, label);
        await clone.runCommand('git', ['add', '-A'], clone.path);
        await clone.runCommand('git', ['commit', '--allow-empty', '-m', `PR commit ${label}`], clone.path);
        await clone.runCommand('git', ['push', '--force', upstream.path, 'HEAD:refs/pull/1/head'], clone.path);

        const shaCmd = new Deno.Command('git', {
          args: ['rev-parse', 'HEAD'],
          cwd: clone.path,
          stdout: 'piped',
          stderr: 'null',
        });
        const { stdout } = await shaCmd.output();
        return new TextDecoder().decode(stdout).trim();
      } finally {
        await clone.cleanup();
      }
    };

    // Push v1 and immediately fetch to establish the stale ref
    const firstSha = await pushPrHead('v1');
    const result1 = await fetchPrRef(1, 'origin', local.path);
    assertEquals(result1.success, true);

    const refCmd1 = new Deno.Command('git', {
      args: ['rev-parse', 'refs/remotes/origin/pr/1'],
      cwd: local.path,
      stdout: 'piped',
      stderr: 'null',
    });
    const { stdout: sha1Out } = await refCmd1.output();
    assertEquals(new TextDecoder().decode(sha1Out).trim(), firstSha, 'ref should point to v1 after first fetch');

    // Force-push v2, then fetch again — stale v1 ref must be overwritten
    const secondSha = await pushPrHead('v2');
    const result2 = await fetchPrRef(1, 'origin', local.path);
    assertEquals(result2.success, true);

    const refCmd2 = new Deno.Command('git', {
      args: ['rev-parse', 'refs/remotes/origin/pr/1'],
      cwd: local.path,
      stdout: 'piped',
      stderr: 'null',
    });
    const { stdout: sha2Out } = await refCmd2.output();
    assertEquals(new TextDecoder().decode(sha2Out).trim(), secondSha, 'ref should point to v2 after force-fetch');
  } finally {
    await upstream.cleanup();
    await local.cleanup();
  }
});
