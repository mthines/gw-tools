---
title: "Advanced Configuration Techniques"
impact: LOW
tags:
  - advanced
  - integration
  - secrets-management
---

# Advanced Configuration Techniques

## Overview

Advanced patterns for complex workflows including multiple source worktrees, environment-specific configurations, and secret management integration.

## Multiple Source Worktrees

### Scenario

Different branch types need files from different sources:
- Feature branches → from develop
- Hotfixes → from main

### Configuration

```json
{
  "defaultBranch": "develop"
}
```

### Runtime Override

```bash
# Feature from develop (default)
gw add feature-x

# Hotfix from main
gw add hotfix-y --from main

# Sync specific files from staging
gw sync --from staging feature-x .env
```

## Environment-Specific Configurations

### Multiple Config Files

```bash
# Development
.gw/config.development.json

# Production
.gw/config.production.json

# Staging
.gw/config.staging.json
```

### Switching Environments

```bash
# Use development config
cp .gw/config.development.json .gw/config.json

# Use production config
cp .gw/config.production.json .gw/config.json
```

### Automation

```bash
# In Makefile or npm script
switch-env:
    cp .gw/config.$(ENV).json .gw/config.json
```

## Secret Management Integration

### 1Password

```bash
# After creating worktree
gw add feature-x

# Inject secrets
op inject -i feature-x/.env.template -o feature-x/.env
```

### AWS Secrets Manager

```bash
gw add feature-x

aws secretsmanager get-secret-value \
    --secret-id myapp/dev \
    --query SecretString \
    --output text > feature-x/.env
```

### HashiCorp Vault

```bash
gw add feature-x

vault kv get -field=.env secret/myapp > feature-x/.env
```

### Doppler

```bash
gw add feature-x

doppler secrets download \
    --no-file \
    --format env > feature-x/.env
```

## Post-Add Hooks

### Configure Hooks

```bash
gw init --post-add "pnpm install"
```

### Multiple Commands

```json
{
  "hooks": {
    "post-add": [
      "pnpm install",
      "cp .env.example .env"
    ]
  }
}
```

### Hook Variables

Available in hook commands:
- `{worktree}` - Worktree name
- `{worktreePath}` - Full path to worktree
- `{gitRoot}` - Repository root
- `{branch}` - Branch name

```json
{
  "hooks": {
    "post-add": "echo 'Created {worktree} at {worktreePath}'"
  }
}
```

## Network Behavior

### Remote-First Design

When creating new branches, gw fetches from remote:
1. Fetches latest source branch from remote
2. Creates branch from fresh remote ref
3. Sets up tracking

### Strictness Levels

| Command | Network Behavior |
|---------|------------------|
| `gw add feat/new` | Fetches remote, falls back to local |
| `gw add feat/new --from develop` | Requires successful fetch |

### Offline Fallback

Without `--from`, allows local fallback:
```
⚠ WARNING Could not fetch from remote
Falling back to local branch.
Creating from main (local branch)
```

## JSONC Support

Configuration supports JSON with Comments:

```jsonc
{
  // Repository root path
  "root": "/projects/myapp.git",

  /* Default branch for file copying
     and updates */
  "defaultBranch": "main",

  "autoCopyFiles": [
    ".env",      // Environment variables
    "secrets/",  // All secrets
  ]  // Trailing comma OK
}
```

## References

- Related rule: [options-reference](./options-reference.md)
- Related rule: [setup](./setup.md)
