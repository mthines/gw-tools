---
title: 'Auto-Copy Strategies'
impact: HIGH
tags:
  - auto-copy
  - files
  - sync
---

# Auto-Copy Strategies

## Overview

Auto-copy ensures secrets and environment files are available in new worktrees.
Configure `autoCopyFiles` to automatically copy files when creating worktrees with `gw add`.

## Core Principles

- **Copy secrets and environment files**: `.env`, API keys, certificates.
- **Don't copy dependencies**: No `node_modules`, `vendor`, build artifacts.
- **Use directories for groups**: `secrets/` copies everything inside.
- **Keep list focused**: Only files that won't regenerate automatically.

## Files to Copy

### Environment Variables

```json
{
  "autoCopyFiles": [".env", ".env.local", ".env.development"]
}
```

### Secrets and Credentials

```json
{
  "autoCopyFiles": ["secrets/", "keys/", "ssl/certificates/"]
}
```

### Local Configuration

```json
{
  "autoCopyFiles": ["config/local.json", ".vscode/settings.json"]
}
```

## Files NOT to Copy

| Type              | Why Not               |
| ----------------- | --------------------- |
| `node_modules/`   | Install fresh         |
| `dist/`, `build/` | Build fresh           |
| `.git`            | Handled automatically |
| `*.log`           | Not needed            |
| IDE settings      | Usually personal      |

## Pattern Types

### Single File

```json
"autoCopyFiles": [".env"]
```

Copies exactly one file.

### Directory (Recursive)

```json
"autoCopyFiles": ["secrets/"]
```

Copies entire directory including subdirectories:

```
secrets/
├── api-key.json     # Copied
├── database.env     # Copied
└── ssl/
    └── cert.pem     # Copied (recursive)
```

### Nested Path

```json
"autoCopyFiles": ["config/local.json"]
```

Copies only that specific file.

## Manual Sync

When files change or weren't copied:

```bash
# Sync all autoCopyFiles to current worktree
gw sync

# Sync to specific worktree
gw sync feature-branch

# Sync specific files
gw sync feature-branch .env .env.local

# Sync from different source
gw sync --from staging feature-branch .env
```

## Project-Specific Patterns

### Next.js

```json
{
  "autoCopyFiles": [".env", ".env.local", ".vercel/", "components/ui/.vercel/"]
}
```

### Node.js API

```json
{
  "autoCopyFiles": [".env", "ssl/", "keys/", "config/local.json"]
}
```

### Monorepo

```json
{
  "autoCopyFiles": [".env", "packages/api/.env", "packages/web/.env"]
}
```

## Troubleshooting

### File Not Copied

**Check 1**: File exists in source worktree?

```bash
ls ../main/.env
```

**Check 2**: File in autoCopyFiles?

```bash
cat .gw/config.json | grep autoCopyFiles
```

**Fix**: Add to config or sync manually.

### Wrong Files Copied

**Fix**: Be specific instead of using directories:

```json
// Instead of copying everything
"autoCopyFiles": ["config/"]

// Copy only what's needed
"autoCopyFiles": ["config/local.json", "config/secrets.json"]
```

### Path Not Found

**Symptom**: `Source file not found: secrets/api-key.json`

**Cause**: Using absolute path or wrong relative path.

**Fix**: Use paths relative to repo root:

```json
"autoCopyFiles": ["secrets/api-key.json"]  // Correct
// NOT: "/Users/you/projects/myapp/secrets/api-key.json"
```

## References

- Related rule: [options-reference](./options-reference.md)
- Related rule: [setup](./setup.md)
