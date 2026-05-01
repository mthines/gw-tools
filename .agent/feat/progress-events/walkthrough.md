---
branch: feat/progress-events
created: 2026-05-01T12:05:00Z
agent: aw-executor
phase: 6
---

# Walkthrough: Structured Progress Events for gw CLI + VS Code Extension

## What shipped

This PR adds `--progress=json` to `gw checkout`, enabling tooling integrations
(VS Code, CI) to receive structured NDJSON progress events on stderr while the
command runs. The VS Code extension (`vscode-gw`) is wired to parse these
events and update the progress notification subtitle per stage.

---

## New files

### `packages/gw-tool/src/lib/progress.ts`

Singleton NDJSON emitter. Three exports:

- `initProgress(mode)` — call once in `main.ts` before dispatch; `"json"` enables it, anything else disables.
- `isProgressEnabled()` — guard used by callers.
- `emitProgress(event)` — writes `JSON.stringify({version:1,...event})\n` to stderr via `Deno.stderr.writeSync`. No-op when disabled.

Key design choices baked in:
- `Deno.stderr.writeSync` is used (not async) to avoid interleaving with hook output. Payloads are well under 512 bytes (atomic on POSIX).
- `version: 1` on every event. Consumers can filter with `jq 'select(.version == 1)'`.
- `durationMs` is **absent** on start events (sparse, not `null`) — DX review finding.

### `packages/gw-tool/src/lib/progress.test.ts`

9 unit tests covering: enable/disable lifecycle, no-op when disabled, JSON+newline emission, `version:1` invariant, `durationMs` absent on start / present on end, error event fields, hook event fields, multiple-line NDJSON, all stage values accepted.

---

## Modified files (gw-tool)

### `src/lib/types.ts`

Added `progressMode?: string` to `GlobalArgs`. Holds the value after `--progress=` (e.g., `"json"`).

### `src/lib/cli.ts`

`parseGlobalArgs` now filters `--progress=<value>` out of the args array before parsing command/flags. The filtered value is returned as `progressMode`. This means `parseCheckoutArgs` never sees `--progress=json` and cannot misparse it as a file argument.

Also added a **Tooling** section to `showGlobalHelp` with schema summary and a jq redirect example.

### `src/main.ts`

Extracts `progressMode` from `parseGlobalArgs`, then calls `initProgress(progressMode)` before dispatching to the command handler. The `--progress=json` flag is already stripped from `args` at this point.

### `src/lib/hooks.ts`

`executeHooks` gains an optional 6th parameter: `progressStage?` (`"pre-checkout-hooks"` or `"post-checkout-hooks"`). When provided:

1. Pre-expand the hook command via `substituteVariables` so the `command` field in the progress event shows the resolved command (not the template).
2. Emit `{status:"start", hook:N, of:total, command}` before execution.
3. Emit `{status:"end", hook:N, of:total, durationMs}` on success.
4. Emit `{status:"error", hook:N, of:total, message, exitCode}` on failure.

All existing callers pass 5 arguments; the 6th defaults to `undefined` (backward-compatible).

### `src/commands/checkout.ts`

Stage events wired in execution order:

| Stage | Start | End | Error |
|---|---|---|---|
| `create-worktree` | Before `git worktree add` | After success | Before `Deno.exit(code)` on git failure |
| `copy-files` | Before `copyFiles()` | After success | (no exit here, existing warning path unchanged) |
| `copy-staged-files` | Before staged copy | After success | (errors exit via existing path, no additional event needed) |
| `pre-checkout-hooks` | Via `executeHooks(..., 'pre-checkout-hooks')` | | |
| `post-checkout-hooks` | Via `executeHooks(..., 'post-checkout-hooks')` | | |

Also added a **Tooling** section to `showCheckoutHelp` referencing `gw --help` for full schema.

---

## Modified files (vscode-gw)

### `src/parsers/git-worktree.ts`

New exports:

- `GwProgressEvent` — TypeScript type mirroring the CLI schema (version 1).
- `parseProgressEvent(line)` — parses a single stderr line. Returns typed event if line starts with `{` and parses as version-1 JSON; returns `undefined` otherwise. Non-JSON lines (hook output, ANSI text) fall through cleanly.
- `progressEventToLabel(event)` — maps a `start` event to a VS Code notification subtitle. Returns `undefined` for `end`/`error` events (handled separately). Label table:

  | Stage + hook | Label |
  |---|---|
  | `pre-checkout-hooks` (no hook) | `"Running pre-checkout hooks..."` |
  | `pre-checkout-hooks` hook N/M | `"Running pre-checkout hook N/M — {cmd}"` (cmd truncated at 40 chars + …) |
  | `create-worktree` | `"Creating worktree"` |
  | `copy-files` | `"Copying config files"` |
  | `copy-staged-files` | `"Moving staged files to new worktree"` |
  | `post-checkout-hooks` (no hook) | `"Running post-checkout hooks..."` |
  | `post-checkout-hooks` hook N/M | `"Running post-checkout hook N/M — {cmd}"` (cmd truncated at 40 chars + …) |

- `HookFailureError` — extends `Error`. Has `isPreCheckout: boolean` and `worktreePath: string | undefined`. Thrown by the spawn-based functions when a hook error progress event is detected before process exit.

