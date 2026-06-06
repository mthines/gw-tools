/**
 * Tests for telemetry.ts
 *
 * These exercise the pure helpers and the OTLP export path with a mocked
 * `fetch`, so no network access is required. The runtime instrumentation is
 * opt-in and fails open, so the key guarantees under test are:
 *   - disabled by default (no network calls)
 *   - env vars override config
 *   - deployment events carry the correlation attributes Dash0 needs
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { join } from '@std/path';
import {
  finishCommand,
  loadTelemetrySettings,
  parseHeaders,
  sendDeploymentEvent,
  startCommand,
} from './telemetry.ts';

/** Run `fn` with `globalThis.fetch` replaced by a capturing stub. */
async function withMockedFetch(
  fn: (calls: { url: string; body: unknown }[]) => Promise<void> | void,
  status = 200
): Promise<void> {
  const calls: { url: string; body: unknown }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    return Promise.resolve(new Response(null, { status }));
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}

/** Run `fn` with a set of env vars applied, restoring them afterwards. */
async function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void): Promise<void> {
  const prior: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prior[k] = Deno.env.get(k) ?? undefined;
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(prior)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

/** Run `fn` from inside a fresh temp dir (no .gw config), restoring cwd. */
async function inTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const origCwd = Deno.cwd();
  const dir = await Deno.makeTempDir({ prefix: 'gw-telemetry-test-' });
  try {
    Deno.chdir(dir);
    await fn(dir);
  } finally {
    Deno.chdir(origCwd);
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test('parseHeaders - parses comma-separated key=value pairs', () => {
  assertEquals(parseHeaders('Authorization=Bearer abc123,Dash0-Dataset=default'), {
    Authorization: 'Bearer abc123',
    'Dash0-Dataset': 'default',
  });
});

Deno.test('parseHeaders - handles values containing "="', () => {
  assertEquals(parseHeaders('Authorization=Bearer a=b=c'), {
    Authorization: 'Bearer a=b=c',
  });
});

Deno.test('parseHeaders - returns empty object for empty/undefined input', () => {
  assertEquals(parseHeaders(undefined), {});
  assertEquals(parseHeaders(''), {});
});

Deno.test('startCommand - generates well-formed trace and span ids', () => {
  const tx = startCommand('checkout');
  assertEquals(tx.command, 'checkout');
  assertEquals(tx.traceId.length, 32);
  assertEquals(tx.spanId.length, 16);
  assertEquals(/^[0-9a-f]+$/.test(tx.traceId), true);
  assertEquals(/^[0-9a-f]+$/.test(tx.spanId), true);
});

Deno.test('loadTelemetrySettings - disabled by default with no config', async () => {
  await inTempDir(async () => {
    await withEnv(
      { GW_TELEMETRY: undefined, OTEL_SDK_DISABLED: undefined, OTEL_EXPORTER_OTLP_ENDPOINT: undefined },
      async () => {
        const settings = await loadTelemetrySettings();
        assertEquals(settings.enabled, false);
        assertEquals(settings.endpoint, 'http://localhost:4318');
        assertEquals(settings.serviceName, 'gw');
      }
    );
  });
});

Deno.test('loadTelemetrySettings - GW_TELEMETRY=1 force-enables', async () => {
  await inTempDir(async () => {
    await withEnv({ GW_TELEMETRY: '1', OTEL_SDK_DISABLED: undefined }, async () => {
      const settings = await loadTelemetrySettings();
      assertEquals(settings.enabled, true);
    });
  });
});

Deno.test('loadTelemetrySettings - OTEL_SDK_DISABLED wins over enablement', async () => {
  await inTempDir(async () => {
    await withEnv({ GW_TELEMETRY: '1', OTEL_SDK_DISABLED: 'true' }, async () => {
      const settings = await loadTelemetrySettings();
      assertEquals(settings.enabled, false);
    });
  });
});

Deno.test('loadTelemetrySettings - env overrides endpoint and service name', async () => {
  await inTempDir(async () => {
    await withEnv(
      {
        GW_TELEMETRY: '1',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://collector.example.com:4318/',
        OTEL_SERVICE_NAME: 'gw-test',
      },
      async () => {
        const settings = await loadTelemetrySettings();
        // Trailing slash is trimmed.
        assertEquals(settings.endpoint, 'https://collector.example.com:4318');
        assertEquals(settings.serviceName, 'gw-test');
      }
    );
  });
});

Deno.test('loadTelemetrySettings - reads telemetry block from .gw/config.json', async () => {
  await inTempDir(async (dir) => {
    await Deno.mkdir(join(dir, '.gw'));
    await Deno.writeTextFile(
      join(dir, '.gw', 'config.json'),
      JSON.stringify({
        configVersion: 3,
        telemetry: { enabled: true, endpoint: 'http://localhost:9999', environment: 'staging' },
      })
    );
    await withEnv(
      { GW_TELEMETRY: undefined, OTEL_SDK_DISABLED: undefined, OTEL_EXPORTER_OTLP_ENDPOINT: undefined },
      async () => {
        const settings = await loadTelemetrySettings();
        assertEquals(settings.enabled, true);
        assertEquals(settings.endpoint, 'http://localhost:9999');
        assertEquals(settings.environment, 'staging');
      }
    );
  });
});

Deno.test('finishCommand - no network calls when disabled', async () => {
  await inTempDir(async () => {
    await withEnv({ GW_TELEMETRY: '0', OTEL_SDK_DISABLED: undefined }, async () => {
      await withMockedFetch(async (calls) => {
        const tx = startCommand('list');
        await finishCommand(tx, { ok: true });
        assertEquals(calls.length, 0);
      });
    });
  });
});

Deno.test('finishCommand - emits a span and a log when enabled', async () => {
  await inTempDir(async () => {
    await withEnv({ GW_TELEMETRY: '1', OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318' }, async () => {
      await withMockedFetch(async (calls) => {
        const tx = startCommand('checkout');
        await finishCommand(tx, { ok: true });
        assertEquals(calls.length, 2);
        const urls = calls.map((c) => c.url).sort();
        assertEquals(urls, ['http://localhost:4318/v1/logs', 'http://localhost:4318/v1/traces']);
      });
    });
  });
});

Deno.test('finishCommand - records error message on failure', async () => {
  await inTempDir(async () => {
    await withEnv({ GW_TELEMETRY: '1', OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318' }, async () => {
      await withMockedFetch(async (calls) => {
        const tx = startCommand('checkout');
        await finishCommand(tx, { ok: false, error: new Error('boom') });
        const logCall = calls.find((c) => c.url.endsWith('/v1/logs'));
        const serialized = JSON.stringify(logCall?.body);
        assertStringIncludes(serialized, 'boom');
        assertStringIncludes(serialized, 'ERROR');
        assertStringIncludes(serialized, 'error.message');
      });
    });
  });
});

Deno.test('sendDeploymentEvent - posts a deployment.success event log', async () => {
  await withMockedFetch(async (calls) => {
    const ok = await sendDeploymentEvent({
      endpoint: 'http://localhost:4318',
      version: '1.2.3',
      environment: 'production',
      commit: 'abc123',
    });
    assertEquals(ok, true);
    assertEquals(calls.length, 1);
    assertEquals(calls[0].url, 'http://localhost:4318/v1/logs');
    const serialized = JSON.stringify(calls[0].body);
    assertStringIncludes(serialized, 'deployment.success');
    assertStringIncludes(serialized, '1.2.3');
    assertStringIncludes(serialized, 'production');
  });
});

Deno.test('sendDeploymentEvent - returns false when the endpoint rejects', async () => {
  await withMockedFetch(async () => {
    const ok = await sendDeploymentEvent({ endpoint: 'http://localhost:4318', version: '1.2.3' });
    assertEquals(ok, false);
  }, 503);
});
