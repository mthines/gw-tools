---
title: 'Verification Strategy'
impact: HIGH
tags:
  - verification
  - typecheck
  - lint
  - testing
  - parallel-agents
---

# Verification Strategy

## Overview

Four-tier verification strategy designed for autonomous agents that may run in parallel worktrees. Uses project-specific commands cached in `.gw/autonomous-workflow.json` to avoid hardcoding tool-specific commands.

Research shows that strong autonomous agents validate ~35% of their steps, and that verification should target decision points rather than being uniform across all edits. Models lose 60-80% of debugging effectiveness after 2-3 fix attempts on the same issue.

## The Four Tiers

| Tier | When | What | Cost | Catches |
|------|------|------|------|---------|
| **edit** | After each file edit | Lint changed file | ~1-3s, negligible memory | Unused imports, formatting, naming violations |
| **subtask** | After completing a logical unit (function, component, endpoint) | Targeted tests for the changed area | ~5-15s | Broken behavior, regressions in the area |
| **milestone** | Every 2-3 files or at a milestone | Type-check (incremental if available) | ~5-30s with cache | Cross-file type errors, broken imports |
| **pre-pr** | Before creating PR (Phase 6) | Full verification suite | ~1-5 min | Everything — this is the safety net |

## Config Schema

Verification commands are stored in `.gw/autonomous-workflow.json`, keyed by directory path:

```jsonc
{
  "verify": {
    ".": {
      "edit": "eslint {files}",
      "pre-pr": "npm run verify"
    },
    "components/ui": {
      "edit": "eslint --no-error-on-unmatched-pattern {files}",
      "subtask": "vitest run {testFiles}",
      "milestone": "tsc --noEmit --incremental",
      "pre-pr": "npm run verify"
    },
    "components/api": {
      "edit": "golangci-lint run {files}",
      "subtask": "go test ./...",
      "pre-pr": "make verify"
    }
  }
}
```

### Structure

The `verify` object is keyed by **directory path** (relative to worktree root). Each key is both the scope and the `cwd` for running commands. Tier values are plain command strings.

### Directory Matching

The agent matches each changed file to the **longest matching key prefix**, with `"."` as the default fallback:

- `components/ui/src/foo.tsx` → matches `components/ui` (specific)
- `components/api/handler.go` → matches `components/api` (specific)
- `scripts/deploy.ts` → no specific match → falls back to `"."` (default)

If no key matches and no `"."` default exists, skip that tier for the file.

### Placeholder Expansion

- `{files}` — space-separated list of changed file paths (relative to the matched directory), determined by `git diff`
- `{testFiles}` — test files related to changed files, inferred by pattern (e.g., `foo.ts` → `foo.test.ts`, `foo.spec.ts`). If no matching test file is found, skip the `subtask` tier for that file.

### Tiers Are Optional

Any tier can be omitted per directory. If a tier is missing from the matched config, the agent skips that verification level. At minimum, `pre-pr` should be defined.

## Auto-Detection

At the start of Phase 3, the agent reads `.gw/autonomous-workflow.json`. If no `verify` section exists, the agent auto-detects by inspecting the project:

1. **Scan for project directories** — find directories containing `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, etc.
2. **Per directory, detect available tools**:
   - `package.json` with `scripts.lint` / `scripts.test` / `scripts.verify` → set appropriate tiers
   - `tsconfig.json` with `incremental: true` → set `milestone` to `tsc --noEmit --incremental`
   - `eslint.config.*` or `.eslintrc*` → set `edit` to `eslint {files}`
   - `go.mod` → set `edit` to `golangci-lint run {files}`, `subtask` to `go test ./...`
3. **Create directory keys** for each detected project, plus `"."` as fallback if the root has scripts
4. **Write** the `verify` section to `.gw/autonomous-workflow.json` and log what was detected

The user can then hand-edit to override.

**If detection fails** for a directory (no recognizable project structure), skip it. Only set tiers where commands are confidently detected. The agent can always ask the user to configure `.gw/autonomous-workflow.json` manually.

## Usage in Phases

### Phase 3: Implementation

```
After each file edit:
  → Run verify.edit on the changed file(s)

After completing a logical subtask:
  → Run verify.subtask with related test files

Every 2-3 files or at a milestone:
  → Run verify.milestone
```

### Phase 6: Pre-PR

```
Before creating draft PR:
  → Run verify.pre-pr (full verification)
```

## Failure Handling

When a verification tier fails:

1. **Attempt to fix** the issue (max 2-3 attempts per issue)
2. If still failing after 3 attempts, **step back and reconsider the approach** — don't grind
3. If the edit tier fails on lint, fix immediately before proceeding
4. If the milestone tier fails on types, investigate whether the approach is fundamentally wrong
5. If pre-pr fails, do NOT create the PR — fix first

Research shows diminishing debugging returns after 2-3 attempts. If stuck, regenerate the approach rather than continuing to patch.

## Why Not Full Build/Lint Every Time?

Running `npm run build` + `npm run lint` (with type-aware rules) on every validation cycle consumes 2-4GB RAM per instance. When multiple autonomous-workflow agents run in parallel worktrees, this exhausts system memory. The tiered approach keeps each agent lightweight (~50-200MB for edit/subtask tiers) while CI runs the full authoritative check before merge.

## Examples

### Mixed monorepo (TypeScript + Go)

```jsonc
{
  "verify": {
    ".": {
      "pre-pr": "npm run verify"
    },
    "components/ui": {
      "edit": "eslint --no-error-on-unmatched-pattern {files}",
      "subtask": "vitest run {testFiles}",
      "milestone": "tsc --noEmit --incremental",
      "pre-pr": "npm run verify"
    },
    "components/api": {
      "edit": "golangci-lint run {files}",
      "subtask": "go test ./...",
      "milestone": "go build ./...",
      "pre-pr": "make verify"
    }
  }
}
```

### Simple Node.js project

```jsonc
{
  "verify": {
    ".": {
      "edit": "eslint {files}",
      "subtask": "npm test -- --changed",
      "pre-pr": "npm run lint && npm test"
    }
  }
}
```

### Go project

```jsonc
{
  "verify": {
    ".": {
      "edit": "golangci-lint run {files}",
      "subtask": "go test ./...",
      "milestone": "go build ./...",
      "pre-pr": "make verify"
    }
  }
}
```

## References

- [Anthropic: Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) — "typecheck after a series of changes", "prefer single tests"
- [Anthropic: Effective Harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — continuous self-verification
- [Nature: Debugging Decay Index](https://www.nature.com/articles/s41598-025-27846-5) — 60-80% capability loss by 3rd attempt
- [TDAD: Test-Driven Agentic Development](https://arxiv.org/abs/2603.17973v2) — targeted tests reduce regressions 70%
- [Factory.ai: Linters as Agent Law](https://factory.ai/news/using-linters-to-direct-agents) — lint on the hot path
- Related rule: [phase-3-implementation](./phase-3-implementation.md)
- Related rule: [phase-6-pr-creation](./phase-6-pr-creation.md)
