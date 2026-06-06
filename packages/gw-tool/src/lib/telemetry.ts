/**
 * OpenTelemetry / Dash0 telemetry for the gw CLI.
 *
 * gw is a short-lived Deno CLI, so this module is intentionally
 * dependency-free: it speaks OTLP/HTTP (JSON) directly via `fetch` rather
 * than pulling in the OpenTelemetry SDK. That keeps the compiled binary lean
 * (the release build uses `deno compile --no-npm`) and lets us control the
 * flush-before-exit behaviour that short-lived processes require.
 *
 * Design rules:
 * - **Opt-in.** Nothing is emitted unless telemetry is enabled in
 *   `.gw/config.json` (or via the `GW_TELEMETRY` env var).
 * - **Fail open.** Any export error is swallowed. Telemetry must never slow
 *   down or break a gw command, and must never write to stdout (several
 *   commands emit shell code on stdout that is `eval`'d).
 * - **No PII by default.** Only safe fields (command name, exit code,
 *   duration, version) are attached. Branch names, repo paths and file names
 *   are never sent. Error messages are included so failures can be
 *   investigated — redact them in the Collector (OTTL) if that is a concern.
 *
 * Deployment ↔ error correlation:
 * every signal carries the `service.version` resource attribute, and the
 * release pipeline emits a `deployment.success` event log (see
 * `sendDeploymentEvent`). Dash0 lines the two up by `service.version` so a
 * release can be correlated with any error spike that follows it.
 */

import { dirname, join } from '@std/path';
import { parse as parseJsonc } from '@std/jsonc';
import type { TelemetryConfig } from './types.ts';
import { VERSION } from './version.ts';

/** Default OTLP/HTTP endpoint — a local OpenTelemetry Collector. */
const DEFAULT_ENDPOINT = 'http://localhost:4318';
/** Default flush timeout for runtime command telemetry (ms). */
const DEFAULT_TIMEOUT_MS = 1500;

/** OTLP severity numbers (subset). */
const SEVERITY_INFO = 9;
const SEVERITY_ERROR = 17;

/** Span kind: INTERNAL. */
const SPAN_KIND_INTERNAL = 1;
/** Span status codes. */
const STATUS_UNSET = 0;
const STATUS_ERROR = 2;

// ---------------------------------------------------------------------------
// OTLP/HTTP JSON payload shapes (minimal subset of the spec)
// ---------------------------------------------------------------------------

interface OtlpAnyValue {
  stringValue?: string;
  intValue?: string;
  boolValue?: boolean;
}

interface OtlpAttribute {
  key: string;
  value: OtlpAnyValue;
}

interface OtlpResource {
  attributes: OtlpAttribute[];
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  status: { code: number; message?: string };
}

interface OtlpLogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: OtlpAnyValue;
  attributes: OtlpAttribute[];
  traceId?: string;
  spanId?: string;
  eventName?: string;
}

/**
 * Telemetry settings after merging config, defaults and env overrides.
 */
export interface ResolvedTelemetrySettings {
  enabled: boolean;
  endpoint: string;
  environment?: string;
  serviceName: string;
  headers: Record<string, string>;
  timeoutMs: number;
}

/**
 * Opaque handle returned by {@link startCommand} and passed to
 * {@link finishCommand}.
 */
