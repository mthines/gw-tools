# gw-tools

Git Worktree Tools - A CLI for managing Git worktrees with automatic file syncing.

## 🛠️ gw CLI Tool

**gw** simplifies Git worktree management with features like:

- Create worktrees with automatic file copying (`.env`, secrets, configs)
- Quick navigation with `gw cd` and smart partial matching
- Proxy commands for `git worktree` operations with enhanced output

### Installation

The installation requires two steps: installing the `gw` CLI tool and setting up shell integration for commands like `gw cd`.

```bash
# Homebrew (macOS)
brew install mthines/gw-tools/gw && gw install-shell

# Linux
yay -S gw-tools && gw install-shell

# npm
npm install -g @gw-tools/gw && gw install-shell
```

### Quick Start

```bash
# Create a new worktree (auto-creates branch if needed, auto-copies files)
gw add feature-auth

# Navigate to worktree
gw cd feature-auth

# Sync files between worktrees
gw sync feature-auth .env secrets/

# List all worktrees
gw list

# Remove when done
gw remove feature-auth
```

📖 **Full documentation:** [packages/gw-tool/README.md](packages/gw-tool/README.md)

---

## 🔧 Git Hooks

This repository uses a pre-push hook for automatic code formatting.

### How It Works

- Commits are fast and immediate (no formatting checks)
- When you push, the pre-push hook checks formatting
- If issues are found, they're auto-fixed and a "chore: auto format fix" commit is created
- The push continues with your commits + the auto-format commit

### Formatting Tools

- **Prettier**: Formats all workspace files (TypeScript, JavaScript, JSON, etc.)
- **Deno fmt**: Formats the gw-tool package specifically

### Bypassing the Hook

If you need to push without formatting (not recommended):

```bash
git push --no-verify
```

### Manual Formatting

To manually check and fix formatting:

```bash
# Check formatting
nx format:check

# Fix formatting
nx format:write

# Format gw-tool with Deno
cd packages/gw-tool && deno fmt
```

---

## 🎓 AI Skills (for Claude Code, Copilot, Cursor, etc.)

Enhance your AI agent with gw-tools knowledge using [skills.sh](https://skills.sh):

```bash
npx skills add https://github.com/mthines/gw-tools --skill @gw-git-worktree-workflows @gw-config-management @gw-multi-worktree-dev # installs all skills
```

```bash
# Master Git worktrees and gw workflows
npx skills add https://github.com/mthines/gw-tools --skill @gw-git-worktree-workflows

# Configure gw for your project type (Next.js, monorepos, etc.)
npx skills add https://github.com/mthines/gw-tools --skill @gw-config-management

# Advanced parallel development patterns
npx skills add https://github.com/mthines/gw-tools --skill @gw-multi-worktree-dev
```

Once installed, your AI agent can:

- Create worktrees for bug fixes and features automatically
- Configure gw for your specific project type
- Navigate between worktrees and manage files
- Create PRs from isolated worktrees

📖 **Skill documentation:** [skills/README.md](skills/README.md)
