# Troubleshooting gw Configuration

Common configuration problems and their solutions.

## Table of Contents

1. [Configuration Not Found](#1-configuration-not-found)
2. [Files Not Being Copied](#2-files-not-being-copied)
3. [Wrong Source Worktree](#3-wrong-source-worktree)
4. [Path Resolution Issues](#4-path-resolution-issues)
5. [Auto-Detection Failures](#5-auto-detection-failures)
6. [Permission Errors](#6-permission-errors)
7. [Configuration Conflicts](#7-configuration-conflicts)

---

## 1. Configuration Not Found

### Problem

```bash
$ gw add feature-x
Error: Could not find .gw/config.json
```

### Diagnosis

```bash
# Check if config exists
ls -la .gw/config.json

# Check current directory
pwd

# Check if you're in a git repository
git rev-parse --show-toplevel
```

### Solutions

**Solution A: Initialize configuration**

```bash
gw init
```

**Solution B: Initialize with specific root**

```bash
gw init --root /path/to/repo.git
```

**Solution C: Check you're in the right directory**

```bash
# Navigate to your repository
cd /path/to/your/repo
gw init
```

---

## 2. Files Not Being Copied

### Problem

```bash
$ gw add feature-x
Creating worktree: feature-x
# No files copied!
```

### Diagnosis

```bash
# Check configuration
cat .gw/config.json

# Check if autoCopyFiles is configured
cat .gw/config.json | grep -A 10 autoCopyFiles

# Check if source files exist
ls -la ../main/.env
```

### Solutions

**Solution A: Configure auto-copy files**

```bash
gw init --auto-copy-files .env,.env.local,secrets/
```

**Solution B: Edit configuration manually**

```jsonc
{
  "root": "/path/to/repo.git",
  "defaultBranch": "main",
  "autoCopyFiles": [
    ".env",
    ".env.local",
    "secrets/"
  ]
}
```

**Solution C: Verify source files exist**

```bash
# Check if files exist in source worktree
gw cd main
ls -la .env

# If missing, create them first
touch .env
```

**Solution D: Manual sync as workaround**

```bash
# Sync all autoCopyFiles from config
gw sync feature-x

# Or sync specific files
gw sync feature-x .env .env.local
```

---

## 3. Wrong Source Worktree

### Problem

Files are being copied from wrong worktree (e.g., copying from `develop` instead of `main`).

### Diagnosis

```bash
# Check defaultBranch setting
cat .gw/config.json | grep defaultBranch
```

### Solutions

**Solution A: Update defaultBranch**

```bash
gw init --default-branch main
```

**Solution B: Use --from flag**

```bash
gw sync --from main feature-x .env
```

**Solution C: Edit configuration**

```jsonc
{
  "defaultBranch": "main"
}
```

---

## 4. Path Resolution Issues

### Problem

```bash
$ gw add feature-x
Error: Source file not found: /wrong/path/.env
```

### Diagnosis

```bash
# Check root path
cat .gw/config.json | grep root

# Verify the path exists
ls -la $(cat .gw/config.json | grep root | cut -d'"' -f4)
```

### Solutions

**Solution A: Use relative paths in autoCopyFiles**

```jsonc
{
  "autoCopyFiles": [
    ".env",           // ✓ Relative to worktree root
    "config/.env"     // ✓ Relative path
  ]
}
```

Not:

```jsonc
{
  "autoCopyFiles": [
    "/Users/you/repo/.env"  // ✗ Absolute path
  ]
}
```

**Solution B: Reinitialize with correct root**

```bash
# Auto-detect root
gw init

# Or specify manually
gw init --root $(git rev-parse --show-toplevel)
```

**Solution C: Check for typos in paths**

```jsonc
{
  "autoCopyFiles": [
    ".env",
    "secrets/api-key.json"  // Make sure path is correct
  ]
}
```

---

## 5. Auto-Detection Failures

### Problem

```bash
$ gw init
Error: Could not auto-detect repository root
```

### Diagnosis

```bash
# Check git worktree list
git worktree list

# Check if you're in a worktree
git rev-parse --show-toplevel
```

### Solutions

**Solution A: Specify root manually**

```bash
gw init --root /path/to/repo.git
```

**Solution B: Use gw root command**

```bash
gw init --root $(gw root)
```

**Solution C: Check directory structure**

Expected structure:
```
repo.git/           # Root (or repo/)
├── main/           # Main worktree
├── feature-a/      # Other worktrees
└── feature-b/
```

If your structure is different, specify root explicitly.

---

## 6. Permission Errors

### Problem

```bash
$ gw add feature-x
Error: Permission denied: .gw/config.json
```

Or:

```bash
Copying files to new worktree...
  ✗ Failed: .env (Permission denied)
```

### Diagnosis

```bash
# Check file permissions
ls -la .gw/config.json
ls -la .env

# Check directory permissions
ls -la .gw/
```

### Solutions

**Solution A: Fix file permissions**

```bash
chmod 644 .gw/config.json
chmod 644 .env
```

**Solution B: Fix directory permissions**

```bash
chmod 755 .gw/
```

**Solution C: Check ownership**

```bash
# If owned by different user
sudo chown $USER:$GROUP .gw/config.json
```

---

## 7. Configuration Conflicts

### Problem

Team members have different configurations causing inconsistent behavior.

### Diagnosis

```bash
# Check if config is in git
git ls-files .gw/config.json

# Check for local modifications
git diff .gw/config.json
```

### Solutions

**Solution A: Commit team configuration**

```bash
# Agree on team config
git add .gw/config.json
git commit -m "chore: standardize gw configuration"
git push
```

**Solution B: Use environment-specific configs**

```bash
# Team config (committed)
.gw/config.json

# Personal overrides (gitignored)
.gw/config.local.json
```

Add to `.gitignore`:
```
.gw/config.local.json
```

**Solution C: Document expected files**

In README:
```markdown
## Required Local Files

Before using gw, ensure you have:
- `.env` - Copy from `.env.example`
- `secrets/api-key.json` - Get from team lead
```

---

## Quick Reference

### Check Configuration

```bash
# View current config
cat .gw/config.json

# Verify gw can read it
gw add --help  # Should work without errors
```

### Reset Configuration

```bash
# Remove and reinitialize
rm -rf .gw/
gw init --auto-copy-files .env,.env.local
```

### Test Configuration

```bash
# Create test worktree
gw add test-config

# Verify files copied
ls -la test-config/.env

# Clean up
gw remove test-config
```

### Debug Mode

Currently gw doesn't have verbose mode, but you can check:

```bash
# What would be copied
cat .gw/config.json | grep -A 20 autoCopyFiles

# Source files exist
for f in .env .env.local secrets/; do
  ls -la "../main/$f" 2>/dev/null || echo "Missing: $f"
done
```

---

## Still Having Issues?

1. Check the [SKILL.md](../SKILL.md) for detailed documentation
2. Review project-specific examples:
   - [Next.js Setup](./nextjs-setup.md)
   - [Monorepo Setup](./monorepo-setup.md)
3. Ask your AI agent with this skill loaded
4. Open an issue in the [gw-tools repository](../../../issues)

---

*Part of the [config-management skill](../README.md)*
