---
title: "Feature Branch Development Pattern"
impact: HIGH
tags:
  - pattern
  - feature
  - workflow
---

# Feature Branch Development Pattern

## Overview

The feature branch pattern enables working on new features without interrupting current work.
Create an isolated worktree, develop the feature, and merge when ready.

## Core Principles

- **Create worktree before starting**: Isolate feature work from main branch.
- **Use `gw add` with descriptive names**: `feature-user-profiles` not `feat-1`.
- **Keep features focused**: One feature per worktree.
- **Update regularly with `gw update`**: Keep in sync with main branch.

## Procedure

### 1. Create Feature Worktree

```bash
# Create from main
gw add feature-user-profiles -b feature-user-profiles

# Or from develop
gw add feature-user-profiles -b feature-user-profiles develop
```

### 2. Set Up Environment

```bash
# Navigate (auto if shell integration)
gw cd feature-user-profiles

# Install dependencies
npm install

# Start development
npm run dev
```

### 3. Develop Feature

```bash
# Regular commits
git add .
git commit -m "feat: add user profile component"

# Push to remote
git push -u origin feature-user-profiles
```

### 4. Keep Updated

```bash
# Update with latest main changes
gw update

# Or specify source
gw update --from develop

# Handle conflicts if any
```

### 5. Complete and Merge

```bash
# Push final changes
git push

# Create PR via GitHub
gh pr create

# After merge, cleanup
gw cd main
gw remove feature-user-profiles
```

## Hierarchical Features

When building features that depend on other features:

```bash
# Create parent feature
gw add feature-auth

# Work on parent
git commit -m "feat: add basic auth"

# Create child feature from parent
gw add feature-auth-social --from feature-auth

# Child has all parent commits
```

**Merge order:**
1. Merge parent first: `feature-auth` → `main`
2. Rebase child onto updated main
3. Merge child: `feature-auth-social` → `main`

## Decision Table

| Situation | Action |
|-----------|--------|
| Starting new feature | `gw add feature-name` |
| Feature depends on another | `gw add child --from parent` |
| Need to update with main | `gw update` |
| Feature complete | PR → merge → `gw remove` |
| Feature abandoned | `gw remove --force` |

## References

- Related pattern: [hotfix](./hotfix.md)
- Related rule: [creation](../creation.md)
