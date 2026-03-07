---
title: "React SPA Configuration"
impact: MEDIUM
tags:
  - react
  - spa
  - frontend
---

# React SPA Configuration

## Overview

Configuration pattern for React Single Page Applications.
Includes environment files and runtime configuration.

## Recommended Configuration

```json
{
  "root": "/projects/webapp.git",
  "defaultBranch": "main",
  "autoCopyFiles": [
    ".env",
    ".env.local",
    "public/config.json"
  ]
}
```

## File Explanations

| File | Purpose |
|------|---------|
| `.env` | Build-time environment variables |
| `.env.local` | Local API endpoints, feature flags |
| `public/config.json` | Runtime configuration |

## What NOT to Copy

```
node_modules/      # Install fresh
build/             # Build fresh
dist/              # Build fresh
coverage/          # Test generated
```

## Setup Command

```bash
gw init --auto-copy-files .env,.env.local,public/config.json
```

## Typical Structure

```
webapp/
├── .env
├── .env.local
├── public/
│   └── config.json
├── src/
│   ├── App.tsx
│   └── index.tsx
└── package.json
```

## Build-Time vs Runtime Configuration

### Build-Time (`.env`)

Variables baked into the bundle:
```
REACT_APP_API_URL=https://api.example.com
REACT_APP_VERSION=1.0.0
```

### Runtime (`public/config.json`)

Variables loaded at runtime:
```json
{
  "apiUrl": "https://api.example.com",
  "features": {
    "darkMode": true
  }
}
```

**Why both?**
- Build-time: Cannot change without rebuild
- Runtime: Can change per environment without rebuild

## References

- Related: [nextjs](./nextjs.md)
- Rule: [auto-copy](../auto-copy.md)
