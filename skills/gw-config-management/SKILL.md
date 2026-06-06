---
name: gw-config-management
description: >
  Configure .gw/config.json for gw-tools repos — auto-copy files, hooks,
  cleanup thresholds, update strategy, and the config migration system.
  Use when: setting up gw for a new project, adding or changing a config
  field, adding a hook, configuring auto-copy patterns, asking what fields
  gw config supports, running gw init, adding a migration, bumping
  configVersion, keeping schema.json in sync, or troubleshooting missing
  env files in worktrees.
license: MIT
disable-model-invocation: true
metadata:
  author: mthines
  version: '4.0.0'
  workflow_type: advisory
---

# gw Configuration Management

Config lives at `.gw/config.json` (committable) and `.gw/config.local.json`
(gitignored, personal overrides). All worktrees in a repo share the same config.

## MANDATORY: Config-Change Rules

**Non-negotiable in any gw-tools repo.**

| Situation                                         | Required action                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Adding or renaming a `Config` field in `types.ts` | Add a migration in `config-migrations.ts`, increment `CURRENT_CONFIG_VERSION`, update `gw-config.schema.json`, and update `types.ts` |
| Removing a field from `Config`                    | Same as above — use a migration to delete it; never just remove from code                                                            |
| Old field in existing configs must keep working   | Write a migration that renames/transforms it. NEVER add backcompat shims in command code                                             |
| `configVersion` in a committed config             | Never edit it manually; gw manages it automatically                                                                                  |
| `gw-config.schema.json` diverges from `Config`    | Fix immediately — the schema is `additionalProperties: false` and IDE errors surface in every committed config                       |

The canonical migration guide is in the project root `CLAUDE.md` under
"Config Migration System". See also `packages/gw-tool/src/lib/config-migrations.ts`
(current version: `CURRENT_CONFIG_VERSION = 3`).

## Rules

| Rule                                              | Description                                               |
| ------------------------------------------------- | --------------------------------------------------------- |
| [fundamentals](./rules/fundamentals.md)           | **HIGH** - Config file location, creation, and precedence |
| [options-reference](./rules/options-reference.md) | **HIGH** - Complete reference for all config options      |
| [setup](./rules/setup.md)                         | **HIGH** - Initial setup flow, secrets, team onboarding   |
| [auto-copy](./rules/auto-copy.md)                 | **HIGH** - File patterns to copy, what to include/exclude |
| [team-config](./rules/team-config.md)             | **MEDIUM** - Sharing config, documentation, onboarding    |
| [advanced](./rules/advanced.md)                   | **LOW** - Multiple sources, secret management integration |
| [troubleshooting](./rules/troubleshooting.md)     | **HIGH** - Common issues and solutions                    |

## Complete Config Reference

```jsonc
{
  // Added automatically by gw init — enables IDE autocompletion/validation
  "$schema": "https://raw.githubusercontent.com/mthines/gw-tools/main/packages/gw-tool/schemas/gw-config.schema.json",

  // Managed automatically — do not edit manually
  "configVersion": 3,

  // Branch whose worktree is the source for auto-copy and sync (default: "main")
  // This worktree is protected from auto-clean.
  "defaultBranch": "main",

  // Files/dirs copied from defaultBranch worktree when gw checkout runs.
  // Paths are relative to repo root. Directories end with /. Non-existent entries are skipped with a warning.
  "autoCopyFiles": [".env", ".env.local", "secrets/"],

  // Commands run before/after gw checkout. Supports variable substitution (see Hooks below).
  "hooks": {
    "checkout": {
      // Pre-hooks: run before worktree creation. Failure aborts the checkout.
      "pre": ["echo 'Creating: {worktree}'"],
      // Post-hooks: run after successful creation. Failure warns but does NOT roll back.
      "post": ["cd {worktreePath} && pnpm install"],
    },
  },

  // Days before worktrees are considered stale for gw clean / auto-clean (default: 7)
  "cleanThreshold": 7,

  // When true, silently prunes stale worktrees after gw checkout / gw list.
  // Never removes defaultBranch. Only removes worktrees with no uncommitted or unpushed changes. (default: false)
  "autoClean": false,

  // Default strategy for gw update: "merge" (preserves history) or "rebase" (linear). (default: "merge")
  // Override per-command with --merge or --rebase flags.
  "updateStrategy": "merge",

  // Opt-in OpenTelemetry / Dash0 telemetry (disabled by default). When enabled, emits
  // one span + log per command to the maintainer's Dash0 instance. No branch names,
  // paths, or user identity are sent. Error messages are client-side redacted.
  //
  // IMPORTANT: "enabled" here has NO EFFECT. Opt-in is per-machine only:
  //   - Run `gw telemetry on` (writes to .gw/config.local.json, gitignored), OR
  //   - Set the GW_TELEMETRY=1 env var.
  // Setting "enabled: true" in this committed file does NOT opt in repo cloners.
  // The v4 migration strips "enabled" from committed configs automatically.
  //
  // To route to your own backend instead of the maintainer's, set "endpoint" here
  // or via .gw/config.local.json / OTEL_EXPORTER_OTLP_ENDPOINT.
  // NEVER put auth secrets in this committed file — use .gw/config.local.json.
  "telemetry": {
    "endpoint": "http://localhost:4318", // OTLP/HTTP base; gw POSTs /v1/traces and /v1/logs
    "environment": "production", // deployment.environment.name
    "serviceName": "gw", // service.name (default: "gw")
    "timeoutMs": 1500, // export flush timeout in ms
  },
}
```

