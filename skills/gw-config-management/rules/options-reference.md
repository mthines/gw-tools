---
title: 'Configuration Options Reference'
impact: HIGH
tags:
  - config
  - options
  - reference
---

# Configuration Options Reference

## Overview

Complete reference for all `.gw/config.json` options.
Each option affects specific gw commands and behaviors.

The config file is committable — no machine-specific paths or runtime state is stored.
It supports JSONC (JSON with Comments) — comments (`//`, `/* */`) and trailing commas are allowed.

### Local Overrides

Create `.gw/config.local.json` to override any value for your machine only.
It is automatically gitignored and merged on top of `config.json` (shallow merge, local wins).

## IDE Autocompletion

The `$schema` property enables autocompletion and validation in VS Code, JetBrains IDEs, and other editors with JSON Schema support. It is automatically added when running `gw init`.

## Complete Structure

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/mthines/gw-tools/main/packages/gw-tool/schemas/gw-config.schema.json",

  "configVersion": 3,

  // Core Settings
  "defaultBranch": "main",
  "cleanThreshold": 7,

  // Auto-Copy Files
  "autoCopyFiles": [".env", ".env.local", "secrets/"],

  // Hooks
  "hooks": {
    "checkout": {
      "pre": ["echo 'Creating worktree: {worktree}'"],
      "post": ["cd {worktreePath} && pnpm install"],
    },
  },

  // Advanced Options
  "autoClean": false,
  "updateStrategy": "merge",

  // Telemetry (opt-in, disabled by default)
  "telemetry": {
    "enabled": false,
    "endpoint": "http://localhost:4318",
    "environment": "production",
  },
}
```

## `telemetry`

**Purpose**: Opt-in OpenTelemetry / Dash0 telemetry. Disabled unless `enabled` is `true`.

When enabled, gw emits one span + one log record per command via OTLP/HTTP, each
carrying the `service.version` resource attribute. Paired with the
`deployment.success` event the release pipeline sends, this lets Dash0 correlate
deployments with errors. Telemetry fails open — export errors never affect the command.

| Field         | Type    | Default                 | Notes                                                                                           |
| ------------- | ------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `enabled`     | boolean | `false`                 | Master switch. Env override: `GW_TELEMETRY=1`/`0`.                                              |
| `endpoint`    | string  | `http://localhost:4318` | OTLP/HTTP base. Env: `OTEL_EXPORTER_OTLP_ENDPOINT`.                                             |
| `environment` | string  | _(unset)_               | `deployment.environment.name`. Env: `OTEL_RESOURCE_ATTRIBUTES`.                                 |
| `serviceName` | string  | `gw`                    | `service.name`. Env: `OTEL_SERVICE_NAME`.                                                       |
| `headers`     | object  | _(none)_                | OTLP headers. Env: `OTEL_EXPORTER_OTLP_HEADERS`. **No secrets here** — use `config.local.json`. |
| `timeoutMs`   | integer | `1500`                  | Export flush timeout (ms).                                                                      |

**Recommended**: point `endpoint` at a local OpenTelemetry Collector that holds the
Dash0 token, so no secret lives in the committed config. `OTEL_SDK_DISABLED=true` is
a hard kill switch.

## `$schema`

**Purpose**: JSON Schema reference for IDE autocompletion and validation.

**Type**: String (URL)

**Managed by**: `gw init` (set automatically)

```json
{
  "$schema": "https://raw.githubusercontent.com/mthines/gw-tools/main/packages/gw-tool/schemas/gw-config.schema.json"
}
```

**Benefits**: Autocompletion for all fields, inline documentation on hover, validation of values and types.

## `configVersion`

**Purpose**: Schema version for automatic config migrations.

**Type**: Integer (managed automatically)

**Current version**: `2`

```json
{
  "configVersion": 2
}
```

**Important**: Do not edit manually. gw uses this to determine which migrations to apply when the config schema changes between versions.

## `root` (removed)

The `root` field was removed in config version 2 to make the config file committable.
gw now always auto-detects the repository root. If auto-detection fails, use `gw init --root <path>` to specify where the config should be created.

## `defaultBranch`

**Purpose**: Default source worktree for file copying and updates.

**Type**: String (branch name)

