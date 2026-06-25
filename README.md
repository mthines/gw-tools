```
  ██████   ██      ██
 ██        ██      ██
 ██   ███  ██  ██  ██
 ██    ██   ██ ██ ██                        --- Git Worktree Tools ---
  ██████     ██  ██
 _____ ___   ___  _           A CLI for managing Git worktrees with automatic file syncing
|_   _/ _ \ / _ \| |                            and enhanced navigation.
  | || (_) | (_) | |__
  |_| \___/ \___/|____|
```

Git Worktree Tools - A CLI for managing Git worktrees with automatic file syncing and enhanced navigation.

[![Homebrew](https://img.shields.io/github/downloads/mthines/gw-tools/total?label=Homebrew%20%2B%20Binary%20Downloads&logo=homebrew)](https://github.com/mthines/homebrew-gw-tools)
[![npm Downloads](https://img.shields.io/npm/dt/@gw-tools/gw?label=npm&logo=npm)](https://www.npmjs.com/package/@gw-tools/gw)

## 🛠️ gw CLI Tool

**gw** simplifies Git worktree management with features like:

- Create worktrees with automatic file copying (`.env`, secrets, configs)
- Quick navigation with `gw cd` and smart partial matching
- Proxy commands for `git worktree` operations with enhanced output

[-> See docs <-](packages/gw-tool/README.md)

### [See demo](https://www.loom.com/share/3932770bf16d4ae49fe9bca89fb64644)

<a href="https://www.loom.com/share/3932770bf16d4ae49fe9bca89fb64644">
<img width="300" alt="Gemini_Generated_Image_1h2vv91h2vv91h2v" src="https://github.com/user-attachments/assets/4a5d73d9-ff00-4841-bb22-5488849b23c0" />
</a>

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

### Installation

Install the `gw` CLI tool, then add shell integration to your shell config for commands like `gw cd`:

```bash
brew install mthines/gw-tools/gw
```

```bash
npm install -g @gw-tools/gw
```

```bash
yay -S gw-tools
```

Then add to your shell config (`~/.zshrc` or `~/.bashrc`):

```bash
eval "$(gw install-shell)"
```

For Fish, add to `~/.config/fish/config.fish`:

```fish
gw install-shell | source
```

📖 **Full documentation:** [packages/gw-tool/README.md](packages/gw-tool/README.md)

**VS Code users:** Install the [gw-worktrees extension](https://marketplace.visualstudio.com/items?itemName=mthines.gw-worktrees) for integrated worktree management.

---

## 🎓 AI Skills

The two `gw`-specific skills shipped from this repo:

- [**git-worktree-workflows**](skills/git-worktree-workflows/) — Master Git worktrees and `gw` workflows
- [**gw-config-management**](skills/gw-config-management/) — Configure `gw` for your project type (Next.js, monorepos, etc.)

Install the gw-specific skills:

```bash
npx skills add https://github.com/mthines/gw-tools \
  --skill git-worktree-workflows gw-config-management \
  --agent claude-code \
  --yes
```

For the autonomous workflow and other coding-assistant skills (`autonomous-workflow`, `create-plan`, `create-walkthrough`, `confidence`, `tdd`, `ux`, `code-quality`, `holistic-analysis`, …), see the dedicated [**`mthines/agent-skills`**](https://github.com/mthines/agent-skills) repository.

---

## License

This project is licensed under the [MIT License](LICENSE).

While not required beyond keeping the license file, we appreciate a mention or link back to [gw-tools](https://github.com/mthines/gw-tools) if you find it useful in your own projects.
