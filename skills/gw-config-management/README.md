# Configuration Management for gw

> Configure and optimize gw-tools for different project types and team needs

## What You'll Learn

This skill teaches you how to configure gw for optimal workflow in any project type. You'll learn:

- **Configuration fundamentals** - Understanding `.gw/config.json` structure and auto-detection
- **IDE autocompletion** - JSON Schema support for VS Code, JetBrains, and other editors
- **Auto-copy strategies** - Which files to copy automatically for different project types
- **Hooks** - Pre/post checkout commands for automated setup
- **Project-specific patterns** - Ready-to-use configs for Next.js, Node.js APIs, monorepos, and SPAs
- **Team configuration** - Sharing configs across teams and onboarding new developers
- **Advanced techniques** - Multiple source worktrees, environment-specific configs
- **Troubleshooting** - Solving common configuration issues

## Installation

```bash
npx skills add https://github.com/mthines/gw-tools --skill
```

Select `gw-config-management` from the interactive menu.

## Prerequisites

- `gw` CLI tool installed ([installation guide](../../../packages/gw-tool/README.md#installation))
- A project to configure (Next.js, Node.js, monorepo, etc.)
- Basic understanding of Git worktrees ([git-worktree-workflows skill](../git-worktree-workflows/))

## What's Included

### Main Documentation

- **[SKILL.md](./SKILL.md)** - Comprehensive configuration guide

### Project-Type Configuration Guides

- **[Next.js Config](./rules/project-types/nextjs.md)** - For Next.js applications
- **[Node.js API Config](./rules/project-types/nodejs-api.md)** - For backend APIs
- **[Monorepo Config](./rules/project-types/monorepo.md)** - For monorepo projects
- **[React SPA Config](./rules/project-types/react-spa.md)** - For React single-page apps

### References (Lazy-loaded)

- **[Next.js Setup](./references/nextjs-setup.md)** - Step-by-step Next.js configuration
- **[Monorepo Setup](./references/monorepo-setup.md)** - Configuring for monorepos
- **[Troubleshooting](./references/troubleshooting-config.md)** - Common configuration problems

## Quick Start

After installing this skill, try asking your AI agent:

```
"Configure gw for a Next.js project with Vercel"

"Set up auto-copy for my Node.js API with secrets"

"How should I configure gw for a monorepo with multiple packages?"

"Why aren't my environment files being copied?"
```

## Quick Configuration

### Option 1: Auto-Detection (Easiest)

```bash
cd /path/to/your/project
gw init

# gw will auto-detect:
# - Repository root
# - Default branch (main/master)
# - Creates config with $schema for IDE autocompletion
```

### Option 2: Manual Configuration

```bash
gw init --root /path/to/repo.git \
        --default-source main \
        --auto-copy-files .env,.env.local,secrets/
```

### Option 3: Use a Project-Type Guide

```bash
# Check the recommended config for your project type
# See: ./rules/project-types/nextjs.md (or nodejs-api.md, monorepo.md, react-spa.md)

# Then initialize with the recommended settings
gw init --auto-copy-files .env,.env.local,.vercel/
```

### Option 4: With Hooks

```bash
gw init --auto-copy-files .env,secrets/ \
        --post-checkout "cd {worktreePath} && pnpm install"
```

## Related Skills

- [git-worktree-workflows](../git-worktree-workflows/) - Learn worktree basics first
- [autonomous-workflow](https://github.com/mthines/agent-skills#autonomous-workflow) - Autonomous feature development workflow (lives in `mthines/agent-skills`)

## Common Configuration Patterns

### Next.js Projects

- Copy: `.env*`, `.vercel/`, `public/uploads/`
- Skip: `.next/`, `node_modules/`

### Node.js APIs

- Copy: `.env`, `ssl/`, `keys/`, `secrets/`
- Skip: `node_modules/`, `dist/`, `build/`

### Monorepos

- Copy: Root `.env`, workspace configs, shared secrets
- Skip: Individual `node_modules/`, build outputs

### React SPAs

- Copy: `.env`, `.env.local`, `public/config.json`
- Skip: `build/`, `dist/`, `node_modules/`

## Need Help?

- Check the [Troubleshooting Guide](./references/troubleshooting-config.md)
- Review [project-type guides](./rules/project-types/)
- Ask your AI agent with this skill loaded
- Open an issue in the [main repository](https://github.com/mthines/gw-tools/issues)

---

_Part of the [gw-tools skills collection](../)_
