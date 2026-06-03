/**
 * Tests for the tiny .env loader used by prResolver subprocesses.
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { join } from '@std/path';
import { loadResolverEnv, parseDotenv } from './dotenv.ts';
import { TempEnv } from '../test-utils/temp-env.ts';

Deno.test('parseDotenv - simple KEY=value', () => {
  const out = parseDotenv('FOO=bar\nBAZ=qux\n');
  assertEquals(out, { FOO: 'bar', BAZ: 'qux' });
});

Deno.test('parseDotenv - blank lines and comments are ignored', () => {
  const out = parseDotenv('\n# leading comment\nFOO=bar\n\n# inline-looking but line-leading\n');
  assertEquals(out, { FOO: 'bar' });
});

Deno.test('parseDotenv - strips matched surrounding quotes', () => {
  const out = parseDotenv('A="value one"\nB=\'value two\'\nC="mixed\'\n');
  assertEquals(out.A, 'value one');
  assertEquals(out.B, 'value two');
  // Mixed quotes: not a matched pair, kept as-is.
  assertEquals(out.C, '"mixed\'');
});

Deno.test('parseDotenv - export prefix is stripped', () => {
  const out = parseDotenv('export FOO=bar\n');
  assertEquals(out, { FOO: 'bar' });
});

Deno.test('parseDotenv - rejects malformed keys', () => {
  const out = parseDotenv('1FOO=bar\nfoo-bar=baz\nFOO=ok\n');
  assertEquals(out, { FOO: 'ok' });
});

Deno.test('parseDotenv - skips lines without =', () => {
  const out = parseDotenv('FOO\n=orphan\nBAR=baz\n');
  assertEquals(out, { BAR: 'baz' });
});

Deno.test('parseDotenv - handles CRLF line endings', () => {
  const out = parseDotenv('FOO=bar\r\nBAZ=qux\r\n');
  assertEquals(out, { FOO: 'bar', BAZ: 'qux' });
});

Deno.test('parseDotenv - inline # comments are NOT stripped (kept in value)', () => {
  // The parser only strips line-leading comments. Inline `# comment` sequences
  // are treated as part of the value. This matches dotenv-java / dotenv-go
  // behavior and differs from bash, where inline comments are stripped.
  // Users should quote values that contain # to avoid confusion:
  //   TOKEN="abc123" # this is fine — quotes are stripped, comment is outside
  //   TOKEN=abc123   # this includes " # this includes" in the value
  const out = parseDotenv('TOKEN=abc123 # my api token\n');
  assertEquals(out.TOKEN, 'abc123 # my api token');
});

Deno.test('parseDotenv - quoted values with trailing inline comment strip quotes only', () => {
  // `TOKEN="abc123" # comment` → quotes stripped → value is `abc123`, # comment is outside quotes
  // But our parser strips quotes only when the WHOLE value is a matched pair.
  // `"abc123" # comment` does NOT end with `"`, so quotes are not stripped.
  const out = parseDotenv('TOKEN="abc123" # my api token\n');
  // Value after `=`: `"abc123" # my api token` — does not start+end with same quote char → kept as-is.
  assertEquals(out.TOKEN, '"abc123" # my api token');
});

Deno.test('loadResolverEnv - missing .env is not an error', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-dotenv-test-' });
  try {
    const env = await loadResolverEnv(tempDir);
    // Parent env should still be present.
    assertNotEquals(Object.keys(env).length, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('loadResolverEnv - reads .gw/.env when present', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-dotenv-test-' });
  try {
    await Deno.mkdir(join(tempDir, '.gw'));
    await Deno.writeTextFile(join(tempDir, '.gw', '.env'), 'GW_TEST_TOKEN=hello\nGW_TEST_OTHER=world\n');

    const tempEnv = new TempEnv();
    tempEnv.delete('GW_TEST_TOKEN');
    tempEnv.delete('GW_TEST_OTHER');
    try {
      const env = await loadResolverEnv(tempDir);
      assertEquals(env.GW_TEST_TOKEN, 'hello');
      assertEquals(env.GW_TEST_OTHER, 'world');
    } finally {
      tempEnv.restore();
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('loadResolverEnv - parent env wins over .gw/.env', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-dotenv-test-' });
  try {
    await Deno.mkdir(join(tempDir, '.gw'));
    await Deno.writeTextFile(join(tempDir, '.gw', '.env'), 'GW_TEST_TOKEN=from_dotenv\n');

    const tempEnv = new TempEnv();
    tempEnv.set('GW_TEST_TOKEN', 'from_parent');
    try {
      const env = await loadResolverEnv(tempDir);
      assertEquals(env.GW_TEST_TOKEN, 'from_parent');
    } finally {
      tempEnv.restore();
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
