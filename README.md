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

---

## 🤖 Autonomous Workflow Agent

**Ship features while you sleep.** The `@gw-tools/autonomous-workflow-agent` handles complete feature development—from task intake to tested PR—in isolated Git worktrees.

> The **skill itself** (the phase rules, companions, planner / executor agents) lives at [**`mthines/agent-skills` → autonomous-workflow**](https://github.com/mthines/agent-skills#autonomous-workflow). This package (`@gw-tools/autonomous-workflow-agent`) is a thin Claude Agent SDK wrapper that loads the skill at runtime.

[-> See SDK package docs <-](packages/autonomous-workflow-agent/README.md) · [-> See full skill docs <-](https://github.com/mthines/agent-skills/tree/main/skills/autonomous-workflow)

### What It Does

Give the agent a task and walk away:

1. **Validates** requirements with you before coding
2. **Plans** implementation by analyzing your codebase
3. **Isolates** work in a Git worktree (your main branch stays clean)
4. **Implements** with logical, incremental commits
5. **Tests** and iterates until green
6. **Creates** a draft PR with full context

**Visualize progress as it happens** — install the [Agent Tasks VS Code extension](https://marketplace.visualstudio.com/items?itemName=mthines.agent-tasks) to see `plan.md` / `task.md` / `walkthrough.md` artifacts live in the sidebar.

### Quick Install for Claude Code

**Prerequisites:** `gh` CLI is required for PR creation; `gw` CLI is recommended (see above) but optional — the workflow falls back to native `git worktree` if `gw` is absent.

Install the skill + companion agents from the new home, [`mthines/agent-skills`](https://github.com/mthines/agent-skills#autonomous-workflow):

**Global** (personal use — works in all projects):

```bash
npx skills add https://github.com/mthines/agent-skills \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
          code-quality holistic-analysis tdd ux update-claude \
          review-changes create-pr ci-auto-fix \
  --agent claude-code \
  --global --yes
bash ~/.claude/skills/autonomous-workflow/install.sh --global
```

**Per-project** (team use — committable to git):

```bash
npx skills add https://github.com/mthines/agent-skills \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
          code-quality holistic-analysis tdd ux update-claude \
          review-changes create-pr ci-auto-fix \
  --agent claude-code \
  --yes
bash .claude/skills/autonomous-workflow/install.sh
```

The `install.sh` script links the planner + executor agent definitions and the auto-routing rule into `.claude/` so Claude Code picks them up. Then just say _"implement X independently"_ and the agent takes over.

📖 **Skill documentation:** https://github.com/mthines/agent-skills#autonomous-workflow

### For Agent SDK Developers

The npm package wraps the skill for programmatic use via the Claude Agent SDK:

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

The system prompt is a lean orchestrator that references the skill at runtime — make sure the [`autonomous-workflow` skill](https://github.com/mthines/agent-skills/tree/main/skills/autonomous-workflow) (and its companions `confidence`, `create-plan`, `create-walkthrough`) is installed in the consuming environment.

📖 **SDK package docs:** [packages/autonomous-workflow-agent/README.md](packages/autonomous-workflow-agent/README.md)
📖 **Skill source:** https://github.com/mthines/agent-skills

---

## 🎓 AI Skills

Skills for the autonomous workflow (and several other coding-assistant skills like `tdd`, `ux`, `code-quality`, `holistic-analysis`, etc.) live in the dedicated [**`mthines/agent-skills`**](https://github.com/mthines/agent-skills) repository:

- [**autonomous-workflow**](https://github.com/mthines/agent-skills#autonomous-workflow) — Autonomous feature development from requirements to PR
- [**create-plan**](https://github.com/mthines/agent-skills/tree/main/skills/create-plan) — Generate structured implementation plan artifacts
- [**create-walkthrough**](https://github.com/mthines/agent-skills/tree/main/skills/create-walkthrough) — Generate PR walkthrough summaries
- [**confidence**](https://github.com/mthines/agent-skills/tree/main/skills/confidence) — Quality gate for plan, code, or bug analysis validation
- [**tdd**, **ux**, **code-quality**, **holistic-analysis**, …](https://github.com/mthines/agent-skills#whats-included) — companion skills used by the autonomous workflow

The two `gw`-specific skills still ship from this repo:

- [**git-worktree-workflows**](skills/git-worktree-workflows/) — Master Git worktrees and `gw` workflows
- [**gw-config-management**](skills/gw-config-management/) — Configure `gw` for your project type (Next.js, monorepos, etc.)

Install the gw-specific skills:

```bash
npx skills add https://github.com/mthines/gw-tools \
  --skill git-worktree-workflows gw-config-management \
  --agent claude-code \
  --yes
```

📖 **Full skill catalog (including the autonomous workflow):** https://github.com/mthines/agent-skills

---

## License

This project is licensed under the [MIT License](LICENSE).

While not required beyond keeping the license file, we appreciate a mention or link back to [gw-tools](https://github.com/mthines/gw-tools) if you find it useful in your own projects.
