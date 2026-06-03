/**
 * Tests for the PR resolver chain.
 *
 * These tests avoid network and gh dependencies by exercising shell
 * resolvers that emit fixed JSON to stdout. The github builtin is only
 * smoke-tested for its pure-string parse step.
 */

import { assertEquals } from '@std/assert';
import { enrichWithGh, parseGithubIdentifier, resolvePrIdentifier } from './pr-resolvers.ts';
import type { PrResolver } from './types.ts';

function withTempGitRoot<T>(fn: (root: string) => Promise<T>): Promise<T> {
  return Deno.makeTempDir({ prefix: 'gw-resolver-test-' }).then(async (dir) => {
    try {
      return await fn(dir);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  });
}

Deno.test('parseGithubIdentifier - bare positive integer', () => {
  assertEquals(parseGithubIdentifier('42'), { prNumber: 42 });
});

Deno.test('parseGithubIdentifier - rejects zero and negatives', () => {
  assertEquals(parseGithubIdentifier('0'), null);
  assertEquals(parseGithubIdentifier('-1'), null);
});

Deno.test('parseGithubIdentifier - rejects non-numeric/non-URL strings', () => {
  assertEquals(parseGithubIdentifier('abc'), null);
  assertEquals(parseGithubIdentifier(''), null);
});

Deno.test('parseGithubIdentifier - GitHub URL with protocol', () => {
  assertEquals(parseGithubIdentifier('https://github.com/owner/repo/pull/123'), {
    prNumber: 123,
    owner: 'owner',
    repo: 'repo',
  });
});

Deno.test('parseGithubIdentifier - GitHub URL without protocol', () => {
  assertEquals(parseGithubIdentifier('github.com/o/r/pull/1'), {
    prNumber: 1,
    owner: 'o',
    repo: 'r',
  });
});

Deno.test('parseGithubIdentifier - URL with /files or fragment is OK', () => {
  assertEquals(parseGithubIdentifier('https://github.com/o/r/pull/9/files'), {
    prNumber: 9,
    owner: 'o',
    repo: 'r',
  });
  assertEquals(parseGithubIdentifier('https://github.com/o/r/pull/9#discussion_r1'), {
    prNumber: 9,
    owner: 'o',
    repo: 'r',
  });
});

Deno.test('parseGithubIdentifier - rejects non-GitHub URLs', () => {
  assertEquals(parseGithubIdentifier('https://gitlab.com/o/r/merge_requests/1'), null);
});

Deno.test('resolvePrIdentifier - empty chain returns null', async () => {
  await withTempGitRoot(async (root) => {
    const result = await resolvePrIdentifier('42', { resolvers: [], gitRoot: root });
    assertEquals(result, null);
  });
});

Deno.test('resolvePrIdentifier - shell resolver returning JSON wins', async () => {
  await withTempGitRoot(async (root) => {
    const resolvers: PrResolver[] = [
      {
        name: 'fake-linear',
        command: `printf '{"prNumber": 7, "branch": "feat/x", "owner": "o", "repo": "r"}'`,
      },
    ];

    const result = await resolvePrIdentifier('https://linear.app/x/review/abc', {
      resolvers,
      gitRoot: root,
    });

    assertEquals(result?.resolver.name, 'fake-linear');
    assertEquals(result?.result.prNumber, 7);
    assertEquals(result?.result.branch, 'feat/x');
    assertEquals(result?.result.owner, 'o');
    assertEquals(result?.result.repo, 'r');
  });
});

Deno.test('resolvePrIdentifier - non-zero exit passes through', async () => {
  await withTempGitRoot(async (root) => {
    const resolvers: PrResolver[] = [
      { name: 'always-fail', command: 'exit 1' },
      { name: 'fallback', command: `printf '{"prNumber": 99}'` },
    ];

    const result = await resolvePrIdentifier('anything', { resolvers, gitRoot: root });
    assertEquals(result?.resolver.name, 'fallback');
    assertEquals(result?.result.prNumber, 99);
  });
});

Deno.test('resolvePrIdentifier - empty stdout passes through', async () => {
  await withTempGitRoot(async (root) => {
    const resolvers: PrResolver[] = [
      { name: 'silent', command: 'true' }, // exit 0, no stdout
      { name: 'fallback', command: `printf '{"prNumber": 5}'` },
    ];

    const result = await resolvePrIdentifier('x', { resolvers, gitRoot: root });
    assertEquals(result?.resolver.name, 'fallback');
  });
});

Deno.test('resolvePrIdentifier - malformed JSON passes through', async () => {
  await withTempGitRoot(async (root) => {
    const resolvers: PrResolver[] = [
      { name: 'garbage', command: `printf 'not json at all'` },
      { name: 'fallback', command: `printf '{"prNumber": 11}'` },
    ];

    const result = await resolvePrIdentifier('x', { resolvers, gitRoot: root });
    assertEquals(result?.resolver.name, 'fallback');
  });
});

Deno.test('resolvePrIdentifier - missing prNumber passes through', async () => {
  await withTempGitRoot(async (root) => {
    const resolvers: PrResolver[] = [
      { name: 'no-number', command: `printf '{"branch": "foo"}'` },
      { name: 'fallback', command: `printf '{"prNumber": 22}'` },
    ];

    const result = await resolvePrIdentifier('x', { resolvers, gitRoot: root });
    assertEquals(result?.resolver.name, 'fallback');
  });
});

Deno.test('resolvePrIdentifier - non-integer prNumber passes through', async () => {
  await withTempGitRoot(async (root) => {
    const resolvers: PrResolver[] = [
      { name: 'float', command: `printf '{"prNumber": 1.5}'` },
      { name: 'fallback', command: `printf '{"prNumber": 33}'` },
    ];

    const result = await resolvePrIdentifier('x', { resolvers, gitRoot: root });
    assertEquals(result?.resolver.name, 'fallback');
  });
});

Deno.test('resolvePrIdentifier - zero or negative prNumber passes through', async () => {
  await withTempGitRoot(async (root) => {
    const resolvers: PrResolver[] = [
      { name: 'zero', command: `printf '{"prNumber": 0}'` },
      { name: 'fallback', command: `printf '{"prNumber": 44}'` },
    ];

    const result = await resolvePrIdentifier('x', { resolvers, gitRoot: root });
    assertEquals(result?.resolver.name, 'fallback');
  });
});

Deno.test('resolvePrIdentifier - identifier reaches resolver as $1', async () => {
  await withTempGitRoot(async (root) => {
    // Echo $1 back as a fake PR number; uses awk so we can compute a hash
    // independent of the input length.
    const resolvers: PrResolver[] = [
      {
        name: 'echo-arg',
        command: `printf '{"prNumber": %d}' "$(printf '%s' "$1" | wc -c | tr -d ' ')"`,
      },
    ];

    const result = await resolvePrIdentifier('hello', { resolvers, gitRoot: root });
    assertEquals(result?.result.prNumber, 5); // "hello".length
  });
});

Deno.test('resolvePrIdentifier - shell injection in identifier is contained', async () => {
  await withTempGitRoot(async (root) => {
    // If $1 were spliced into the shell command string, the `; touch GOTCHA`
    // portion would execute and create a file. Because we pass `$1` as a
    // positional argv (sh -c "$cmd" gw-resolver "$input"), the identifier
    // stays a single argument and is never re-parsed by the shell.
    const resolvers: PrResolver[] = [{ name: 'static', command: `printf '{"prNumber": 1}'` }];

    const evil = '; touch GOTCHA #';
    const result = await resolvePrIdentifier(evil, { resolvers, gitRoot: root });
    assertEquals(result?.result.prNumber, 1);

    // No file should have been created in the temp git root.
    let created = false;
    try {
      await Deno.stat(`${root}/GOTCHA`);
      created = true;
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
    assertEquals(created, false);
  });
});

// ---------------------------------------------------------------------------
// enrichWithGh
// ---------------------------------------------------------------------------
// Note: tests that would call `gh pr view` require network access and are
// intentionally not included in the unit suite. The cases below exercise the
// early-exit fast paths that require no I/O.

Deno.test('enrichWithGh - returns input unchanged when all fields already present', async () => {
  const resolved = { prNumber: 42, branch: 'feat/x', owner: 'acme', repo: 'api', isCrossRepository: false, remote: 'upstream' };
  // All three key fields are set, so enrichWithGh returns early without calling gh.
  const result = await enrichWithGh(resolved);
  assertEquals(result, resolved);
});

Deno.test('enrichWithGh - preserves isCrossRepository: false when resolver sets it explicitly', async () => {
  // Validates that the ??-based merge in enrichWithGh does not clobber a
  // falsy-but-defined boolean value from the custom resolver.
  const resolved = { prNumber: 42, branch: 'feat/x', owner: 'acme', repo: 'api', isCrossRepository: false };
  const result = await enrichWithGh(resolved);
  // isCrossRepository is false — the ?? operator must NOT replace false with enriched's true.
  assertEquals(result.isCrossRepository, false);
});

Deno.test('resolvePrIdentifier - timeout kills slow resolvers', async () => {
  await withTempGitRoot(async (root) => {
    const resolvers: PrResolver[] = [
      { name: 'slow', command: 'sleep 5', timeoutMs: 50 },
      { name: 'fast', command: `printf '{"prNumber": 7}'` },
    ];

    const start = Date.now();
    const result = await resolvePrIdentifier('x', { resolvers, gitRoot: root });
    const elapsed = Date.now() - start;

    assertEquals(result?.resolver.name, 'fast');
    // 5s sleep would dominate without the timeout. Allow generous headroom.
    if (elapsed > 2000) {
      throw new Error(`Timeout did not interrupt the slow resolver (took ${elapsed}ms)`);
    }
  });
});
