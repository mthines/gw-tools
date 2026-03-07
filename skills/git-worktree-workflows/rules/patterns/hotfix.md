---
title: "Hotfix Workflow Pattern"
impact: HIGH
tags:
  - pattern
  - hotfix
  - urgent
---

# Hotfix Workflow Pattern

## Overview

Handle critical production bugs without interrupting ongoing feature work.
Create a hotfix worktree, fix the issue, merge, and return to your previous work.

## Core Principles

- **Don't interrupt current work**: Create hotfix worktree, don't stash or switch.
- **Branch from production state**: Use main or the release tag.
- **Keep hotfixes minimal**: Fix only the critical issue.
- **Merge back to main AND current release**: Ensure fix is in both.

## Procedure

### 1. Create Hotfix Worktree

```bash
# Currently working on feature
gw cd feature-dashboard
# In the middle of uncommitted changes...

# Create hotfix without interrupting (no stash needed!)
gw add hotfix-login-bug -b hotfix-login-bug main
```

### 2. Fix the Bug

```bash
# Navigate to hotfix
gw cd hotfix-login-bug

# Make the fix
vim src/auth/login.js

# Commit
git add .
git commit -m "fix: resolve login timeout issue"
```

### 3. Push and Merge

```bash
# Push hotfix branch
git push -u origin hotfix-login-bug

# Create PR (urgent review)
gh pr create --title "URGENT: Fix login timeout" --label "hotfix"

# After approval, merge to main
```

### 4. Return to Feature Work

```bash
# Go back to feature
gw cd feature-dashboard

# All your uncommitted changes are still there!
git status  # Shows your work in progress
```

### 5. Cleanup

```bash
# After hotfix merged
gw remove hotfix-login-bug
```

## From Release Tag

For production issues in specific releases:

```bash
# Branch from release tag
gw add hotfix-v1.2.1 -b hotfix-v1.2.1 v1.2.0

# Fix, commit, push
# ...

# Merge to both release branch AND main
```

## Decision Table

| Situation | Action |
|-----------|--------|
| Bug in production | `gw add hotfix-name -b hotfix-name main` |
| Bug in specific release | `gw add hotfix-name -b hotfix-name v1.x.x` |
| Fix complete | PR → merge to main AND release branch |
| Need to update fix | `gw cd hotfix-name`, make changes |

## Benefits Over Branch Switching

| Traditional | With Worktrees |
|-------------|----------------|
| Stash current work | No stashing needed |
| Switch to main | Keep feature worktree untouched |
| Create hotfix branch | Create hotfix worktree |
| Fix, commit, push | Same |
| Switch back, unstash | Just `gw cd feature` |

## References

- Related pattern: [feature-branch](./feature-branch.md)
- Related rule: [creation](../creation.md)
