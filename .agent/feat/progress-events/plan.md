---
branch: feat/progress-events
created: 2026-05-01T00:00:00Z
agent: aw-planner
confidence: pending
---

# Plan: Structured Progress Events for gw CLI + VS Code Extension Wiring

## Summary

Add `--progress=json` to the `gw` CLI so it emits NDJSON progress events to
stderr during `gw checkout`. Wire the VS Code extension to parse those events
and update `progress.report({ message })` inside existing `withProgress` call
sites, giving users per-stage visibility (including "Running post-checkout
hook 2/3 — pnpm install") instead of a static spinner for 60+ seconds.

## Background / Context

When `gw checkout` runs inside the VS Code extension (`packages/vscode-gw/`),
the progress notification shows a static title (e.g., "Creating worktree:
feat/foo") for the entire duration. When post-checkout hooks like `pnpm
install` run, this can take 30–120 seconds with zero feedback. Users cannot
distinguish whether the operation is hung, running a hook, creating the
worktree, or copying files.

**Agreed approach (Approach B):** add a structured progress channel to the gw
CLI (`packages/gw-tool/`). When `--progress=json` is set, gw writes NDJSON
events to stderr. The VS Code extension switches `createWorktree` and
`createWorktreeFromStaged` from `cp.exec` to `cp.spawn`, parses stderr
line-by-line, and calls `progress.report({ message })` per stage.

Stdout remains untouched (clean for piping). The flag is off by default and
intended for tooling (VS Code, CI), not humans.

## Requirements

- [user-stated] `gw checkout` must emit per-stage progress events when
  `--progress=json` is set, including per-hook events with index/total.
- [user-stated] Events must go to stderr; stdout must be byte-for-byte
  identical to current behavior when flag is absent.
- [user-stated] VS Code extension must parse events and update the progress
  notification subtitle per stage (at minimum "Running post-checkout hook
  N/M — command" when hooks run).
- [user-stated] Hook progress messages must include "Running post-checkout
  hook 2/3" semantics so slow hooks are distinguishable.
- [user-stated] Design the API generally (reusable for `gw pr`, `gw update`,
  `gw sync`), but only implement `checkout` stages now.
- [user-stated] UX and DX reviews must be invoked and findings baked into
  the plan (both were completed; see UX/DX sections below).
- [inferred] Schema must be versioned (`"version":1`) so future changes don't
  break the extension without a flag update.
- [inferred] Error events must be emitted before `Deno.exit(nonZero)` when
  progress mode is active, so the extension can distinguish crash from hang.
- [inferred] Backward compatibility: existing callers of `executeHooks` and
  `createWorktree` must not require changes.
- [inferred] All Deno type checks, lint, and tests must continue to pass.

## Decisions

| Decision                     | Choice                                              | Rationale                                                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flag name                    | `--progress=json` (value-flag)                      | clig.dev / 12 Factor CLI norm; extensible to `--progress=text`; matches `gh`, `kubectl`, `aws` convention. `--emit-progress` is verb-form and can't extend; `--machine-readable` is vague. DX review confirmed. |
| Flag scope                   | Global (parsed in `main.ts` before routing)         | Extension calls multiple commands; global means every future command gets it without per-command changes.                                                                                                       |
| Channel                      | stderr                                              | stdout stays clean for piping; progress events are log output, not data output. Correct per clig.dev / 12 Factor CLI #3.                                                                                        |
| Format                       | NDJSON (one JSON object per line)                   | Line-buffered; works with `tail -f`; trivially parseable in Node.js readline.                                                                                                                                   |
| Schema versioning            | `"version":1` field on every event                  | Future-proof; consumers filter `jq 'select(.version == 1)'`. Use `"version"` not `"v"` — more self-documenting.                                                                                                 |
| `durationMs` on start events | Omit entirely (not `null`)                          | jq consumers need no null guards; sparse JSON is idiomatic in NDJSON. DX review: critical finding.                                                                                                              |
| Commands instrumented        | `checkout` only in this PR                          | `gw pr`, `gw update`, `gw sync` deferred; same contract applies, future PRs.                                                                                                                                    |
| Extension commands wired     | `createWorktree` and `createWorktreeFromStaged`     | These are the slow operations the user observed.                                                                                                                                                                |
| "done" stage event           | Do NOT emit                                         | Progress stage vs. success notification are distinct VS Code API concepts. After `withProgress` resolves: `showInformationMessage("Worktree ready")`. UX review: critical finding.                              |
| `setup-tracking` stage       | Skip — do not emit                                  | Too fast (<100ms), too git-internal. No user value. UX review: medium finding.                                                                                                                                  |
| Hook failure: pre-checkout   | `showErrorMessage` (fatal)                          | Worktree NOT created; fatal error.                                                                                                                                                                              |
| Hook failure: post-checkout  | `showWarningMessage` + buttons                      | Worktree WAS created; non-fatal. Buttons: "Show Output", "Open Worktree". UX review: critical finding.                                                                                                          |
| Error event before exit      | Emit `status:"error"` before `Deno.exit(nonZero)`   | Extension can't distinguish hang vs crash otherwise. DX review: critical finding.                                                                                                                               |
| New module                   | `packages/gw-tool/src/lib/progress.ts`              | Keeps `output.ts` focused on human-readable colored output; no ANSI codes in NDJSON emitter.                                                                                                                    |
| Extension API                | Add `createWorktreeWithProgress` alongside existing | Existing `createWorktree` (exec-based) unchanged; new function (spawn-based) adds `onProgress` callback.                                                                                                        |
| `executeHooks` signature     | Add optional `progressStage?` param                 | Optional = backward-compatible; all existing callers implicitly pass `undefined`.                                                                                                                               |
| `writeSync` vs async write   | `Deno.stderr.writeSync`                             | Avoids async interleaving with hook output; atomic for payloads <512 bytes (our events are <256 bytes).                                                                                                         |

## Technical Approach

### Event Schema

```typescript
interface ProgressEvent {
  version: 1;
  stage: ProgressStage;
  status: 'start' | 'end' | 'error';
  hook?: number; // 1-based index (hook stages only)
  of?: number; // total hook count (hook stages only)
  command?: string; // expanded hook command (hook stages only)
  durationMs?: number; // elapsed ms (only on "end" events — omit on "start")
  message?: string; // human-readable detail (only on "error" events)
  exitCode?: number; // process exit code (only on "error" events)
}

type ProgressStage =
  | 'pre-checkout-hooks'
  | 'create-worktree'
  | 'copy-files'
  | 'copy-staged-files'
  | 'post-checkout-hooks';
```

### Event Examples

```jsonc
// Stage boundary (no hook):
{"version":1,"stage":"create-worktree","status":"start"}
{"version":1,"stage":"create-worktree","status":"end","durationMs":1842}

// Per-hook event:
{"version":1,"stage":"post-checkout-hooks","status":"start","hook":1,"of":1,"command":"pnpm install"}
{"version":1,"stage":"post-checkout-hooks","status":"end","hook":1,"of":1,"durationMs":47210}

// Error (non-zero exit from git):
{"version":1,"stage":"create-worktree","status":"error","message":"git worktree add failed with exit code 128","exitCode":128}

// Hook failure:
{"version":1,"stage":"post-checkout-hooks","status":"error","hook":1,"of":1,"message":"Hook failed with exit code 1","exitCode":1}
```

### `progress.ts` Singleton

```typescript
// packages/gw-tool/src/lib/progress.ts
let progressMode: 'json' | undefined;

export function initProgress(mode: string | undefined): void {
  progressMode = mode === 'json' ? 'json' : undefined;
}

export function isProgressEnabled(): boolean {
  return progressMode === 'json';
}

export function emitProgress(event: Omit<ProgressEvent, 'version'>): void {
  if (!isProgressEnabled()) return;
  const payload: ProgressEvent = { version: 1, ...event };
  Deno.stderr.writeSync(new TextEncoder().encode(JSON.stringify(payload) + '\n'));
}
```

### Global Flag Parsing in `main.ts`

Parse `--progress=json` before routing to the command handler. Strip it from
the args array passed to the handler (so `parseCheckoutArgs` never sees it and
doesn't need to be updated to ignore it). Call `initProgress(progressMode)`
once before dispatch.

```typescript
// In parseGlobalArgs() return type: add progressMode?: string
// In main.ts: const { command, args, progressMode } = parseGlobalArgs(Deno.args);
//             initProgress(progressMode);
//             await handler(argsWithoutProgress); // filter --progress=json out
```

The filtering is important: without it, `parseCheckoutArgs` would encounter
`--progress=json` in the arg list, which it doesn't know about, and could
misparse it as a file argument. Strip it in `main.ts` or `parseGlobalArgs`.

### `executeHooks` Modification

```typescript
export async function executeHooks(
  hooks: string[],
  cwd: string,
  variables: HookVariables,
  hookType: string,
  abortOnFailure: boolean = true,
  progressStage?: 'pre-checkout-hooks' | 'post-checkout-hooks'
): Promise<{ results: HookResult[]; allSuccessful: boolean }>;
```

When `progressStage` is provided, emit per-hook start/end/error events inside
the loop. The `hookType` param for console.log is unchanged.

### VS Code: `createWorktreeWithProgress`

```typescript
export function createWorktreeWithProgress(
  cwd: string,
  branchName: string,
  onProgress: (message: string) => void
): Promise<string>;
```

Spawns `gw checkout ${branchName} --progress=json` via `cp.spawn`. Reads
stderr line-by-line; if line starts with `{`, attempts `JSON.parse`; on
success, maps to label string and calls `onProgress(label)`. Non-JSON stderr
lines go to the existing logger. Rejects on non-zero exit code.

### VS Code: Stage Label Mapping

| Event condition                       | `progress.report({ message })` string                                        |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `pre-checkout-hooks` start, no hook   | `"Running pre-checkout hooks..."`                                            |
| `pre-checkout-hooks` start, hook N/M  | `"Running pre-checkout hook N/M — {cmd}"` (cmd truncated at 40 chars + `…`)  |
| `create-worktree` start               | `"Creating worktree"`                                                        |
| `copy-files` start                    | `"Copying config files"`                                                     |
| `copy-staged-files` start             | `"Moving staged files to new worktree"`                                      |
| `post-checkout-hooks` start, no hook  | `"Running post-checkout hooks..."`                                           |
| `post-checkout-hooks` start, hook N/M | `"Running post-checkout hook N/M — {cmd}"` (cmd truncated at 40 chars + `…`) |
| any `end` event                       | (no update; spinner continues to next stage)                                 |

`withProgress` title stays: `"Creating worktree: {branchName}"` (spatial anchor per UX review).

### Extension Call Sites Changed

| Line | Current                                                     | After                                                                                                   |
| ---- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 329  | `await createWorktree(workspacePath, branchName)`           | `await createWorktreeWithProgress(workspacePath, branchName, msg => progress.report({ message: msg }))` |
| 681  | `await createWorktree(workspacePath, branchName)`           | same as above                                                                                           |
| 726  | `await createWorktreeFromStaged(workspacePath, branchName)` | `await createWorktreeFromStagedWithProgress(...)`                                                       |

Lines 282 (checkoutPr), 812/893 (updateWorktree), 797/963 (syncWorktree)
remain unchanged in this PR.

### Help Text Additions

`gw --help` (in `showGlobalHelp()`):

```
Tooling:
  --progress=json    Emit NDJSON progress events to stderr.
                     Intended for tooling integrations (VS Code, CI).
                     Schema: {"version":1,"stage":...,"status":"start"|"end"|"error"}
                     Example: gw checkout feat/foo --progress=json 2>&1 1>/dev/null | jq .
```

`gw checkout --help` (in `showCheckoutHelp()`):

```
Tooling:
  --progress=json    Stream structured progress to stderr (see gw --help)
```

## Acceptance Criteria

1. `gw checkout feat/foo --progress=json` writes one JSON object per line to stderr for each stage: `create-worktree` start/end at minimum.
2. When hooks are configured, per-hook events include `hook` (1-based index), `of` (total count), and `command` (expanded command string).
3. `durationMs` is present on `end` events and absent on `start` events (sparse, not `null`).
4. `version: 1` is present on every event.
5. When git fails (e.g., `git worktree add` exits non-zero), a `status:"error"` event is emitted to stderr before process exit.
6. Without `--progress=json`, CLI output is byte-for-byte identical to current behavior (no regressions on stdout or human-readable stderr).
7. In VS Code, during `createWorktree`, the notification subtitle updates per stage; at minimum "Creating worktree" when git runs and "Running post-checkout hook N/M — command" when hooks run.
8. Post-checkout hook failure shows `showWarningMessage` with "Show Output" and "Open Worktree" buttons (worktree WAS created).
9. Pre-checkout hook failure shows `showErrorMessage` stating worktree creation was cancelled (worktree NOT created).
10. `gw --help` contains a "Tooling" section with `--progress=json` documented and a jq example.
11. `gw checkout --help` contains a "Tooling" section referencing `--progress=json`.
12. `nx run gw-tool:check` (deno type check) passes with no new errors.
13. `nx run gw-tool:test` passes (all existing + new tests green).
14. `nx run vscode-gw:test` passes (all existing + new tests green).
15. `nx run gw-tool:lint` and `nx run vscode-gw:lint` both pass.

## Implementation Order

1. Create `packages/gw-tool/src/lib/progress.ts` — singleton emitter, `ProgressEvent` type, `initProgress`, `isProgressEnabled`, `emitProgress`.
2. Update `packages/gw-tool/src/lib/types.ts` — add `progressMode?: string` to `GlobalArgs`.
3. Update `packages/gw-tool/src/lib/cli.ts` — parse `--progress=json` from args in `parseGlobalArgs`; add Tooling section to `showGlobalHelp`.
4. Update `packages/gw-tool/src/main.ts` — extract `progressMode` from parsed global args; strip `--progress=json` from args passed to handlers; call `initProgress(progressMode)` before dispatch.
5. Update `packages/gw-tool/src/lib/hooks.ts` — add optional `progressStage?` param to `executeHooks`; emit per-hook start/end/error events when enabled.
6. Update `packages/gw-tool/src/commands/checkout.ts` — emit `create-worktree`, `copy-files`, `copy-staged-files` stage events around existing logic; pass `progressStage` to `executeHooks` calls; add Tooling section to `showCheckoutHelp`; emit error events before `Deno.exit(nonZero)` calls in the create-worktree path.
7. Create `packages/gw-tool/src/lib/progress.test.ts` — unit tests for emitter.
8. Update `packages/gw-tool/src/commands/checkout.test.ts` — add `--progress=json` coverage.
9. Update `packages/vscode-gw/src/parsers/git-worktree.ts` — add `createWorktreeWithProgress` and `createWorktreeFromStagedWithProgress` (spawn-based, with `onProgress` callback and `parseProgressEvent` pure helper).
10. Update `packages/vscode-gw/src/extension.ts` — switch lines 329, 681, 726 to new progress-aware variants; add pre vs. post hook failure notification wording.
11. Update `packages/gw-tool/README.md` — add "Machine-Readable Progress" section.

## File Changes

| Action | File                                             | Notes                                                        |
| ------ | ------------------------------------------------ | ------------------------------------------------------------ |
| create | `packages/gw-tool/src/lib/progress.ts`           | New NDJSON emitter singleton                                 |
| create | `packages/gw-tool/src/lib/progress.test.ts`      | Unit tests for emitter                                       |
| modify | `packages/gw-tool/src/lib/types.ts`              | Add `progressMode?: string` to `GlobalArgs`                  |
| modify | `packages/gw-tool/src/lib/cli.ts`                | Parse `--progress=json`; Tooling section in global help      |
| modify | `packages/gw-tool/src/main.ts`                   | Extract and strip `--progress=json`; call `initProgress`     |
| modify | `packages/gw-tool/src/lib/hooks.ts`              | Optional `progressStage?` param; per-hook events             |
| modify | `packages/gw-tool/src/commands/checkout.ts`      | Stage events; Tooling section in checkout help; error events |
| modify | `packages/gw-tool/src/commands/checkout.test.ts` | Add `--progress=json` test cases                             |
| modify | `packages/vscode-gw/src/parsers/git-worktree.ts` | Add spawn-based progress variants                            |
| modify | `packages/vscode-gw/src/extension.ts`            | Switch call sites; failure notification wording              |
| modify | `packages/gw-tool/README.md`                     | Machine-Readable Progress section                            |

## Tests

### New test file: `packages/gw-tool/src/lib/progress.test.ts`

- `initProgress("json")` enables progress mode
- `initProgress(undefined)` disables progress mode
- `emitProgress(...)` writes valid JSON + newline to stderr when enabled
- `emitProgress(...)` is a no-op when disabled
- Events always have `version: 1`
- `durationMs` absent on start events, present on end events

### Additions to `packages/gw-tool/src/commands/checkout.test.ts`

- `--progress=json` flag causes events on stderr (capture stderr in test)
- `create-worktree` start/end events are emitted
- Hook events include `hook`, `of`, `command` fields
- Error event emitted before exit on git failure
- Without `--progress=json`, no JSON appears on stderr

### New or updated: `packages/vscode-gw/src/parsers/git-worktree.test.ts`

- `parseProgressEvent("{...}")` returns typed event for valid JSON
- `parseProgressEvent("not json")` returns `undefined`
- Label mapping: `post-checkout-hooks` hook event with N/M produces correct string
- Long command truncated at 40 chars with `…`

Testing pattern follows existing `checkout.test.ts` using `withMockedExit` and
`TempCwd`; VS Code parser tests use vitest (no VS Code API needed).

## Risks

| Risk                                                                                  | Likelihood | Impact | Mitigation                                                                                                |
| ------------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `Deno.stderr.writeSync` interleaves with hook output                                  | Low        | Medium | writeSync is atomic for payloads <512 bytes; our events are <256 bytes                                    |
| Extension stderr parsing breaks on multiline hook output (e.g., pnpm progress bars)   | Medium     | High   | Only attempt `JSON.parse` on lines that start with `{`; all other lines go to logger                      |
| `--progress=json` not stripped before `parseCheckoutArgs` — misidentified as file arg | Medium     | High   | Strip in `main.ts` or `parseGlobalArgs` before passing `args` to handler (explicit step in impl order #4) |
| Hook command string with special chars breaks JSON                                    | Low        | Medium | `JSON.stringify` handles escaping; command is a JS string value                                           |
| Progress events break existing test output                                            | Low        | Low    | `isProgressEnabled()` returns false unless `initProgress` is called; test env never calls it              |

## Verification

After each file edit, run fast check:

```
nx run gw-tool:check
```

After implementing gw-tool changes (steps 1–8):

```
nx run gw-tool:test
nx run gw-tool:lint
```

After implementing vscode-gw changes (steps 9–10):

```
nx run vscode-gw:test
nx run vscode-gw:lint
```

Full pre-PR suite:

```
nx run-many -t check lint test --projects=gw-tool,vscode-gw
```

Manual smoke test with progress flag:

```
gw checkout feat/smoke-test --progress=json 2>&1 1>/dev/null | jq .
```

## Progress Log

- [2026-05-01T00:00:00Z] Phase 0 completed: scope, flag name, schema, and extension wiring decided
- [2026-05-01T00:00:00Z] UX review completed: label strings, failure wording, "done" stage anti-pattern identified
- [2026-05-01T00:00:00Z] DX review completed: flag naming (value-flag), global scope, error event semantics, `durationMs: null` anti-pattern identified
- [2026-05-01T00:00:00Z] Worktree created at `/Users/mthines/Workspace/gw-tools.git/feat/progress-events`
- [2026-05-01T00:00:00Z] plan.md written with canonical sections; confidence gate pending

## UX / DX Review Findings (Verbatim Capture)

### UX Review Summary

Reviewed by `ux` companion against proposed stage labels and notification design.

**Critical:**

- "Done" must NOT be a progress stage. Use `showInformationMessage("Worktree \"${branchName}\" ready")` after `withProgress` resolves.
- Hook failure requires two distinct notification types: pre-checkout → `showErrorMessage` (fatal); post-checkout → `showWarningMessage` with "Show Output" / "Open Worktree" buttons (non-fatal).

**High:**

- Stage labels must use verb-first present-progressive consistently. All proposed labels follow this pattern.
- "hook N/M — command" pattern correct; truncate command at ~40 chars so hook index is always visible.

**Medium:**

- Suppress "Setting up tracking" stage (too fast, too jargon-y).
- "Copying staged files" → "Moving staged files to new worktree".
- "Copying files" → "Copying config files".

**Low:**

- Future: `cancellable: true`; `progress.report({ increment: N })` for determinate progress.

### DX Review Summary

Reviewed by `dx` companion against flag naming candidates and composability design.

**Critical:**

- `durationMs: null` on start events violates composability (jq needs null guards). Omit the field on start events.

**High:**

- Use `--progress=json` (value-flag, Option A): verb-form and vague alternatives rejected.
- Make it a global flag in `main.ts`; all commands benefit.
- Emit `status:"error"` event before any `Deno.exit(nonZero)` when progress is active; without this, a crash is indistinguishable from a hang.

**Medium:**

- Use `"version":1` not `"v":1` — self-documenting, matches VS Code task schemas.
- Put `--progress=json` in a "Tooling" section in help, not mixed into Options.
- Add jq stderr redirect example to help text.

**Low:**

- Future: `NO_PROGRESS=1` env var escape hatch.
- Future: `--progress=text` human-readable alias.
- Future: shell completions enumerate `--progress` values.
