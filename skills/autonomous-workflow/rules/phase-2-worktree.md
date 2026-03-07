---
title: "Phase 2: Worktree Setup"
impact: CRITICAL
tags:
  - worktree
  - mandatory
  - isolation
  - gw
  - phase-2
---

# Phase 2: Worktree Setup (MANDATORY)

## Overview

This phase is MANDATORY before any code changes.
Always create a new isolated worktree using `gw add`.
Never work in the user's current directory.

## Core Principles

- **Isolation is mandatory**: Every autonomous execution creates a worktree.
- **Use `gw add`**: Not raw `git worktree add`.
- **Check smart detection first**: See [smart-worktree-detection](./smart-worktree-detection.md).
- **Verify setup before coding**: Build must work in worktree.

## Why Isolation Matters

- Preserves user's working state
- Enables true parallel development
- Provides clean rollback (just remove worktree)
- Follows gw-tools best practices

## When to Skip (Rare)

Only skip worktree creation if user explicitly says:
- "work in current directory"
- "don't create worktree"
- "continue here" (after smart detection prompt)

## Procedure

### Step 0: Smart Detection

Before creating, check if current worktree matches task.
See [smart-worktree-detection](./smart-worktree-detection.md).

### Step 1: Generate Branch Name

**Pattern:** `<type>/<short-description>`

| Type | Use Case |
|------|----------|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `refactor/` | Code restructuring |
| `docs/` | Documentation only |
| `chore/` | Tooling, dependencies |
| `test/` | Adding/fixing tests |

**Examples:**
- `feat/dark-mode-toggle`
- `fix/login-validation-error`
- `refactor/api-client-structure`

### Step 2: Create Worktree

```bash
gw add <branch-name>
```

**Validation:**
- Command succeeded?
- Worktree appears in `gw list`?

If fails, see [error-recovery](./error-recovery.md).

### Step 3: Navigate to Worktree

```bash
gw cd <branch-name>
```

**Validation:**
- `pwd` shows correct directory?
- `.git` symlink exists?

### Step 4: Install Dependencies

```bash
# Check package manager
npm install
# or
pnpm install
# or
yarn install
```

**Validation:**
- `node_modules/` exists?
- No installation errors?

### Step 5: Verify Environment

```bash
# Build check
npm run build  # or tsc --noEmit

# Lint check
npm run lint

# Test framework check
npm test -- --listTests
```

**Validation:**
- No immediate errors?
- Build system works?
- Test framework found?

### Step 6: Sync Configuration (If Needed)

```bash
gw sync <branch-name>
```

**Validation:**
- `.env` copied (if configured)?
- Config files synced?

## gw Commands Reference

```bash
# Create worktree
gw add feat/my-feature

# Create from different source
gw add feat/my-feature --from develop

# Navigate to worktree
gw cd feat/my-feature

# Verify worktree
gw list

# Check current status
gw status
```

## Setup Checklist

Before Phase 3 (Implementation):
- [ ] Smart detection completed
- [ ] Branch name follows conventions
- [ ] Worktree created with `gw add`
- [ ] Currently in worktree directory (`pwd` verified)
- [ ] Dependencies installed
- [ ] Environment builds/compiles
- [ ] Configuration files synced

**If any marked item not checked, STOP and complete Phase 2.**

## Troubleshooting

### Branch Already Exists

```bash
# Navigate to existing worktree
gw cd <branch-name>

# Or create with different name
gw add <branch-name>-v2
```

### Worktree Already Exists

```bash
# gw add will prompt to navigate
gw add feature-auth
# "Worktree exists, navigate to it? [Y/n]"
```

### Dependencies Failed

```bash
# Clear and reinstall
rm -rf node_modules
npm install
```

## References

- Related rule: [smart-worktree-detection](./smart-worktree-detection.md)
- Related rule: [phase-3-implementation](./phase-3-implementation.md)
- Related skill: [git-worktree-workflows](../../git-worktree-workflows/)
