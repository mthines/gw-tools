---
title: 'Phase 2: Worktree Setup'
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

| Type        | Use Case              |
| ----------- | --------------------- |
| `feat/`     | New feature           |
| `fix/`      | Bug fix               |
| `refactor/` | Code restructuring    |
| `docs/`     | Documentation only    |
| `chore/`    | Tooling, dependencies |
| `test/`     | Adding/fixing tests   |

### Step 2: Create Worktree

```bash
gw add <branch-name>
```

If fails, see [error-recovery](./error-recovery.md).

### Step 3: Navigate to Worktree

```bash
gw cd <branch-name>
```

### Step 4: Install Dependencies

```bash
# Use the project's package manager
pnpm install  # or npm install, yarn install
```

### Step 5: Verify Environment

Run the project's build/check command appropriate to the stack:

```bash
# Examples — use whatever the project uses
npx tsc --noEmit        # TypeScript projects
npm run build            # General build check
go vet ./...             # Go projects
```

### Step 6: Sync Configuration (If Needed)

```bash
gw sync <branch-name>
```

### Step 7: Ensure .gw/ is Gitignored

```bash
grep -q "^\.gw/$" .gitignore 2>/dev/null || echo ".gw/" >> .gitignore
```

### Step 8: Generate plan.md (Full Mode ONLY)

**CRITICAL: The artifact must be created HERE — inside the worktree, not on the main branch.**

```
Skill(skill: "create-plan")
```

This generates `.gw/{branch-name}/plan.md` from the Phase 1 planning conversation.

**DO NOT proceed to Phase 3 without plan.md generated (Full Mode).**

## gw Commands Reference

```bash
gw add feat/my-feature         # Create worktree
gw add feat/my-feature --from develop  # From different source
gw cd feat/my-feature          # Navigate to worktree
gw list                        # Verify worktree
gw status                      # Check current status
```

## Setup Checklist

Before Phase 3 (Implementation):

- [ ] Smart detection completed
- [ ] Branch name follows conventions
- [ ] Worktree created with `gw add`
- [ ] Currently in worktree directory (`pwd` verified)
- [ ] Dependencies installed
- [ ] Environment builds/compiles
- [ ] `.gw/` is gitignored
- [ ] plan.md created and populated in worktree (Full Mode only)

**If any marked item not checked, STOP and complete Phase 2.**

## Troubleshooting

### Branch Already Exists

```bash
gw cd <branch-name>         # Navigate to existing
gw add <branch-name>-v2     # Or create with different name
```

### Dependencies Failed

```bash
rm -rf node_modules
npm install
```

## References

- Related rule: [smart-worktree-detection](./smart-worktree-detection.md)
- Related rule: [phase-3-implementation](./phase-3-implementation.md)
- Related skill: [git-worktree-workflows](../../git-worktree-workflows/)
