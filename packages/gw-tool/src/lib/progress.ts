/**
 * Structured progress event emitter for gw CLI
 *
 * When --progress=json is set, emits NDJSON events to stderr.
 * Stdout remains untouched (clean for piping).
 * Intended for tooling integrations (VS Code, CI), not human output.
 */

/**
 * Valid progress stage identifiers for the checkout command.
 * Designed to be reusable for gw pr, gw update, gw sync in future PRs.
 */
export type ProgressStage =
  | "pre-checkout-hooks"
  | "create-worktree"
  | "copy-files"
  | "copy-staged-files"
  | "post-checkout-hooks";

/**
 * Schema version 1 progress event.
 *
 * Rules:
 * - `version` is always 1
 * - `durationMs` is present ONLY on "end" events (omit on "start", not null)
 * - `hook`, `of`, `command` are present ONLY on hook-stage events
 * - `message`, `exitCode` are present ONLY on "error" events
 */
export interface ProgressEvent {
  version: 1;
  stage: ProgressStage;
  status: "start" | "end" | "error";
  /** 1-based hook index (hook stages only) */
  hook?: number;
  /** Total hook count (hook stages only) */
  of?: number;
  /** Expanded hook command string (hook stages only) */
  command?: string;
  /** Elapsed milliseconds (end events only — omit on start, not null) */
  durationMs?: number;
  /** Human-readable error detail (error events only) */
  message?: string;
  /** Process exit code (error events only) */
  exitCode?: number;
}

let progressMode: "json" | undefined;

/**
 * Initialize the progress emitter.
 * Call once in main.ts before dispatching to a command handler.
 *
 * @param mode Pass "json" to enable NDJSON emission; undefined/any other value disables it.
 */
export function initProgress(mode: string | undefined): void {
  progressMode = mode === "json" ? "json" : undefined;
}

/**
 * Returns true when --progress=json has been activated.
 */
export function isProgressEnabled(): boolean {
  return progressMode === "json";
}

/**
 * Emit a single progress event to stderr as a NDJSON line.
 * No-op when progress mode is not enabled.
 *
 * @param event Event payload (version field is added automatically)
 */
export function emitProgress(event: Omit<ProgressEvent, "version">): void {
  if (!isProgressEnabled()) return;
  const payload: ProgressEvent = { version: 1, ...event };
  Deno.stderr.writeSync(
    new TextEncoder().encode(JSON.stringify(payload) + "\n"),
  );
}
