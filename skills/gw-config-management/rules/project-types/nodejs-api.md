---
title: 'Node.js API Configuration'
impact: MEDIUM
tags:
  - nodejs
  - api
  - backend
---

# Node.js API Configuration

## Overview

Configuration pattern for Node.js API/backend projects.
Includes environment files, SSL certificates, and service credentials.

## Recommended Configuration

```json
{
  "root": "/projects/api.git",
  "defaultBranch": "main",
  "autoCopyFiles": [".env", "ssl/", "keys/", "secrets/", "config/local.json"]
}
```

## File Explanations

| File                | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `.env`              | Database URLs, API keys, service credentials |
| `ssl/`              | SSL certificates for HTTPS                   |
| `keys/`             | JWT keys, encryption keys                    |
| `secrets/`          | Service account credentials                  |
| `config/local.json` | Local-only configuration overrides           |

## What NOT to Copy

```
node_modules/      # Install fresh
dist/              # Build fresh
logs/              # Runtime generated
coverage/          # Test generated
```

## Setup Command

```bash
gw init --auto-copy-files .env,ssl/,keys/,secrets/,config/local.json
```

## Typical Structure

```
api/
├── .env
├── src/
├── ssl/
│   ├── private.key
│   └── certificate.crt
├── keys/
│   └── jwt.key
├── secrets/
│   └── service-account.json
└── config/
    └── local.json
```

## Security Notes

- Never commit secrets to version control
- Use `.gitignore` for all sensitive files
- Consider secret management tools (Vault, AWS Secrets Manager)

## References

- Related: [nextjs](./nextjs.md)
- Rule: [auto-copy](../auto-copy.md)
