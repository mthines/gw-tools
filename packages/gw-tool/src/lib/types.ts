/**
 * Type definitions for the gw CLI tool
 */

/**
 * Hook configuration for a command
 */
export interface CommandHooks {
  /** Commands to run before the main command executes */
  pre?: string[];
  /** Commands to run after the main command completes successfully */
  post?: string[];
}

/**
 * Hooks configuration for various gw commands
 */
export interface HooksConfig {
  /** Hooks for the checkout command */
  checkout?: CommandHooks;
}

/**
 * Opt-in OpenTelemetry / Dash0 telemetry configuration.
 *
 * Telemetry is only emitted when `enabled` is true. All signals are sent via
 * OTLP/HTTP (JSON) and fail open — an export error can never slow down or
 * break a gw command.
 *
 * Keep secrets OUT of the committed config. An OTLP auth header (e.g. a Dash0
 * token) belongs in the gitignored `.gw/config.local.json`, or in the
 * `OTEL_EXPORTER_OTLP_HEADERS` env var. The recommended setup points
 * `endpoint` at a local OpenTelemetry Collector that holds the Dash0 token,
 * so no secret ever lives in the repo or the compiled binary.
 */
export interface TelemetryConfig {
  /** Master switch. When false or omitted, gw emits no telemetry. */
  enabled?: boolean;
  /**
   * OTLP/HTTP base endpoint. Defaults to a local OpenTelemetry Collector at
   * http://localhost:4318. gw POSTs to `${endpoint}/v1/traces` and
   * `${endpoint}/v1/logs`.
   */
  endpoint?: string;
  /** deployment.environment.name resource attribute (e.g. "production"). */
  environment?: string;
  /** service.name resource attribute (default: "gw"). */
  serviceName?: string;
  /**
   * Extra OTLP/HTTP headers (e.g. Authorization). Do NOT put secrets here in a
   * committed config — use .gw/config.local.json or OTEL_EXPORTER_OTLP_HEADERS.
   */
  headers?: Record<string, string>;
  /** Export flush timeout in milliseconds (default: 1500). */
  timeoutMs?: number;
}

/**
 * Per-repository configuration stored at .gw/config.json
 *
 * This file is safe to commit to your repository. Machine-specific
 * state (such as auto-cleanup timestamps) is managed internally and
 * never written to this file.
 */
export interface Config {
  /** JSON Schema reference for IDE autocompletion */
  $schema?: string;
  /** Config schema version for migrations (managed automatically) */
  configVersion?: number;
  /** Default source worktree name (e.g., "main", "master") */
  defaultBranch?: string;
  /** Files to automatically copy when creating new worktrees */
  autoCopyFiles?: string[];
  /** Command hooks configuration */
  hooks?: HooksConfig;
  /** Minimum age in days for worktrees to be cleaned (optional, default: 7) */
  cleanThreshold?: number;
  /** Enable automatic cleanup of stale worktrees (optional, default: false) */
  autoClean?: boolean;
  /** Default update strategy for the update command (optional, default: "merge") */
  updateStrategy?: 'merge' | 'rebase';
  /** Opt-in OpenTelemetry / Dash0 telemetry configuration (optional, disabled by default) */
  telemetry?: TelemetryConfig;
}

/**
 * Options for the copy command
 */
export interface CopyOptions {
  /** Source worktree name */
  from?: string;
  /** Target worktree name */
  target?: string;
  /** List of file/directory paths to copy */
  files: string[];
  /** Show help */
  help?: boolean;
  /** Dry run mode - show what would be copied without actually copying */
  dryRun?: boolean;
}

/**
 * Result of a single copy operation
 */
export interface CopyResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** The path that was attempted to be copied */
  path: string;
}

/**
 * Global CLI arguments after initial parsing
 */
export interface GlobalArgs {
  /** Command name (e.g., "copy", "init", "list") */
  command?: string;
  /** Remaining arguments after command extraction */
  args: string[];
  /** Whether help was requested */
  help: boolean;
  /** Whether version was requested */
  version: boolean;
  /**
   * Progress output mode, parsed from --progress=<value>.
   * Currently only "json" is supported (emits NDJSON to stderr).
   * Undefined when the flag is absent.
   */
  progressMode?: string;
}

/**
 * Options for the update command
 */
export interface UpdateOptions {
  /** Show help */
  help: boolean;
  /** Skip uncommitted changes check (dangerous) */
  force: boolean;
  /** Dry run mode - show what would happen without executing */
  dryRun: boolean;
  /** Branch to update from (overrides defaultBranch) */
  branch?: string;
  /** Remote name (default: "origin") */
  remote: string;
  /** Force merge strategy (overrides config) */
  merge?: boolean;
  /** Force rebase strategy (overrides config) */
  rebase?: boolean;
  /** PR identifier — PR number or GitHub URL. Mutually exclusive with `branch`. */
  fromPr?: string;
}

/**
 * Result of a git merge operation
 */
export interface MergeResult {
  /** Whether the merge succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message?: string;
  /** Whether there are merge conflicts */
  conflicted?: boolean;
  /** Number of files changed */
  filesChanged?: number;
  /** List of changed files with their stats */
  fileStats?: string[];
}

/**
 * Result of a git rebase operation
 */
export interface RebaseResult {
  /** Whether the rebase succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message?: string;
  /** Whether there are rebase conflicts */
  conflicted?: boolean;
  /** Number of files changed */
  filesChanged?: number;
  /** List of changed files with their stats */
  fileStats?: string[];
}
