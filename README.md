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

[![Homebrew](https://img.shields.io/github/downloads/mthines/gw-tools/total?label=Homebrew%20%2B%20Binary%20Downloads&logo=homebrew)](https://github.com/mthines/homebrew-gw-tools)
[![npm Downloads](https://img.shields.io/npm/dt/@gw-tools/gw?label=npm&logo=npm)](https://www.npmjs.com/package/@gw-tools/gw)

## 🛠️ gw CLI Tool

**gw** simplifies Git worktree management with features like:

- Create worktrees with automatic file copying (`.env`, secrets, configs)
- Quick navigation with `gw cd` and smart partial matching
- Proxy commands for `git worktree` operations with enhanced output

[-> See docs <-](packages/gw-tool/README.md)

**VS Code users:** Install the [gw-worktrees extension](https://marketplace.visualstudio.com/items?itemName=mthines.gw-worktrees) for integrated worktree management.

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

## 🤖 Autonomous Workflow Agent

**Ship features while you sleep.** The `@gw-tools/autonomous-workflow-agent` handles complete feature development—from task intake to tested PR—in isolated Git worktrees.

[-> See docs <-](packages/autonomous-workflow-agent/README.md)

### What It Does

Give the agent a task and walk away:

1. **Validates** requirements with you before coding
2. **Plans** implementation by analyzing your codebase
3. **Isolates** work in a Git worktree (your main branch stays clean)
4. **Implements** with logical, incremental commits
5. **Tests** and iterates until green
6. **Creates** a draft PR with full context

### Quick Install for Claude Code

**Prerequisites:** gw CLI must be installed first (see above)

Install the skill + agent either **globally** or **per-project**:

**Global** (personal use — works in all projects):

```bash
npx skills add https://github.com/mthines/gw-tools --skill autonomous-workflow --global --yes && \
  mkdir -p ~/.claude/agents && \
  ln -sf ~/.agents/skills/autonomous-workflow/templates/agent.template.md \
     ~/.claude/agents/autonomous-workflow.md
```

Installs the skill to `~/.agents/skills/` and links the agent definition into `~/.claude/agents/` so it's available in every project.

**Per-project** (team use — committable to git):

```bash
npx skills add https://github.com/mthines/gw-tools --skill autonomous-workflow --yes && \
  mkdir -p .claude/agents .claude/rules && \
  ln -sf .agents/skills/autonomous-workflow/templates/agent.template.md \
     .claude/agents/autonomous-workflow.md && \
  ln -sf .agents/skills/autonomous-workflow/templates/routing-rule.template.md \
     .claude/rules/autonomous-workflow-routing.md
```

Installs the skill to `.agents/skills/` in your project and links the agent + routing rule into `.claude/`. All paths are relative, so the setup can be committed and shared with your team.

Then just say _"implement X independently"_ and the agent takes over.

### For Agent SDK Developers

```bash
npm install @gw-tools/autonomous-workflow-agent
```

```typescript
import { autonomousWorkflowAgent } from '@gw-tools/autonomous-workflow-agent';
import { query } from '@anthropic-ai/claude-code-sdk';

for await (const message of query({
  prompt: 'Add user authentication with JWT tokens',
  options: {
    agents: { 'autonomous-workflow': autonomousWorkflowAgent },
  },
})) {
  console.log(message);
}
```

📖 **Full documentation:** [packages/autonomous-workflow-agent/README.md](packages/autonomous-workflow-agent/README.md)

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

---

## License

This project is licensed under the [MIT License](LICENSE).

While not required beyond keeping the license file, we appreciate a mention or link back to [gw-tools](https://github.com/mthines/gw-tools) if you find it useful in your own projects.
