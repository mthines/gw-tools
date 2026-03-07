---
title: "Configuration Options Reference"
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

## Complete Structure

```jsonc
{
  "root": "/absolute/path/to/repo.git",
  "defaultBranch": "main",
  "autoCopyFiles": [".env", "secrets/"],
  "updateStrategy": "merge",
  "cleanThreshold": 7,
  "autoClean": true
}
```

## `root`

**Purpose**: Absolute path to parent directory containing all worktrees.

**Type**: String (absolute path)

**Used by**: All gw commands for path resolution.

```json
{
  "root": "/Users/you/projects/myapp.git"
}
```

**When to set manually**:
- Auto-detection fails
- Non-standard directory structure
- Using symlinks or network drives

## `defaultBranch`

**Purpose**: Default source worktree for file copying and updates.

**Type**: String (branch name)

**Used by**: `gw add`, `gw sync`, `gw update`, `gw clean`

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

**Used by**: `gw add`, `gw sync`

```json
{
  "autoCopyFiles": [
    ".env",
    ".env.local",
    "secrets/",
    "config/local.json"
  ]
}
```

**Pattern types**:
| Pattern | Copies |
|---------|--------|
| `".env"` | Single file |
| `"secrets/"` | Entire directory (recursive) |
| `"config/local.json"` | Specific nested file |

**Important**: Paths relative to repository root. Non-existent files skipped with warning.

## `updateStrategy`

**Purpose**: Default strategy for `gw update` command.

**Type**: `"merge"` or `"rebase"`

**Used by**: `gw update`

```json
{
  "updateStrategy": "rebase"
}
```

| Strategy | When to Use |
|----------|-------------|
| `merge` | Preserve complete history, shared branches |
| `rebase` | Linear history, personal feature branches |

**Override per-command**: `gw update --merge` or `gw update --rebase`

## `cleanThreshold`

**Purpose**: Days before worktrees considered stale.

**Type**: Number (days)

**Used by**: `gw clean --use-autoclean-threshold`, auto-clean

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

**Purpose**: Enable prompts to clean stale worktrees after commands.

**Type**: Boolean

**Used by**: `gw add`, `gw list`

```json
{
  "autoClean": true
}
```

**Behavior**:
- Prompts after `gw add` or `gw list` when stale worktrees detected
- Only prompts once per 24 hours
- Uses `cleanThreshold` for age check
- Never removes `defaultBranch` worktree

**Set during init**: `gw init --auto-clean`

## Decision Table: Which Options to Set

| Project Type | Essential Options |
|--------------|-------------------|
| Solo project | `autoCopyFiles` |
| Team project | All options, commit to repo |
| Monorepo | `autoCopyFiles` with package paths |
| CI/CD | `root`, `defaultBranch` |

## References

- Related rule: [auto-copy](./auto-copy.md)
- Related rule: [setup](./setup.md)
