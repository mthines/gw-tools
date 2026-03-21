---
title: 'Creating and Managing Worktrees'
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

# Create from staged files (extract WIP to new branch)
gw checkout feature-extracted --from-staged

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

# Works with empty repositories (no branches/commits yet)
gw init git@github.com:user/new-empty-repo.git

# Initialize existing repository
cd ~/projects/myapp
gw init
```

## Remote Fetch Behavior

| Scenario                   | Behavior                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| New branch (no `--from`)   | Fetches latest default branch, falls back to local on network failure |
| New branch (with `--from`) | Requires successful fetch, exits on failure                           |
| Local branch exists        | Uses local directly, no fetch                                         |
| Remote-only branch         | Fetches and creates local tracking branch (e.g., after `gw remove`)   |

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

## Extracting Staged Files (--from-staged)

Use `--from-staged` to extract work-in-progress to a new worktree. This is useful when you've started work that belongs in a different branch:

```bash
# 1. Stage files you want to extract
git add src/new-feature.ts tests/new-feature.test.ts

# 2. Create new worktree with staged files
gw checkout feat/new-feature --from-staged

# 3. Staged files are now in the new worktree
# Original worktree is unchanged (files remain staged)
```

### Behavior

- **All staged files**: `gw checkout <branch> --from-staged` copies all staged files
- **Specific files**: `gw checkout <branch> --from-staged file1 file2` only copies those files
- **autoCopyFiles still applies**: Config files like `.env` are copied alongside staged files
- **Deleted files skipped**: Files staged for deletion are skipped
- **Atomic operation**: If any file fails to copy, the worktree is removed

### Use Cases

- Started feature work but realized it should be a separate branch
- Need to split a large PR into smaller pieces
- Want to test changes in isolation without committing first

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

### Recreating a Removed Worktree

**Symptom**: After `gw remove feature-x`, need to work on it again.

**Fix**: Just run `gw checkout feature-x` again. It detects the branch exists on remote but not locally, and automatically creates a proper local tracking branch from the remote ref. No detached HEAD, `git push`/`git pull` work immediately.

### Network Fetch Failed

**Symptom**: `Could not fetch from remote`

**Fix**:

- Check network connection
- Without `--from`: Falls back to local (warning shown)
- With `--from`: Must fix network or remove `--from` flag

## References

- Related rule: [navigation](./navigation.md)
- Related rule: [patterns/feature-branch](./patterns/feature-branch.md)
