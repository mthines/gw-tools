---
title: "Listing and Inspecting Worktrees"
impact: LOW
tags:
  - gw-list
  - inspection
  - status
---

# Listing and Inspecting Worktrees

## Overview

Use `gw list` to see all worktrees and their states.
Understanding worktree states helps identify issues and plan cleanup.

## Core Principles

- **Run `gw list` before creating**: Check if worktree already exists.
- **First entry is main worktree**: Contains actual `.git` directory.
- **Watch for prunable state**: Indicates stale references to clean up.

## Commands

```bash
# List all worktrees
gw list

# Filter with grep
gw list | grep feature

# Find specific branch
gw list | grep "\[main\]"
```

## Worktree States

### Normal Worktree

```
/projects/myapp.git/feature-auth  def456a [feature-auth]
```

Path, commit hash, branch name.

### Detached HEAD

```
/projects/myapp.git/temp  xyz789d (detached)
```

No branch, pointing to specific commit.
Use for temporary testing or inspecting old commits.

### Locked Worktree

```
/projects/myapp.git/protected  abc123f [protected] (locked)
```

Cannot be removed without unlocking first.

### Prunable Worktree

```
/old/path/feature  abc123f [feature] (prunable)
```

Directory was moved or deleted, reference still exists.
Run `gw prune` to clean up.

## Main Worktree Identification

First worktree in list is the main worktree:

```bash
$ gw list
/projects/myapp.git/main  abc123f [main]  # Main worktree
/projects/myapp.git/feature  def456a [feature]
```

The main worktree:
- Contains the actual `.git` directory
- Cannot be removed
- Is the parent of all other worktrees

## Example Output

```bash
$ gw list

/projects/myapp.git/main          abc123f [main]
/projects/myapp.git/feature-auth  def456a [feature-auth]
/projects/myapp.git/hotfix-bug    ghi789b [hotfix-bug] (detached)
/projects/myapp.git/old-feature   jkl012c [feature-old] (locked)
```

## References

- Related rule: [cleanup](./cleanup.md)
- Related rule: [troubleshooting](./troubleshooting.md)
