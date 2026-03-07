---
title: "Next.js Project Configuration"
impact: MEDIUM
tags:
  - nextjs
  - vercel
  - react
---

# Next.js Project Configuration

## Overview

Configuration pattern for Next.js projects with Vercel deployment.
Includes environment files, Vercel settings, and upload directories.

## Recommended Configuration

```json
{
  "root": "/projects/myapp.git",
  "defaultBranch": "main",
  "autoCopyFiles": [
    ".env",
    ".env.local",
    ".env.development",
    ".vercel/",
    "public/uploads/",
    "components/ui/.vercel/"
  ]
}
```

## File Explanations

| File | Purpose |
|------|---------|
| `.env` | Shared environment variables |
| `.env.local` | Local overrides, secrets |
| `.env.development` | Development-specific vars |
| `.vercel/` | Vercel project configuration |
| `public/uploads/` | User-uploaded assets |
| `components/ui/.vercel/` | Component-specific Vercel settings |

## What NOT to Copy

```
node_modules/      # Install fresh
.next/             # Build fresh
out/               # Build fresh
.next/cache/       # Usually regenerates
```

## Setup Command

```bash
gw init --auto-copy-files .env,.env.local,.vercel/,public/uploads/
```

## Typical Structure

```
myapp/
├── .env
├── .env.local
├── .next/              # Don't copy
├── public/
│   └── uploads/        # Copy
├── components/
│   └── ui/
│       └── .vercel/    # Copy
└── pages/
```

## References

- Related: [monorepo](./monorepo.md)
- Example: [nextjs-setup](../../examples/nextjs-setup.md)
