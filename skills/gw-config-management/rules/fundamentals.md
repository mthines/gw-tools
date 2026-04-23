---
title: 'gw Configuration Fundamentals'
impact: HIGH
tags:
  - config
  - setup
  - init
---

# gw Configuration Fundamentals

## Overview

gw stores configuration at `.gw/config.json` in your repository.
Configuration is per-repository, not global.
All worktrees in a repo share the same configuration.

## Core Principles

- **One config per repository**: Each repo has its own `.gw/config.json`.
- **Use `gw init` to create config**: Auto-detects root and default branch.
- **Commit config to version control**: Team members get it automatically.
- **Set up secrets in defaultBranch first**: Source must exist before auto-copy works.

## Config File Location

```
/projects/myapp.git/
├── main/                  # Main worktree
│   ├── src/
│   ├── .gw/
│   │   └── config.json   # Configuration file
│   └── package.json
├── feature-a/             # Worktrees share config
└── feature-b/
```

## Creating Configuration

### Auto-Detection (Recommended)

```bash
cd /projects/myapp/main
gw init

# Output:
# Repository root detected: /projects/myapp.git
# Default branch detected: main
# Configuration created at .gw/config.json
```

### With Options

```bash
gw init --root /projects/myapp.git \
        --default-source main \
        --auto-copy-files .env,.env.local,secrets/
```

### Interactive Mode

```bash
gw init --interactive
```

Guides you through all options with prompts.

### Clone and Initialize

```bash
# Clone repo and set up gw in one step
gw init git@github.com:user/repo.git

# With configuration
gw init git@github.com:user/repo.git \
        --auto-copy-files .env,secrets/ \
        --post-checkout "cd {worktreePath} && pnpm install"
```

## Config Structure

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/mthines/gw-tools/main/packages/gw-tool/schemas/gw-config.schema.json",

  "configVersion": 2,

  // Core Settings (safe to commit — no machine-specific paths)
  "defaultBranch": "main",
  "cleanThreshold": 7,

  // Auto-Copy Files
  "autoCopyFiles": [".env", "secrets/"],

  // Hooks
  "hooks": {
    "checkout": {
      "pre": ["echo 'Creating: {worktree}'"],
      "post": ["cd {worktreePath} && pnpm install"],
    },
  },

  // Advanced Options
  "autoClean": false,
  "updateStrategy": "merge",
}
```

JSONC support: Comments (`//`, `/* */`) and trailing commas allowed.

IDE autocompletion: The `$schema` property enables autocompletion and validation in VS Code, JetBrains, and other editors.

## Config Precedence

1. `gw` searches for `.gw/config.json` walking up from current directory
2. If found, loads it and applies any pending migrations
3. Loads `.gw/config.local.json` if present (shallow merge, local wins)
4. If not found, auto-creates `config.json` in the worktree root
5. Falls back to defaults:
   - `defaultBranch`: "main"
   - `autoCopyFiles`: `[]`

## First-Time Setup Flow

```bash
# 1. Clone as bare repository
git clone --bare https://github.com/user/repo.git repo.git
cd repo.git

# 2. Create main worktree
git worktree add main main

# 3. Set up secrets FIRST (source for auto-copy)
cd main
cp .env.example .env
# Add actual secrets

# 4. Initialize gw
gw init --auto-copy-files .env,secrets/

# 5. Now auto-copy works
gw checkout feature-new  # .env copied automatically
```

## Troubleshooting

### Config Not Detected

**Symptom**: `Error: Could not find .gw/config.json`

**Fix**:

```bash
gw init
```

### Auto-Detection Failed

**Symptom**: Wrong root or default branch detected.

**Fix**:

```bash
gw init --root /correct/path.git --default-source develop
```

## References

- Related rule: [options-reference](./options-reference.md)
- Related rule: [setup](./setup.md)
