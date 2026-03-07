---
title: "Navigating Between Worktrees"
impact: MEDIUM
tags:
  - navigation
  - gw-cd
  - gw-checkout
  - shell
---

# Navigating Between Worktrees

## Overview

Quick navigation between worktrees is essential for productive parallel development.
Use `gw cd` for directory-based navigation and `gw checkout` for branch-based navigation.
Shell integration enables real directory changes in your terminal.

## Core Principles

- **Use `gw cd` for worktree names**: Navigate by directory/worktree name.
- **Use `gw checkout` for branch names**: Navigate by branch, handles worktree conflicts.
- **Shell integration required**: Must have `eval "$(gw install-shell)"` in shell config.
- **Partial matching supported**: `gw cd feat` matches `feature-auth`.

## Commands

### `gw cd` - Directory Navigation

```bash
# Full worktree name
gw cd feature-authentication

# Partial match (first match wins)
gw cd feat

# Smart matching
gw cd auth    # Finds worktree with 'auth' in name
```

### `gw checkout` - Branch Navigation

```bash
# Checkout branch - navigates if already checked out elsewhere
gw checkout main
gw co main    # Alias

# If branch is in another worktree, navigates there
# If branch is remote-only, prompts to create worktree
```

## Decision Table

| Situation | Command |
|-----------|---------|
| Know worktree directory name | `gw cd <name>` |
| Know branch name | `gw checkout <branch>` |
| Branch already checked out elsewhere | `gw checkout` navigates there |
| Remote branch, no local worktree | `gw checkout` prompts to create |

## Shell Integration Setup

Add to `~/.zshrc` or `~/.bashrc`:

```bash
eval "$(gw install-shell)"
```

Then reload:

```bash
source ~/.zshrc
```

### Development Alias Setup

```bash
eval "$(gw install-shell --name gw-dev \
  --command 'deno run --allow-all ~/path/to/gw-tools/packages/gw-tool/src/main.ts')"
```

## IDE Integration

### VS Code

Open each worktree as separate window:

```bash
gw cd feature-a
code .
```

Or use multi-root workspace:

```json
{
  "folders": [
    { "name": "Main", "path": "/projects/myapp.git/main" },
    { "name": "Feature A", "path": "/projects/myapp.git/feature-a" }
  ]
}
```

### JetBrains IDEs

```bash
gw cd feature-a
idea .
```

## Troubleshooting

### `gw cd` Doesn't Navigate

**Symptom**: Command runs but directory doesn't change.

**Fix**: Ensure shell integration is installed:
```bash
# Check if function exists
type gw

# Re-install
eval "$(gw install-shell)"
source ~/.zshrc
```

### Parse Error in Shell Integration

**Symptom**: `parse error near '()'`

**Fix**: Remove conflicting alias from .zshrc, reinstall shell integration.

### `git checkout` Shows "Already Checked Out" Error

**Symptom**: `fatal: 'main' is already checked out at '/path'`

**Fix**: Use `gw checkout main` instead - it navigates to the worktree.

## References

- Related rule: [creation](./creation.md)
- Related rule: [inspection](./inspection.md)
