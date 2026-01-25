# Configuration Management for gw

> Configure and optimize gw-tools for different project types and team needs

## 🎯 What You'll Learn

This skill teaches you how to configure gw for optimal workflow in any project type. You'll learn:

- **Configuration fundamentals** - Understanding `.gw/config.json` structure and auto-detection
- **Auto-copy strategies** - Which files to copy automatically for different project types
- **Project-specific patterns** - Ready-to-use configs for Next.js, Node.js APIs, monorepos, and SPAs
- **Team configuration** - Sharing configs across teams and onboarding new developers
- **Advanced techniques** - Multiple source worktrees, environment-specific configs
- **Troubleshooting** - Solving common configuration issues

## 📦 Installation

```bash
npx skills add your-org/gw-tools/config-management
```

## 📋 Prerequisites

- `gw` CLI tool installed ([installation guide](../../../packages/gw-tool/README.md#installation))
- A project to configure (Next.js, Node.js, monorepo, etc.)
- Basic understanding of Git worktrees ([git-worktree-workflows skill](../git-worktree-workflows/))

## 📚 What's Included

### Main Documentation

- **[SKILL.md](./SKILL.md)** - Comprehensive configuration guide

### Configuration Templates

- **[Next.js Config](./templates/nextjs-config.json)** - For Next.js applications
- **[Node.js API Config](./templates/nodejs-api-config.json)** - For backend APIs
- **[Monorepo Config](./templates/monorepo-config.json)** - For monorepo projects
- **[React SPA Config](./templates/react-spa-config.json)** - For React single-page apps

### Examples

- **[Next.js Setup](./examples/nextjs-setup.md)** - Step-by-step Next.js configuration
- **[Monorepo Setup](./examples/monorepo-setup.md)** - Configuring for monorepos
- **[Troubleshooting](./examples/troubleshooting-config.md)** - Common configuration problems

## 🚀 Quick Start

After installing this skill, try asking your AI agent:

```
"Configure gw for a Next.js project with Vercel"

"Set up auto-copy for my Node.js API with secrets"

"How should I configure gw for a monorepo with multiple packages?"

"Why aren't my environment files being copied?"
```

## 🎓 Quick Configuration

### Option 1: Auto-Detection (Easiest)

```bash
cd /path/to/your/project
gw init

# gw will auto-detect:
# - Repository root
# - Default branch (main/master)
```

### Option 2: Manual Configuration

```bash
gw init --root /path/to/repo.git \
        --default-branch main \
        --auto-copy-files .env,.env.local,secrets/
```

### Option 3: Use a Template

```bash
# Copy a template
cp skills/config-management/templates/nextjs-config.json .gw/config.json

# Edit for your project
vim .gw/config.json
```

## 🔗 Related Skills

- [git-worktree-workflows](../git-worktree-workflows/) - Learn worktree basics first
- [multi-worktree-dev](../multi-worktree-dev/) - Advanced parallel development patterns

## 💬 Common Configuration Patterns

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

## 🆘 Need Help?

- Check the [Troubleshooting Guide](./examples/troubleshooting-config.md)
- Review configuration [templates](./templates/)
- Ask your AI agent with this skill loaded
- Open an issue in the [main repository](../../../issues)

---

*Part of the [gw-tools skills collection](../)*
