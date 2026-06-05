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

## Removing Multiple Worktrees

`gw remove` accepts several worktree names and glob patterns in a single call.
When more than one worktree resolves, the list is shown and you confirm once
before anything is removed.

```bash
# Multiple worktrees by name
gw remove feat-a feat-b feat-c

# Every worktree under a scope (with shell integration installed)
gw remove feat/*

# Same, without shell integration — quote so the shell doesn't expand the pattern
gw remove 'feat/*'

# Greedy across '/' when the pattern has no '/'
gw remove fix*       # matches fix/agent0-foo, fix-branch, fixture

# Recursive — also matches nested worktrees
gw remove feat/**

# Preview without removing anything
gw remove --dry-run feat/*
gw remove -n feat/*

# Skip the confirmation prompt
gw remove --yes feat/*
```

### Pattern Semantics

- `*` in a pattern containing `/` (e.g. `feat/*`): bounded — does not cross `/`
- `*` in a bare pattern (no `/`, e.g. `fix*`): greedy — matches across `/`
- `**`: recursive — matches across `/`
- `?`: single character
- `[abc]` / `[!abc]`: character class

### Confirmation Prompts

- The batch confirmation prompt **defaults to yes** — just press Enter to proceed
- Type `n` or `no` to cancel
- Dirty worktrees in batch mode are skipped with a warning unless `--force` is set
- Protected branches (defaultBranch, main, master, gw_root) are filtered out automatically

### Shell Integration and Unquoted Globs

`eval "$(gw install-shell)"` installs an alias that wraps `gw` with `noglob`
on zsh. Without it, zsh's default `nomatch` aborts unquoted glob patterns
before `gw` ever runs. After installing (or in a fresh shell), `gw rm fix/*`
works unquoted. Bash with default options already passes unmatched globs
through literally, so no quoting is needed there either.

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

| Use Case                    | Command    |
| --------------------------- | ---------- |
| Weekly maintenance          | `gw clean` |
| Before project break        | `gw prune` |
| After major release         | `gw prune` |
| Full reset to minimal state | `gw prune` |

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
