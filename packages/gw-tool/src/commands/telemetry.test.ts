/**
 * Tests for the telemetry command (gw telemetry on/off/status)
 */

import { assertEquals } from '@std/assert';
import { join } from '@std/path';
import { parse as parseJsonc } from '@std/jsonc';
import { executeTelemetry } from './telemetry.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';

/** Run `fn` from inside a fresh temp dir that looks like a gw repo root. */
async function inGwRepo(fn: (dir: string) => Promise<void>): Promise<void> {
  const origCwd = Deno.cwd();
  const dir = await Deno.makeTempDir({ prefix: 'gw-telemetry-cmd-test-' });
  try {
    // Set up a minimal git repo with .gw config
    const gitCmd = new Deno.Command('git', {
      args: ['init'],
      cwd: dir,
      stdout: 'piped',
      stderr: 'piped',
    });
    await gitCmd.output();

    await Deno.mkdir(join(dir, '.gw'), { recursive: true });
    await Deno.writeTextFile(
      join(dir, '.gw', 'config.json'),
      JSON.stringify({ configVersion: 4, defaultBranch: 'main' }, null, 2) + '\n'
    );
    // Write .gitignore so the warning check passes
    await Deno.writeTextFile(join(dir, '.gw', '.gitignore'), 'config.local.json\nstate.json\n');

    Deno.chdir(dir);
    await fn(dir);
  } finally {
    Deno.chdir(origCwd);
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test('gw telemetry on - writes config.local.json with enabled:true', async () => {
  await inGwRepo(async (dir) => {
    await executeTelemetry(['on']);

    const localConfigPath = join(dir, '.gw', 'config.local.json');
    const content = await Deno.readTextFile(localConfigPath);
    const parsed = parseJsonc(content) as Record<string, Record<string, unknown>>;

    assertEquals(parsed.telemetry?.enabled, true);
  });
});

Deno.test('gw telemetry off - writes config.local.json with enabled:false', async () => {
  await inGwRepo(async (dir) => {
    await executeTelemetry(['off']);

    const localConfigPath = join(dir, '.gw', 'config.local.json');
    const content = await Deno.readTextFile(localConfigPath);
    const parsed = parseJsonc(content) as Record<string, Record<string, unknown>>;

    assertEquals(parsed.telemetry?.enabled, false);
  });
});

Deno.test('gw telemetry on - deep-merges into existing config.local.json', async () => {
  await inGwRepo(async (dir) => {
    const localConfigPath = join(dir, '.gw', 'config.local.json');

    // Pre-populate with existing fields
    await Deno.writeTextFile(
      localConfigPath,
      JSON.stringify(
        {
          telemetry: { endpoint: 'http://custom:4318', headers: { Authorization: 'Bearer existing' } },
        },
        null,
        2
      ) + '\n'
    );

    await executeTelemetry(['on']);

    const content = await Deno.readTextFile(localConfigPath);
    const parsed = parseJsonc(content) as Record<string, Record<string, unknown>>;

    // enabled is set
    assertEquals(parsed.telemetry?.enabled, true);
    // Existing fields are preserved
    assertEquals(parsed.telemetry?.endpoint, 'http://custom:4318');
    assertEquals((parsed.telemetry?.headers as Record<string, string>)?.Authorization, 'Bearer existing');
  });
});

Deno.test('gw telemetry off - deep-merges into existing config.local.json', async () => {
  await inGwRepo(async (dir) => {
    const localConfigPath = join(dir, '.gw', 'config.local.json');

    // Pre-populate
    await Deno.writeTextFile(
      localConfigPath,
      JSON.stringify({ telemetry: { enabled: true, endpoint: 'http://custom:4318' } }, null, 2) + '\n'
    );

    await executeTelemetry(['off']);

    const content = await Deno.readTextFile(localConfigPath);
    const parsed = parseJsonc(content) as Record<string, Record<string, unknown>>;

    assertEquals(parsed.telemetry?.enabled, false);
    // Other fields preserved
    assertEquals(parsed.telemetry?.endpoint, 'http://custom:4318');
  });
});

Deno.test('gw telemetry status - does not throw (smoke test)', async () => {
  await inGwRepo(async () => {
    // Should complete without error; we don't assert stdout here due to color codes
    await executeTelemetry(['status']);
  });
});

Deno.test('gw telemetry - unknown subcommand exits with code 1', async () => {
  await inGwRepo(async () => {
    const { exitCode } = await withMockedExit(() => executeTelemetry(['unknown-subcommand']));
    assertEquals(exitCode, 1);
  });
});