**Local overrides** — create `.gw/config.local.json` to override any field for your machine only.
It is gitignored automatically and shallow-merged on top of `config.json` (local wins).
`telemetry.enabled` is the notable exception: it is only effective when set in
`config.local.json` (or via `GW_TELEMETRY` env var), never in the committed `config.json`.
Use `gw telemetry on` / `gw telemetry off` to manage it.

## Hook Variables

Available for substitution in any hook command string:

| Variable         | Value                                                 |
| ---------------- | ----------------------------------------------------- |
| `{worktree}`     | Worktree name (e.g. `feat/my-feature`)                |
| `{worktreePath}` | Absolute path to the new worktree                     |
| `{gitRoot}`      | Absolute path to the bare git repository root         |
| `{branch}`       | Branch name (same as worktree name for `gw checkout`) |

Example using variables:

```jsonc
{
  "hooks": {
    "checkout": {
      "post": ["cd {worktreePath} && pnpm install", "echo 'Ready at {worktreePath}'"],
    },
  },
}
```

## Adding a Migration (required when changing `Config`)

When any field in `packages/gw-tool/src/lib/types.ts`'s `Config` interface is
added, renamed, or removed, follow this checklist — see root `CLAUDE.md` for
the full authoritative process:

1. Increment `CURRENT_CONFIG_VERSION` in `config-migrations.ts`
2. Add a migration entry to the `MIGRATIONS` array that transforms old configs and sets `config.configVersion = <new version>`
3. Update `types.ts` to reflect the new shape
4. Update `schemas/gw-config.schema.json` — add/remove/rename properties, update `"default"` on `configVersion` to the new version
5. Remove any command-level backcompat code — migrations own backwards compatibility

Migration skeleton:

```typescript
{
  version: 3, // next version number
  description: 'Rename oldField to newField',
  migrate: (config) => {
    if (config.oldField !== undefined) {
      config.newField = config.oldField;
      delete config.oldField;
    }
    config.configVersion = 3;
    return config;
  },
}
```

## Quick Command Reference

| Task                           | Command                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| Initialize config              | `gw init`                                                                |
| Init with options              | `gw init --auto-copy-files .env,secrets/ --post-checkout "pnpm install"` |
| Interactive setup              | `gw init --interactive`                                                  |
| Clone and initialize           | `gw init git@github.com:user/repo.git`                                   |
| Show generated init command    | `gw show-init`                                                           |
| Sync files to current worktree | `gw sync`                                                                |
| Sync to specific worktree      | `gw sync feat/branch`                                                    |
| Sync specific files            | `gw sync feat/branch .env .env.local`                                    |

## Anti-Patterns

| Anti-pattern                                                 | Correct approach                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Adding a `Config` field without a migration                  | Always add a migration; bump `CURRENT_CONFIG_VERSION`                              |
| Handling an old field name in command code                   | Delete the handling; write a migration instead                                     |
| Editing `configVersion` in a config file by hand             | Let gw manage it; never edit manually                                              |
| Updating `types.ts` without updating `gw-config.schema.json` | Both files must stay in sync — the schema is `additionalProperties: false`         |
| Listing `node_modules/` or `dist/` in `autoCopyFiles`        | Only list secrets and env files that won't regenerate                              |
| Committing `.gw/config.local.json`                           | It is gitignored by design; keep machine-specific overrides out of version control |
| Adding absolute paths to `autoCopyFiles`                     | Paths must be relative to the repo root                                            |

## Key Principles

- **Set up secrets in `defaultBranch` first** — source must exist before auto-copy works.
- **Commit `config.json` to version control** — team members get it automatically.
- **Copy secrets, not dependencies** — `.env` yes, `node_modules/` no.
- **Migrations own backwards compat** — never add shims in command code.
- **`gw show-init` documents your setup** — generates a shareable init command from current config.

## Related Skills

- [git-worktree-workflows](../git-worktree-workflows/) - Using worktrees effectively (gw checkout, gw cd, gw clean, etc.)
- [autonomous-workflow](https://github.com/mthines/agent-skills#autonomous-workflow) - Autonomous development in isolated worktrees (lives in `mthines/agent-skills`)

## Resources

- [Project-Type Guides](./rules/project-types/) - Configuration guides for Next.js, Node.js API, monorepo, React SPA
- [Next.js Setup Example](./references/nextjs-setup.md)
- [Monorepo Setup Example](./references/monorepo-setup.md)
- [Troubleshooting Guide](./references/troubleshooting-config.md)
