```
  ██████   ██      ██
 ██        ██      ██
 ██   ███  ██  ██  ██
 ██    ██   ██ ██ ██                        --- Git Worktree Tools ---
  ██████     ██  ██
 _____ ___   ___  _           A CLI for managing Git worktrees with automatic file syncing, 
|_   _/ _ \ / _ \| |                enhanced navigation, and autonomous workflows.
  | || (_) | (_) | |__
  |_| \___/ \___/|____|    
```

Git Worktree Tools - A CLI for managing Git worktrees with automatic file syncing, enhanced navigation, and autonomous workflows.

## 🛠️ gw CLI Tool

**gw** simplifies Git worktree management with features like:

- Create worktrees with automatic file copying (`.env`, secrets, configs)
- Quick navigation with `gw cd` and smart partial matching
- Proxy commands for `git worktree` operations with enhanced output

[-> See docs <-](packages/gw-tool/README.md)

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

## 🎓 AI Skills (for Claude Code, Copilot, Cursor, etc.)

Enhance your AI agent with gw-tools knowledge using [skills.sh](https://skills.sh):

```bash
npx skills add https://github.com/mthines/gw-tools --skill @gw-git-worktree-workflows @gw-config-management @gw-autonomous-workflow # installs all skills
```

```bash
# Autonomous feature development workflow
npx skills add https://github.com/mthines/gw-tools --skill @gw-autonomous-workflow

# Master Git worktrees and gw workflows
npx skills add https://github.com/mthines/gw-tools --skill @gw-git-worktree-workflows

# Configure gw for your project type (Next.js, monorepos, etc.)
npx skills add https://github.com/mthines/gw-tools --skill @gw-config-management
```

Once installed, your AI agent can:

- Execute complete feature development cycles autonomously
- Create worktrees for bug fixes and features automatically
- Configure gw for your specific project type
- Navigate between worktrees and manage files
- Create tested PRs from isolated worktrees

📖 **Skill documentation:** [skills/README.md](skills/README.md)