- `createWorktreeWithProgress(cwd, branchName, onProgress)` — spawns `gw checkout <branch> --progress=json` via `cp.spawn`. Reads stderr line-by-line with `readline.Interface`. JSON lines → `parseProgressEvent` → label → `onProgress(label)`. Non-JSON lines → logger. Hook error events → tracked internally → thrown as `HookFailureError` on close. Non-zero exit without hook error → plain `Error`.

- `createWorktreeFromStagedWithProgress(cwd, branchName, onProgress)` — same pattern for `gw checkout <branch> --from-staged --progress=json`.

Both functions share a private `runCheckoutWithProgress` helper to avoid duplication.

### `src/extension.ts`

Three call sites switched to the progress-aware variants:

| Line (approx) | Before | After |
|---|---|---|
| ~329 | `await createWorktree(workspacePath, branchName)` | `await createWorktreeWithProgress(..., msg => progress.report({ message: msg }))` |
| ~685 | same | same |
| ~740 | `await createWorktreeFromStaged(workspacePath, branchName)` | `await createWorktreeFromStagedWithProgress(...)` |

All three catch blocks now handle `HookFailureError` via a new `handleHookFailure` helper:

- **Pre-checkout failure** → `vscode.window.showErrorMessage("Worktree creation cancelled: pre-checkout hook failed. …")`
- **Post-checkout failure** → `vscode.window.showWarningMessage("Worktree … created, but a post-checkout hook failed. …", "Show Output", "Open Worktree")`
  - "Open Worktree" opens the worktree path in a new window.
  - "Show Output" focuses the gw output channel.

Lines 282 (checkoutPr), 812/893 (updateWorktree), 797/963 (syncWorktree) are unchanged.

---

## Tests

| File | New tests | Total |
|---|---|---|
| `packages/gw-tool/src/lib/progress.test.ts` | 9 (new file) | 9 |
| `packages/gw-tool/src/commands/checkout.test.ts` | 5 | 333 (gw-tool total) |
| `packages/vscode-gw/src/parsers/git-worktree.test.ts` | 17 | 44 (vscode-gw total) |

All 377 tests pass. All lint/check targets pass (0 errors).

---

## Acceptance criteria status

| # | Criterion | Status |
|---|---|---|
| 1 | `gw checkout --progress=json` writes create-worktree start/end events to stderr | PASS — tested in checkout.test.ts |
| 2 | Per-hook events include `hook`, `of`, `command` | PASS — tested in checkout.test.ts + progress.test.ts |
| 3 | `durationMs` present on end, absent on start | PASS — tested in both test files |
| 4 | `version: 1` on every event | PASS — invariant enforced in emitProgress |
| 5 | `status:"error"` emitted before exit on git failure | PASS — checkout.ts emits before `Deno.exit(code)` |
| 6 | Without --progress=json, output byte-for-byte identical | PASS — `isProgressEnabled()` guards all emit calls |
| 7 | VS Code notification subtitle updates per stage | PASS — extension.ts wired to progress-aware variants |
| 8 | Post-checkout hook failure shows `showWarningMessage` + buttons | PASS — handleHookFailure in extension.ts |
| 9 | Pre-checkout hook failure shows `showErrorMessage` | PASS — handleHookFailure in extension.ts |
| 10 | `gw --help` has Tooling section with `--progress=json` + jq example | PASS — cli.ts showGlobalHelp |
| 11 | `gw checkout --help` has Tooling section | PASS — checkout.ts showCheckoutHelp |
| 12 | `nx run gw-tool:check` passes | PASS |
| 13 | `nx run gw-tool:test` passes | PASS (333 tests) |
| 14 | `nx run vscode-gw:test` passes | PASS (44 tests) |
| 15 | `nx run gw-tool:lint` and `nx run vscode-gw:lint` pass | PASS (0 errors) |

---

## Deviations from plan

**None material.** Two minor implementation choices:

1. The internal `runCheckoutWithProgress` helper was factored out to avoid duplicating the spawn/readline/error-detection logic between `createWorktreeWithProgress` and `createWorktreeFromStagedWithProgress`. This wasn't in the plan but is strictly additive.

2. `HookFailureError` was added to `git-worktree.ts` so the extension's catch blocks can distinguish hook failures from other errors. The plan described this intent but left the mechanism implicit. The class approach is cleaner than string-matching error messages.

---

## Progress log

- [2026-05-01T12:00:00Z] Phase 3 started — implementation order followed per plan
- [2026-05-01T12:01:00Z] progress.ts + types.ts + cli.ts + main.ts complete; type check passes
- [2026-05-01T12:02:00Z] hooks.ts + checkout.ts complete; type check passes
- [2026-05-01T12:03:00Z] progress.test.ts + checkout.test.ts additions; 333 gw-tool tests pass
- [2026-05-01T12:04:00Z] vscode-gw parsers + extension.ts complete; build passes
- [2026-05-01T12:05:00Z] git-worktree.test.ts additions; 44 vscode-gw tests pass
- [2026-05-01T12:05:30Z] README + CLAUDE.md docs updated
- [2026-05-01T12:05:45Z] Full suite passes: 333 + 44 = 377 tests, 0 errors
- [2026-05-01T12:06:00Z] Committed; walkthrough written; PR creation pending
