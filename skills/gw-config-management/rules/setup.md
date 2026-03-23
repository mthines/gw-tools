---
title: 'Initial Setup'
impact: HIGH
tags:
  - setup
  - init
  - secrets
---

# Initial Setup

## Overview

Proper setup order is critical: secrets must exist in defaultBranch before auto-copy works.
This rule covers the correct setup sequence for new and existing repositories.

## Core Principles

- **Set up secrets in defaultBranch FIRST**: Source must exist before copying.
- **Use `gw init` for automatic setup**: Handles most cases.
- **Commit config to version control**: Share with team.
- **Document auto-copy files**: Help team understand what's copied.

## New Repository Setup

### 1. Clone and Initialize

```bash
# Clone and set up gw in one step
gw init git@github.com:user/repo.git

# Output:
# Cloning repository...
# ✓ Repository cloned
# ✓ Created gw_root branch
# ✓ Configuration created
# ✓ Created main worktree

# Works with empty repositories too — gw creates an initial
# commit and sets up the default branch automatically
```

### 2. Set Up Secrets in Main

```bash
cd main

# Create environment file
cp .env.example .env
# Edit with actual secrets

# Create secrets directory
mkdir -p secrets/
# Add credential files
```

### 3. Configure Auto-Copy

```bash
gw init --auto-copy-files .env,secrets/
```

### 4. Verify Setup

```bash
# Create test worktree
gw checkout test-feature

# Check files were copied
ls test-feature/.env
ls test-feature/secrets/

# Clean up
gw remove test-feature
```

## Existing Repository Setup

### 1. Navigate to Repository

```bash
cd /projects/myapp
```

### 2. Initialize gw

```bash
gw init

# Or with options
gw init --auto-copy-files .env,secrets/ \
        --post-checkout "cd {worktreePath} && pnpm install"
```

### 3. Ensure Secrets Exist

```bash
# Check defaultBranch worktree has secrets
ls .env
ls secrets/
```

## Team Onboarding

### Share Configuration

```bash
# Commit config to repo
git add .gw/config.json
git commit -m "chore: add gw configuration"
git push
```

### Document in README

```markdown
## Development Setup

1. Install gw: `npm install -g gw-tool`
2. Clone repository
3. Set up secrets:
   \`\`\`bash
   cp .env.example .env
   # Get secrets from team lead
   \`\`\`
4. Create worktree: `gw checkout feature-name`
```

### Generate Setup Command

```bash
# Show init command from current config
gw show-init

# Output: gw init --auto-copy-files .env,secrets/ --post-checkout 'cd {worktreePath} && pnpm install'
```

## Interactive Setup

For guided configuration:

```bash
gw init --interactive
```

Prompts for:

- Default source worktree
- Auto-copy files
- Pre-checkout hooks
- Post-checkout hooks
- Clean threshold
- Auto-clean setting
- Update strategy

## Troubleshooting

### Files Not Copied

**Symptom**: Worktree created but `.env` missing.

**Cause**: File doesn't exist in defaultBranch worktree.

**Fix**:

```bash
# Add file to source worktree
cd main
cp .env.example .env

# Then sync to existing worktrees
gw sync feature-branch .env
```

### Config Not Found

**Symptom**: `Error: Could not find .gw/config.json`

**Fix**:

```bash
gw init
```

## References

- Related rule: [fundamentals](./fundamentals.md)
- Related rule: [auto-copy](./auto-copy.md)
