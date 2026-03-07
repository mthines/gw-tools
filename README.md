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

Install the `gw` CLI tool, then add shell integration to your shell config for commands like `gw cd`:

```bash
# Homebrew (macOS & linux)
brew install mthines/gw-tools/gw

# Linux
yay -S gw-tools

# npm (auto-adds shell integration)
npm install -g @gw-tools/gw
```

Then add to your shell config (`~/.zshrc` or `~/.bashrc`):

```bash
eval "$(gw install-shell)"
```

For Fish, add to `~/.config/fish/config.fish`:

```fish
gw install-shell | source
```

### Quick Start

```bash
# Clone and set up repository with gw
gw init git@github.com:user/repo.git

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
npx skills add https://github.com/mthines/gw-tools --skill
```

Available skills:

- **autonomous-workflow** - Autonomous feature development from requirements to PR
- **git-worktree-workflows** - Master Git worktrees and gw workflows
- **gw-config-management** - Configure gw for your project type (Next.js, monorepos, etc.)

Once installed, your AI agent can:

- Execute complete feature development cycles autonomously
- Create worktrees for bug fixes and features automatically
- Configure gw for your specific project type
- Navigate between worktrees and manage files
- Create tested PRs from isolated worktrees

📖 **Skill documentation:** [skills/README.md](skills/README.md)