**Used by**: `gw checkout`, `gw sync`, `gw update`, `gw clean`

```json
{
  "defaultBranch": "main"
}
```

**Common values**: `main`, `master`, `develop`, `staging`

**Important**: This worktree is protected from auto-clean.

## `autoCopyFiles`

**Purpose**: Files/directories automatically copied when creating worktrees.

**Type**: Array of strings (relative paths)

**Used by**: `gw checkout`, `gw sync`

```json
{
  "autoCopyFiles": [".env", ".env.local", "secrets/", "config/local.json"]
}
```

**Pattern types**:
| Pattern | Copies |
|---------|--------|
| `".env"` | Single file |
| `"secrets/"` | Entire directory (recursive) |
| `"config/local.json"` | Specific nested file |

**Important**: Paths relative to repository root. Non-existent files skipped with warning.

## `hooks`

**Purpose**: Commands to run before/after gw operations.

**Type**: Object with nested `checkout` configuration.

**Used by**: `gw checkout`

```jsonc
{
  "hooks": {
    "checkout": {
      "pre": ["echo 'Creating worktree: {worktree}'"],
      "post": ["cd {worktreePath} && pnpm install", "cd {worktreePath} && pnpm build"],
    },
  },
}
```

### Hook Variables

Available for substitution in hook commands:

| Variable         | Description                        |
| ---------------- | ---------------------------------- |
| `{worktree}`     | The worktree name                  |
| `{worktreePath}` | Full absolute path to the worktree |
| `{gitRoot}`      | The git repository root path       |
| `{branch}`       | The branch name                    |

### Hook Behavior

- **Pre-hooks**: Run before the worktree is created. If any command fails, the checkout is **aborted**.
- **Post-hooks**: Run after the worktree is created. Failures produce **warnings** but don't roll back the worktree.

### Setting Hooks via CLI

```bash
gw init --pre-checkout "echo 'Starting...'" \
        --post-checkout "cd {worktreePath} && pnpm install" \
        --post-checkout "cd {worktreePath} && pnpm build"
```

## `updateStrategy`

**Purpose**: Default strategy for `gw update` command.

**Type**: `"merge"` or `"rebase"`

**Used by**: `gw update`

```json
{
  "updateStrategy": "rebase"
}
```

| Strategy | When to Use                                |
| -------- | ------------------------------------------ |
| `merge`  | Preserve complete history, shared branches |
| `rebase` | Linear history, personal feature branches  |

**Override per-command**: `gw update --merge` or `gw update --rebase`

## `cleanThreshold`

**Purpose**: Days before worktrees considered stale.

**Type**: Number (days, non-negative)

**Used by**: `gw clean`, auto-clean

```json
{
  "cleanThreshold": 7
}
```

**Common values**:
| Value | Use Case |
|-------|----------|
| `3` | Aggressive cleanup |
| `7` | Default |
| `14` | More lenient |
| `30` | Long-lived branches |

**Set during init**: `gw init --clean-threshold 14`

## `autoClean`

**Purpose**: Enable silent background cleanup of stale worktrees after commands.

**Type**: Boolean

**Used by**: `gw checkout`, `gw list`

```json
{
  "autoClean": true
}
```

**Behavior**:

- Runs silently in the background after `gw checkout` or `gw list` — never blocks the user
- Shows a brief non-blocking notification to stderr if worktrees were removed
- Uses `cleanThreshold` for age check
- Never removes `defaultBranch` worktree
- Only removes worktrees with no uncommitted changes and no unpushed commits

**Set during init**: `gw init --auto-clean`

## `lastAutoCleanTime` (removed)

The `lastAutoCleanTime` field was removed in config version 2 to make the config file committable. Auto-clean now runs based on safety checks (threshold, uncommitted changes, unpushed commits) without a cooldown timer.

## Decision Table: Which Options to Set

| Project Type | Essential Options                  |
| ------------ | ---------------------------------- |
| Solo project | `autoCopyFiles`                    |
| Team project | All options, commit to repo        |
| Monorepo     | `autoCopyFiles` with package paths |
| CI/CD        | `defaultBranch`                    |

## References

- Related rule: [auto-copy](./auto-copy.md)
- Related rule: [setup](./setup.md)
