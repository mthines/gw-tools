---
title: "Creating and Managing Worktrees"
impact: HIGH
tags:
  - gw-add
  - worktree
  - creation
  - setup
---

# Creating and Managing Worktrees

## Overview

The `gw add` command creates worktrees with automatic file copying, remote fetch handling, and navigation.
Always use `gw add` instead of raw `git worktree add` to get auto-copy and shell integration.

## Core Principles

- **Always use `gw add`**: Gets auto-copy files, shell navigation, and smart fetch behavior.
- **New branches fetch from remote**: Ensures fresh start point.
- **Local branches used directly**: No network required for existing local branches.
- **Use `--from` for explicit source**: Creates child branches from parent features.

## Basic Commands

```bash
# Create worktree for existing branch
gw add feature-auth

# Create worktree with new branch
gw add feature-payments -b feature-payments

# Create from different source branch
gw add feature-auth-social --from feature-auth

# Create without auto-navigation
gw add feature-auth --no-cd

# Force creation
gw add feature-test --force
```

## Initialize New Repository

```bash
# Clone and initialize gw in one step
gw init git@github.com:user/repo.git

# Clone with auto-copy configuration
gw init git@github.com:user/repo.git \
  --auto-copy-files .env,secrets/ \
  --post-add "pnpm install"

# Initialize existing repository
cd ~/projects/myapp
gw init
```

## Remote Fetch Behavior

| Scenario | Behavior |
|----------|----------|
| New branch (no `--from`) | Fetches latest default branch, falls back to local on network failure |
| New branch (with `--from`) | Requires successful fetch, exits on failure |
| Local branch exists | Uses local directly, no fetch |
| Remote-only branch | Fetches and creates local tracking branch |

### GOOD Pattern

```bash
# Create from parent feature (requires fresh fetch)
gw add feature-auth-oauth --from feature-auth

# Simple feature from default branch
gw add feature-dashboard
```

### BAD Pattern

```bash
# Don't use raw git worktree add - misses auto-copy
git worktree add ../feature-x feature-x

# Don't manually copy files - use auto-copy config
gw add feature-x
cp ../.env .env  # Unnecessary if configured
```

## Auto-Copy Configuration

Configure in `.gw/config.json`:

```json
{
  "root": "/Users/you/projects/myapp.git",
  "defaultBranch": "main",
  "autoCopyFiles": [".env", ".env.local", "secrets/"]
}
```

Files are automatically copied from default branch worktree when creating new worktrees.

## Navigating to Existing Worktrees

If worktree already exists, `gw add` prompts to navigate:

```bash
$ gw add feature-auth
ℹ Worktree feature-auth already exists at:
  /projects/myapp.git/feature-auth

Navigate to it? [Y/n]:
```

## Manual File Sync

```bash
# Sync auto-copy files to current worktree
gw sync

# Sync specific files
gw sync .env .env.local

# Sync to specific worktree from different source
gw sync --from staging feature-auth .env
```

## Troubleshooting

### "Branch already checked out" Error

**Symptom**: `fatal: 'feature-x' is already checked out at '/path'`

**Fix**:
```bash
# Navigate to existing worktree instead
gw cd feature-x

# Or create with different name
gw add feature-x-v2 -b feature-x-v2
```

### Network Fetch Failed

**Symptom**: `Could not fetch from remote`

**Fix**:
- Check network connection
- Without `--from`: Falls back to local (warning shown)
- With `--from`: Must fix network or remove `--from` flag

## References

- Related rule: [navigation](./navigation.md)
- Related rule: [patterns/feature-branch](./patterns/feature-branch.md)
