---
title: "Monorepo Configuration"
impact: MEDIUM
tags:
  - monorepo
  - pnpm
  - yarn
  - workspaces
---

# Monorepo Configuration

## Overview

Configuration pattern for monorepos using pnpm, Yarn, or npm workspaces.
Includes root and package-specific environment files.

## Recommended Configuration

```json
{
  "root": "/projects/monorepo.git",
  "defaultBranch": "main",
  "autoCopyFiles": [
    ".env",
    "packages/api/.env",
    "packages/web/.env",
    "packages/shared/config.local.json",
    ".vercel/"
  ]
}
```

## File Explanations

| File | Purpose |
|------|---------|
| `.env` | Root-level shared environment |
| `packages/api/.env` | API service configuration |
| `packages/web/.env` | Web app configuration |
| `packages/shared/config.local.json` | Cross-package configuration |
| `.vercel/` | Deployment configuration |

## What NOT to Copy

```
node_modules/           # Install fresh
packages/*/node_modules # Install fresh
packages/*/dist         # Build fresh
.turbo/                 # Cache regenerates
```

## Setup Command

```bash
gw init --auto-copy-files .env,packages/api/.env,packages/web/.env
```

## Typical Structure

```
monorepo/
├── .env                      # Root environment
├── packages/
│   ├── api/
│   │   └── .env             # Package-specific
│   ├── web/
│   │   └── .env
│   └── shared/
│       └── config.local.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Nx Monorepo Pattern

For Nx workspaces:

```json
{
  "autoCopyFiles": [
    ".env",
    "apps/api/.env",
    "apps/web/.env",
    "libs/shared/config.local.json"
  ]
}
```

## References

- Related: [nextjs](./nextjs.md)
- Example: [monorepo-setup](../../examples/monorepo-setup.md)
