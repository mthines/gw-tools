---
title: "Git Worktree Fundamentals"
impact: HIGH
tags:
  - concepts
  - worktree
  - git
---

# Git Worktree Fundamentals

## Overview

Git worktrees allow multiple working directories attached to a single repository.
Instead of switching branches in your current directory, check out different branches in separate directories simultaneously.
This eliminates context switching and enables true parallel development.

## Core Principles

- **Use worktrees for parallel work**: Keep main branch ready while working on features.
- **One branch per worktree**: Cannot check out the same branch in multiple worktrees.
- **Shared Git history**: All worktrees share the same `.git` directory, commits, and objects.
- **Isolated working files**: Each worktree has its own files, node_modules, and build artifacts.

## Worktree vs Branch Switching vs Cloning

| Approach | Pros | Cons |
|----------|------|------|
| **Branch Switching** | Single directory, less disk space | Interrupts work, requires stashing, IDE reindexes |
| **Worktrees** | Parallel work, no interruption, shared Git history | Slightly more disk space for working files |
| **Cloning** | Complete isolation | Huge disk space, separate Git history, harder to sync |

## What Worktrees Share

- Git repository (.git directory)
- Commit history and objects
- Branches and tags
- Stashes
- Hooks and config

## What Worktrees DON'T Share

- Working directory files
- Untracked files
- node_modules (unless symlinked)
- Build artifacts
- .env files (unless copied via auto-copy)

## When to Use Worktrees

**Ideal for:**
- Parallel feature development
- Hotfix workflows
- Code reviews (check out PRs without disrupting work)
- Testing multiple versions simultaneously
- Long-running experiments
- Separate build processes

**Not ideal for:**
- Very short-lived tasks (branch switching is faster)
- Single-file quick fixes

## Limitations

- Cannot check out the same branch in multiple worktrees simultaneously.
- Each worktree needs its own dependencies installed.
- IDE workspace settings may need adjustment for each worktree.
- Some Git UI tools have limited worktree support.

## Directory Structure Example

```
/repo.git/                    # Bare repository root
├── main/                     # Main branch worktree
├── feature-auth/             # Feature worktree
├── feature-payments/         # Another feature (parallel)
└── hotfix-123/               # Hotfix (urgent fix without interrupting)
```

## References

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- Related rule: [creation](./creation.md)
