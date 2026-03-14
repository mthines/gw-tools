---
title: 'Cleanup and Maintenance'
impact: MEDIUM
tags:
  - cleanup
  - gw-remove
  - gw-clean
  - gw-prune
  - maintenance
---

# Cleanup and Maintenance

## Overview

Regular cleanup prevents orphaned branches and wasted disk space.
Use `gw remove` for individual worktrees, `gw clean` for batch cleanup, and `gw prune` for full cleanup including orphan branches.

## Core Principles

- **Remove worktrees when done**: Don't accumulate old worktrees.
- **Use `gw clean` for batch cleanup**: Removes safe worktrees automatically.
- **Use `gw prune` for full cleanup**: Also removes orphan branches.
- **Protected branches never deleted**: main, master, defaultBranch, gw_root.

## Removing Individual Worktrees

```bash
# Remove worktree AND delete local branch (default)
gw remove feature-completed

# Remove worktree but KEEP local branch
gw remove feature-completed --preserve-branch

# Force removal (even with unpushed commits)
gw remove feature-abandoned --force
```

### What Happens

- Working directory deleted
- Worktree reference removed from Git
- Local branch deleted (unless `--preserve-branch`)
- Any other orphan branches pruned (branches with no worktree and no unpushed commits)
- Remote branch NOT affected
- To work on the branch again later, just run `gw checkout <branch>` — it will recreate the local tracking branch from remote

### Protected Worktrees

Cannot be removed:

- Default branch (typically `main`)
- `gw_root` branch
- Bare repository worktree

## Batch Cleanup with `gw clean`

```bash
# Preview safe worktrees to clean
gw clean --dry-run

# Remove all safe worktrees
gw clean

# Only remove worktrees older than threshold
gw clean --use-autoclean-threshold

# Force removal (skips safety checks)
gw clean --force

# Get JSON output for scripting (exits without prompting)
gw clean --json

# Skip confirmation prompt (auto-confirm removal)
gw clean --yes
```

### Safety Checks

Only removes worktrees with:

- NO uncommitted changes
- NO unpushed commits

After removing worktrees, also automatically prunes orphan branches (branches with no associated worktree and no unpushed commits).

## Full Cleanup with `gw prune`

```bash
# Preview what would be removed
gw prune --dry-run

# Remove worktrees AND orphan branches
gw prune

# Skip branch cleanup (worktrees only)
gw prune --no-branches

# Git passthrough (metadata cleanup only)
gw prune --stale-only
```

## Decision Table: `gw clean` vs `gw prune`

| Use Case                       | Command    |
| ------------------------------ | ---------- |
| Weekly maintenance             | `gw clean` |
| Before project break           | `gw prune` |
| After major release            | `gw prune` |
| Full reset to minimal state    | `gw prune` |

> **Note:** Both `gw clean` and `gw remove` now automatically prune orphan branches after removing worktrees, so orphan branches no longer accumulate over time.

## Locking Worktrees

```bash
# Protect from accidental removal
gw lock production-deploy

# Unlock when ready
gw unlock production-deploy
```

## Disk Space Management

```bash
# Check worktree sizes
du -sh /projects/myapp.git/*

# Share node_modules with symlinks (advanced)
rm -rf node_modules
ln -s ../main/node_modules node_modules

# Use pnpm for automatic sharing
pnpm install
```

## Configure Clean Threshold

```bash
# Set during init
gw init --clean-threshold 14

# Or edit .gw/config.json
{
  "cleanThreshold": 14
}
```

## Troubleshooting

### Locked Worktree Error

**Symptom**: `fatal: 'feature-x' is locked`

**Fix**:

```bash
gw unlock feature-x
gw remove feature-x
```

### Prunable Worktrees Showing

**Symptom**: Worktrees marked `(prunable)` in list.

**Fix**:

```bash
gw prune --stale-only
```

## References

- Related rule: [inspection](./inspection.md)
- Related rule: [troubleshooting](./troubleshooting.md)
