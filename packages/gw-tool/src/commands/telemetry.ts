/**
 * Telemetry command implementation
 * Manage gw's opt-in anonymous usage telemetry
 */

import { join } from '@std/path';
import { parse as parseJsonc } from '@std/jsonc';
import { findGitRoot, getWorktreeRoot } from '../lib/path-resolver.ts';
import { loadTelemetrySettings } from '../lib/telemetry.ts';
import * as output from '../lib/output.ts';

function parseTelemetryArgs(args: string[]): {
  subcommand: string | undefined;
  help: boolean;
} {
  if (args.includes('--help') || args.includes('-h')) {
    return { subcommand: undefined, help: true };
  }
  return { subcommand: args[0], help: false };
}

function showTelemetryHelp(): void {
  console.log(`
gw telemetry - Manage anonymous usage telemetry

Usage:
  gw telemetry <subcommand>

Subcommands:
  status    Show current telemetry state (on/off, endpoint, dataset)
  on        Opt in on this machine (writes .gw/config.local.json)
  off       Opt out on this machine (writes .gw/config.local.json)

Options:
  -h, --help    Show this help message

Description:
  gw can send anonymous usage data (command name, duration, exit code,
  error kind) to the maintainer's Dash0 instance. This helps improve gw
  by surfacing error patterns and correlating releases with regressions.

  No branch names, file paths, or user-identifiable information are sent.
  The opt-in decision is stored in .gw/config.local.json (gitignored) so
  it applies only to this machine and is never committed.

  Emergency kill switch: set OTEL_SDK_DISABLED=true to disable regardless
  of config. Run 'gw telemetry status' to verify the effective state.

Examples:
  gw telemetry status
  gw telemetry on
  gw telemetry off
`);
}

async function findLocalConfigPath(): Promise<string | null> {
  try {
    const worktreeRoot = await getWorktreeRoot().catch(() => findGitRoot());
    return join(worktreeRoot, '.gw', 'config.local.json');
  } catch {
    return null;
  }
}

async function readLocalConfig(path: string): Promise<Record<string, unknown>> {
  try {
    return parseJsonc(await Deno.readTextFile(path)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeLocalConfig(path: string, config: Record<string, unknown>): Promise<void> {
  await Deno.mkdir(join(path, '..'), { recursive: true });
  await Deno.writeTextFile(path, JSON.stringify(config, null, 2) + '\n');
}

async function warnIfLocalConfigNotIgnored(localConfigPath: string): Promise<void> {
  try {
    const gitignorePath = join(localConfigPath, '..', '.gitignore');
    const content = await Deno.readTextFile(gitignorePath).catch(() => '');
    if (!content.includes('config.local.json')) {
      output.warning(
        '.gw/.gitignore does not appear to cover config.local.json. ' + 'Run `gw init` to regenerate the gitignore.'
      );
    }
  } catch {
    // Best-effort check; ignore errors.
  }
}

async function setEnabled(value: boolean): Promise<void> {
  const localConfigPath = await findLocalConfigPath();
  if (!localConfigPath) {
    output.error('Not in a gw-managed repository. Run `gw init` first.');
    Deno.exit(1);
  }

  const existing = await readLocalConfig(localConfigPath);
  const existingTelemetry = (existing.telemetry ?? {}) as Record<string, unknown>;

  const updated: Record<string, unknown> = {
    ...existing,
    telemetry: { ...existingTelemetry, enabled: value },
  };

  await writeLocalConfig(localConfigPath, updated);

  if (value) {
    output.success('Telemetry enabled on this machine');
    console.log(`  Config: ${output.path(localConfigPath)}`);
    console.log('');
    console.log('  What is sent: command name, duration, exit code, error kind.');
    console.log('  What is NOT sent: branch names, file paths, user identity.');
    console.log('  Details: https://github.com/mthines/gw-tools#telemetry');
    console.log('');
    console.log(`  To opt out: ${output.bold('gw telemetry off')}`);
  } else {
    output.success('Telemetry disabled on this machine');
    console.log(`  Config: ${output.path(localConfigPath)}`);
  }

  await warnIfLocalConfigNotIgnored(localConfigPath);
}

async function showStatus(): Promise<void> {
  const settings = await loadTelemetrySettings();

  const stateLabel = settings.enabled ? output.bold('enabled') : output.dim('disabled');
  console.log(`\nTelemetry: ${stateLabel}\n`);

  if (settings.enabled) {
    console.log(`  Endpoint : ${output.path(settings.endpoint || '(none)')}`);
    const hasAuth = 'Authorization' in settings.headers;
    console.log(`  Auth     : ${hasAuth ? output.dim('(set)') : output.dim('(none)')}`);
    const dataset = settings.headers['Dash0-Dataset'];
    if (dataset) console.log(`  Dataset  : ${output.dim(dataset)}`);
    console.log(`  Service  : ${output.dim(settings.serviceName)}`);
    if (settings.environment) {
      console.log(`  Env      : ${output.dim(settings.environment)}`);
    }
  }

  console.log('');
  console.log(
    settings.enabled
      ? `  To opt out: ${output.bold('gw telemetry off')}`
      : `  To opt in:  ${output.bold('gw telemetry on')}`
  );
  console.log('');
}

export async function executeTelemetry(args: string[]): Promise<void> {
  const parsed = parseTelemetryArgs(args);

  if (parsed.help || !parsed.subcommand) {
    showTelemetryHelp();
    Deno.exit(parsed.subcommand ? 1 : 0);
  }

  switch (parsed.subcommand) {
    case 'status':
      await showStatus();
      break;
    case 'on':
      await setEnabled(true);
      break;
    case 'off':
      await setEnabled(false);
      break;
    default:
      output.error(`Unknown telemetry subcommand '${parsed.subcommand}'`);
      showTelemetryHelp();
      Deno.exit(1);
  }
}