export interface CommandTelemetry {
  command: string;
  startUnixNano: bigint;
  startPerf: number;
  traceId: string;
  spanId: string;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Emit a debug line to stderr only when GW_TELEMETRY_DEBUG is set. */
function debug(message: string): void {
  try {
    if (Deno.env.get('GW_TELEMETRY_DEBUG')) {
      console.error(`[gw telemetry] ${message}`);
    }
  } catch {
    // Ignore — env access may be denied; debug logging is best-effort.
  }
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function isFalsy(value: string | undefined): boolean {
  if (value === undefined) return false;
  const v = value.trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'no' || v === 'off';
}

function strAttr(key: string, value: string): OtlpAttribute {
  return { key, value: { stringValue: value } };
}

function intAttr(key: string, value: number): OtlpAttribute {
  return { key, value: { intValue: Math.trunc(value).toString() } };
}

function boolAttr(key: string, value: boolean): OtlpAttribute {
  return { key, value: { boolValue: value } };
}

/** Current wall-clock time in Unix nanoseconds (ms precision is fine). */
function nowUnixNano(): bigint {
  return BigInt(Date.now()) * 1_000_000n;
}

/** Generate a random hex string of `bytes` bytes (32 chars for a trace id). */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let out = '';
  for (const b of arr) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/** Parse OTEL_EXPORTER_OTLP_HEADERS ("k1=v1,k2=v2") into a record. */
export function parseHeaders(raw: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!raw) return headers;
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

/** Pull deployment.environment.name out of OTEL_RESOURCE_ATTRIBUTES, if present. */
function environmentFromEnv(): string | undefined {
  let raw: string | undefined;
  try {
    raw = Deno.env.get('OTEL_RESOURCE_ATTRIBUTES') ?? undefined;
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === 'deployment.environment.name' || key === 'deployment.environment') {
      return pair.slice(idx + 1).trim() || undefined;
    }
  }
  return undefined;
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function envGet(name: string): string | undefined {
  try {
    return Deno.env.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Config loading (side-effect free — never creates or mutates config files)
// ---------------------------------------------------------------------------

/**
 * Read the `telemetry` block from the nearest `.gw/config.json`, walking up
 * from the current working directory. Personal overrides in the gitignored
 * `.gw/config.local.json` are merged on top (matching `loadConfig`).
 *
 * This is deliberately independent of `loadConfig()` so telemetry has zero
 * side effects: it never creates a config, never prints, and silently returns
 * `undefined` outside a configured repo.
 */
async function readNearestTelemetryConfig(): Promise<TelemetryConfig | undefined> {
  let dir: string;
  try {
    dir = Deno.cwd();
  } catch {
    return undefined;
  }

  while (true) {
    const configDir = join(dir, '.gw');
    const configPath = join(configDir, 'config.json');

    let merged: Record<string, unknown> | undefined;
    try {
      const content = await Deno.readTextFile(configPath);
      merged = parseJsonc(content) as Record<string, unknown>;
    } catch {
      merged = undefined;
    }

    if (merged) {
      // Merge local overrides if present (gitignored, may hold secrets).
      try {
        const localContent = await Deno.readTextFile(join(configDir, 'config.local.json'));
        Object.assign(merged, parseJsonc(localContent) as Record<string, unknown>);
      } catch {
        // No local override — fine.
      }
      const telemetry = merged.telemetry;
      if (telemetry && typeof telemetry === 'object' && !Array.isArray(telemetry)) {
        return telemetry as TelemetryConfig;
      }
      // First config wins, even if it has no telemetry block.
      return undefined;
    }

    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Resolve effective telemetry settings from config + env overrides.
 *
 * Precedence (highest first): env vars, then `.gw/config.local.json`, then
 * `.gw/config.json`, then built-in defaults. Standard OTEL_* env vars are
 * honoured so power users and CI can configure exporting without touching
 * the committed config.
 */
export async function loadTelemetrySettings(): Promise<ResolvedTelemetrySettings> {
  const cfg: TelemetryConfig = (await readNearestTelemetryConfig()) ?? {};

  // Enablement: config opts in; GW_TELEMETRY can force on/off; OTEL_SDK_DISABLED
  // is an industry-standard hard kill switch.
  let enabled = cfg.enabled === true;
  const gwToggle = envGet('GW_TELEMETRY');
  if (isTruthy(gwToggle)) enabled = true;
  if (isFalsy(gwToggle)) enabled = false;
  if (isTruthy(envGet('OTEL_SDK_DISABLED'))) enabled = false;

  const endpoint = (envGet('OTEL_EXPORTER_OTLP_ENDPOINT') ?? cfg.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, '');
  const serviceName = envGet('OTEL_SERVICE_NAME') ?? cfg.serviceName ?? 'gw';
  const environment = environmentFromEnv() ?? cfg.environment;
  const headers = { ...(cfg.headers ?? {}), ...parseHeaders(envGet('OTEL_EXPORTER_OTLP_HEADERS')) };
  const timeoutMs = typeof cfg.timeoutMs === 'number' && cfg.timeoutMs > 0 ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;

  return { enabled, endpoint, environment, serviceName, headers, timeoutMs };
}

// ---------------------------------------------------------------------------
// OTLP export
// ---------------------------------------------------------------------------

/**
 * Build the OTLP resource: identifies the entity producing telemetry. The
 * `service.version` attribute here is what enables deployment correlation.
 */
function buildResource(settings: ResolvedTelemetrySettings, version: string): OtlpResource {
  const attributes: OtlpAttribute[] = [
    strAttr('service.name', settings.serviceName),
    strAttr('service.version', version),
    strAttr('service.instance.id', crypto.randomUUID()),
    strAttr('telemetry.sdk.name', 'gw-otlp'),
    strAttr('telemetry.sdk.language', 'deno'),
  ];
  if (settings.environment) {
    attributes.push(strAttr('deployment.environment.name', settings.environment));
  }
  return { attributes };
}

/** POST an OTLP/HTTP JSON payload. Returns true on a 2xx response. */
async function postOtlp(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // Drain the body so the connection can be reused/closed promptly.
    await response.body?.cancel();
    if (!response.ok) {
      debug(`OTLP export to ${url} returned HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    debug(`OTLP export to ${url} failed: ${errorToMessage(error)}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function postTraces(settings: ResolvedTelemetrySettings, resource: OtlpResource, spans: OtlpSpan[]): Promise<boolean> {
  const payload = {
    resourceSpans: [
      {
        resource,
        scopeSpans: [{ scope: { name: 'gw', version: VERSION }, spans }],
      },
    ],
  };
  return postOtlp(`${settings.endpoint}/v1/traces`, payload, settings.headers, settings.timeoutMs);
}

function postLogs(
  settings: ResolvedTelemetrySettings,
  resource: OtlpResource,
  logRecords: OtlpLogRecord[]
): Promise<boolean> {
  const payload = {
    resourceLogs: [
      {
        resource,
        scopeLogs: [{ scope: { name: 'gw', version: VERSION }, logRecords }],
      },
    ],
  };
  return postOtlp(`${settings.endpoint}/v1/logs`, payload, settings.headers, settings.timeoutMs);
}

// ---------------------------------------------------------------------------
// Public API — runtime command instrumentation
// ---------------------------------------------------------------------------

/**
 * Begin timing a command. Cheap and synchronous — safe to call on every
 * invocation regardless of whether telemetry is enabled (the decision is made
 * later in {@link finishCommand}).
 *
 * @param command The dispatched command name (e.g. "checkout").
 */
export function startCommand(command: string): CommandTelemetry {
  return {
    command,
    startUnixNano: nowUnixNano(),
    startPerf: performance.now(),
    traceId: randomHex(16),
    spanId: randomHex(8),
  };
}

/**
 * Finish a command: emit one span and one log record describing the
 * invocation, then flush before the process exits. No-op (and no network
 * access) when telemetry is disabled. Never throws.
 *
 * @param tx Handle from {@link startCommand}.
 * @param result Outcome of the command — `ok` plus the thrown `error`, if any.
 */
export async function finishCommand(tx: CommandTelemetry, result: { ok: boolean; error?: unknown }): Promise<void> {
  try {
    const settings = await loadTelemetrySettings();
    if (!settings.enabled) return;

    const endUnixNano = nowUnixNano();
    const durationMs = Math.max(0, Math.round(performance.now() - tx.startPerf));
    const ok = result.ok;
    const exitCode = ok ? 0 : 1;
    const errorMessage = ok ? undefined : errorToMessage(result.error);

    const resource = buildResource(settings, VERSION);

    const attributes: OtlpAttribute[] = [
      strAttr('gw.command', tx.command),
      intAttr('gw.command.exit_code', exitCode),
      intAttr('gw.command.duration_ms', durationMs),
      boolAttr('gw.command.success', ok),
      strAttr('service.version', VERSION),
    ];
    if (errorMessage) {
      attributes.push(strAttr('error.message', errorMessage));
    }

    const span: OtlpSpan = {
      traceId: tx.traceId,
      spanId: tx.spanId,
      name: `gw ${tx.command}`,
      kind: SPAN_KIND_INTERNAL,
      startTimeUnixNano: tx.startUnixNano.toString(),
      endTimeUnixNano: endUnixNano.toString(),
      attributes,
      status: ok ? { code: STATUS_UNSET } : { code: STATUS_ERROR, message: errorMessage ?? 'error' },
    };

    const log: OtlpLogRecord = {
      timeUnixNano: endUnixNano.toString(),
      severityNumber: ok ? SEVERITY_INFO : SEVERITY_ERROR,
      severityText: ok ? 'INFO' : 'ERROR',
      body: { stringValue: ok ? `gw ${tx.command} completed` : errorMessage ?? `gw ${tx.command} failed` },
      attributes,
      traceId: tx.traceId,
      spanId: tx.spanId,
    };

    await Promise.all([postTraces(settings, resource, [span]), postLogs(settings, resource, [log])]);
  } catch (error) {
    debug(`finishCommand failed: ${errorToMessage(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Public API — deployment events (used by the release pipeline)
// ---------------------------------------------------------------------------

/**
 * Options for {@link sendDeploymentEvent}.
 */
export interface DeploymentEventOptions {
  /** OTLP/HTTP base endpoint (Collector or Dash0). */
  endpoint: string;
  /** Optional OTLP headers (e.g. Authorization for direct-to-Dash0). */
  headers?: Record<string, string>;
  /** service.name (default: "gw"). */
  serviceName?: string;
  /** The released version — becomes service.version on the event. */
  version: string;
  /** deployment.environment.name (e.g. "production"). */
  environment?: string;
  /** Stable id for the deployment (defaults to the version). */
  deploymentId?: string;
  /** Git commit SHA the release was built from. */
  commit?: string;
  /** Export timeout in ms (default: 5000 — release pipelines can wait). */
  timeoutMs?: number;
}

/**
 * Emit a `deployment.success` event log to Dash0. This is the deployment
 * marker that, paired with the matching `service.version` on error signals,
 * lets Dash0 correlate a release with the errors that follow it.
 *
 * Intended for the release pipeline, not the runtime CLI. Returns true if the
 * event was accepted by the endpoint.
 */
export async function sendDeploymentEvent(opts: DeploymentEventOptions): Promise<boolean> {
  const settings: ResolvedTelemetrySettings = {
    enabled: true,
    endpoint: opts.endpoint.replace(/\/+$/, ''),
    environment: opts.environment,
    serviceName: opts.serviceName ?? 'gw',
    headers: opts.headers ?? {},
    timeoutMs: opts.timeoutMs ?? 5000,
  };

  const resource = buildResource(settings, opts.version);

  const attributes: OtlpAttribute[] = [
    strAttr('otel.event.name', 'deployment.success'),
    strAttr('service.version', opts.version),
    strAttr('deployment.id', opts.deploymentId ?? opts.version),
  ];
  if (opts.environment) attributes.push(strAttr('deployment.environment.name', opts.environment));
  if (opts.commit) attributes.push(strAttr('vcs.repository.ref.revision', opts.commit));

  const log: OtlpLogRecord = {
    timeUnixNano: nowUnixNano().toString(),
    severityNumber: SEVERITY_INFO,
    severityText: 'INFO',
    eventName: 'deployment.success',
    body: { stringValue: `gw ${opts.version} deployed` },
    attributes,
  };

  return await postLogs(settings, resource, [log]);
}
