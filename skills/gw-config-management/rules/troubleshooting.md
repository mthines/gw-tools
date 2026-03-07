---
title: "Troubleshooting Configuration"
impact: HIGH
tags:
  - troubleshooting
  - errors
  - fixes
---

# Troubleshooting Configuration

## Overview

Common configuration issues and their solutions.
Most problems stem from missing source files, incorrect paths, or config not being detected.

## Config Not Detected

**Symptom**:
```bash
Error: Could not find .gw/config.json
```

**Cause**: No config file exists or not in search path.

**Fix**:
```bash
# Initialize configuration
gw init

# Or with explicit root
gw init --root $(gw root)
```

## Files Not Auto-Copied

**Symptom**:
```bash
$ gw add feature-x
✓ Worktree created
# But .env is missing!
```

**Diagnostics**:
```bash
# Check configuration
cat .gw/config.json | grep autoCopyFiles

# Check if file exists in source
ls ../main/.env
```

**Solutions**:

### A: Add to auto-copy
```bash
gw init --auto-copy-files .env,.env.local
```

### B: Manual sync
```bash
# Sync all configured files
gw sync feature-x

# Sync specific file
gw sync feature-x .env
```

### C: File missing in source
```bash
# Add file to defaultBranch worktree first
cd main
cp .env.example .env

# Then sync
gw sync feature-x
```

## Wrong Files Being Copied

**Symptom**: Too many files or wrong files copied.

**Fix**: Be specific in config:

```json
// Instead of directory
"autoCopyFiles": ["config/"]

// Be specific
"autoCopyFiles": ["config/local.json"]
```

## Path Resolution Issues

**Symptom**:
```bash
Error: Source file not found: secrets/api-key.json
```

**Cause**: Wrong path format.

**Fix**: Use paths relative to repo root:

```json
// Correct
"autoCopyFiles": ["secrets/api-key.json"]

// Wrong - absolute path
"autoCopyFiles": ["/Users/you/projects/myapp/secrets/api-key.json"]

// Wrong - starts with ./
"autoCopyFiles": ["./secrets/api-key.json"]
```

## Root Path Wrong

**Symptom**: Commands fail or find wrong worktrees.

**Diagnostics**:
```bash
cat .gw/config.json | grep root
```

**Fix**:
```bash
# Reinitialize with correct root
gw init --root /correct/path/to/repo.git
```

## defaultBranch Wrong

**Symptom**: Files copied from wrong worktree.

**Fix**:
```bash
# Update in config
# Edit .gw/config.json:
{
  "defaultBranch": "develop"  // or correct branch
}
```

## Auto-Clean Not Working

**Symptom**: Stale worktrees not being cleaned.

**Check 1**: Is `autoClean` enabled?
```bash
cat .gw/config.json | grep autoClean
```

**Check 2**: Is threshold correct?
```bash
cat .gw/config.json | grep cleanThreshold
```

**Fix**:
```bash
gw init --auto-clean --clean-threshold 7
```

## Update Strategy Not Respected

**Symptom**: `gw update` uses wrong strategy.

**Check**: Config setting:
```bash
cat .gw/config.json | grep updateStrategy
```

**Fix**: Set strategy:
```json
{
  "updateStrategy": "rebase"
}
```

**Override per-command**:
```bash
gw update --rebase
gw update --merge
```

## Permission Denied

**Symptom**:
```bash
Error: EACCES: permission denied
```

**Fix**:
```bash
# Check directory permissions
ls -la /projects/myapp.git/

# Fix permissions
chmod 755 /projects/myapp.git/
```

## Config JSON Invalid

**Symptom**:
```bash
Error: Unexpected token in JSON
```

**Fix**: Validate JSON:
```bash
# Check for syntax errors
cat .gw/config.json | jq .

# Common issues:
# - Missing comma
# - Trailing comma (OK with JSONC)
# - Missing quotes
```

## References

- Related rule: [fundamentals](./fundamentals.md)
- Related rule: [setup](./setup.md)
