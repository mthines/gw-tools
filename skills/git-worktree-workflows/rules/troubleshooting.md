---
title: 'Troubleshooting Common Issues'
impact: HIGH
tags:
  - troubleshooting
  - errors
  - recovery
---

# Troubleshooting Common Issues

## Overview

Common worktree errors and their solutions.
Most issues stem from branch conflicts, stale references, or shell integration problems.

## "Worktree already exists"

**Symptom**:

```bash
fatal: 'feature-auth' already exists
```

**Fix**:

```bash
# List existing worktrees
gw list

# Navigate to existing
gw cd feature-auth

# Or remove and recreate
gw remove feature-auth
gw add feature-auth
```

## "Branch already checked out"

**Symptom**:

```bash
fatal: 'feature-x' is already checked out at '/projects/myapp.git/other-worktree'
```

**Fix**:

```bash
# Navigate to existing worktree
gw cd feature-x

# Or create with different name
gw add feature-x-v2 -b feature-x-v2

# Or use --force (creates copy)
gw add feature-x-copy -b feature-x-copy --force
```

## Git Ref Conflicts (Branch Name Hierarchy)

**Symptom**:

```bash
Cannot create branch test because it conflicts with existing branch test/foo
```

**Cause**: Git prevents both `test` and `test/foo` (hierarchical conflict).

**Fix**:

```bash
# Use different name
gw add test-new -b test-new

# Or delete conflicting branch
git branch -d test/foo
gw add test
```

**Prevention**: Use consistent naming. Good: `feature/auth`, `feature/checkout`. Bad: mixing `feature` and `feature/new`.

## Locked Worktree

**Symptom**:

```bash
fatal: 'feature-x' is locked
```

**Fix**:

```bash
gw unlock feature-x
gw remove feature-x
```

## Corrupted Worktree State

**Symptom**:

```bash
fatal: 'feature-x' does not appear to be a git repository
```

**Fix**:

```bash
# Try repair
gw repair

# If that fails, remove and recreate
gw remove feature-x --force
gw add feature-x -b feature-x origin/feature-x
```

## Permission Denied

**Symptom**:

```bash
fatal: could not create work tree dir 'feature-y': Permission denied
```

**Fix**:

```bash
# Check parent directory permissions
ls -la /projects/myapp.git/

# Fix permissions
chmod 755 /projects/myapp.git/
```

## Corrupted Git Index

**Symptom**:

```bash
error: bad signature 0x00000000
fatal: index file corrupt
```

**Fix**:

```bash
# In affected worktree
rm .git/index
git reset

# Or use repair
gw repair

# Rebuild index
git add .
```

## Shell Integration Not Working

**Symptom**: `gw cd` runs but directory doesn't change.

**Fix**:

```bash
# Add to ~/.zshrc or ~/.bashrc
eval "$(gw install-shell)"

# Reload
source ~/.zshrc
```

## Shell Parse Error

**Symptom**:

```bash
parse error near '()'
```

**Cause**: Conflicting alias and function with same name.

**Fix**:

- Remove conflicting alias from .zshrc
- Reinstall shell integration
- Reload shell

## Cleaning Up After Failed Creation

**Symptom**: Partial worktree left after failed creation.

**Fix**:

```bash
# Remove partial directory
rm -rf /projects/myapp.git/failed-worktree

# Clean up Git references
gw prune

# Verify
gw list
```

## Network Fetch Failed

**Symptom**: `Could not fetch from remote`

**Fix**:

```bash
# Check network
ping github.com

# Without --from: Falls back to local (warning)
gw add feature-x

# With --from: Must fix network or use different approach
gw add feature-x --from develop  # Requires network
gw add feature-x                 # Falls back to local
```

## References

- Related rule: [cleanup](./cleanup.md)
- Related rule: [creation](./creation.md)
