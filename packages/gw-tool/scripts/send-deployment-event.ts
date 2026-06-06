#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Emit a Dash0 `deployment.success` event log for a gw release.
 *
 * Run from the release pipeline (see scripts/release-ci.sh) after a successful
 * publish. The event carries `service.version`, which Dash0 lines up against
 * the same attribute on runtime error signals to correlate the release with
 * any error spike that follows it.
 *
 * Configuration (highest precedence first):
 *   --endpoint <url>              OTLP/HTTP base endpoint.
 *   OTEL_EXPORTER_OTLP_ENDPOINT   OTLP/HTTP base endpoint.
 *   (build default)               BUILD_TELEMETRY_ENDPOINT baked at compile time.
 *
 *   OTEL_EXPORTER_OTLP_HEADERS    Optional OTLP headers, "k=v,k=v"
 *                                 (e.g. "Authorization=Bearer <token>").
 *   (build default)               BUILD_TELEMETRY_TOKEN / BUILD_TELEMETRY_DATASET.
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read \
 *     scripts/send-deployment-event.ts \
 *     --version 1.2.3 --environment production --commit "$(git rev-parse HEAD)"
 */

import {
  BUILD_TELEMETRY_DATASET,
  BUILD_TELEMETRY_ENDPOINT,
  BUILD_TELEMETRY_TOKEN,
  parseHeaders,
  sendDeploymentEvent,
} from '../src/lib/telemetry.ts';

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  return inline ? inline.slice(`--${name}=`.length) : undefined;
}

async function main(): Promise<void> {
  const args = Deno.args;

  const version = getFlag(args, 'version') ?? Deno.env.get('RELEASE_VERSION')?.replace(/^v/, '');
  if (!version) {
    console.error('send-deployment-event: --version (or RELEASE_VERSION) is required');
    Deno.exit(2);
  }

  // Build bundled headers as fallback defaults; OTEL_EXPORTER_OTLP_HEADERS overrides.
  const buildHeaders: Record<string, string> = {};
  if (BUILD_TELEMETRY_TOKEN) {
    buildHeaders['Authorization'] = `Bearer ${BUILD_TELEMETRY_TOKEN}`;
  }
  if (BUILD_TELEMETRY_DATASET) {
    buildHeaders['Dash0-Dataset'] = BUILD_TELEMETRY_DATASET;
  }
  const envHeaderOverrides = parseHeaders(Deno.env.get('OTEL_EXPORTER_OTLP_HEADERS') ?? undefined);

  const endpoint =
    getFlag(args, 'endpoint') ?? Deno.env.get('OTEL_EXPORTER_OTLP_ENDPOINT') ?? BUILD_TELEMETRY_ENDPOINT ?? '';

  if (!endpoint) {
    console.error('send-deployment-event: no OTLP endpoint configured (OTEL_EXPORTER_OTLP_ENDPOINT or build var)');
    Deno.exit(2);
  }

  // Precedence: env headers > build defaults
  const headers = { ...buildHeaders, ...envHeaderOverrides };

  const ok = await sendDeploymentEvent({
    endpoint,
    headers,
    serviceName: getFlag(args, 'service-name') ?? 'gw',
    version,
    environment: getFlag(args, 'environment') ?? Deno.env.get('GW_DEPLOY_ENVIRONMENT') ?? undefined,
    deploymentId: getFlag(args, 'deployment-id'),
    commit: getFlag(args, 'commit'),
  });

  if (ok) {
    console.log(`✅ Sent deployment.success event for gw v${version} to ${endpoint}`);
  } else {
    console.error(`⚠️  Failed to send deployment event for gw v${version} to ${endpoint}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
