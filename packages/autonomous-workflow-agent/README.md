# @gw-tools/autonomous-workflow-agent — ⚠️ DEPRECATED

> # ⚠️ This package is DEPRECATED
>
> **`@gw-tools/autonomous-workflow-agent` is no longer maintained and will not receive future updates.**
>
> It was a thin Claude Agent SDK wrapper around the `autonomous-workflow` skill. The skill now lives directly in [**`mthines/agent-skills`**](https://github.com/mthines/agent-skills#autonomous-workflow) and ships with companion agents (`autonomous-planner`, `autonomous-executor`) plus an `install.sh` that wires everything into Claude Code automatically — no SDK boilerplate required.
>
> ## Migrate now
>
> ```bash
> # 1. Uninstall this package (if you have it as a dependency)
> npm uninstall @gw-tools/autonomous-workflow-agent
>
> # 2. Install the skill + companions directly from mthines/agent-skills
> npx skills add https://github.com/mthines/agent-skills \
>   --skill autonomous-workflow create-plan create-walkthrough confidence \
>           code-quality holistic-analysis tdd ux update-claude \
>           review-changes create-pr ci-auto-fix \
>   --agent claude-code \
>   --yes
> bash .claude/skills/autonomous-workflow/install.sh
> ```
>
> Invocation is unchanged (`@autonomous-workflow implement X`, or routing phrases like _"implement X independently"_). The functionality is identical — only the distribution channel changed.
>
> **Why deprecated?** The skill no longer depends on the `gw` CLI (falls back to native `git worktree`), so co-locating the workflow with its companions in [`mthines/agent-skills`](https://github.com/mthines/agent-skills) makes the source of truth easier to maintain and discover. See <https://github.com/mthines/agent-skills#autonomous-workflow> for full docs.
>
> 📊 **Visualize artifacts in VS Code:** Install the [Agent Tasks extension](https://marketplace.visualstudio.com/items?itemName=mthines.agent-tasks).
>
> ---
>
> The documentation below is **kept for historical reference only**. Do not follow these install steps — use the migration command above instead.

---

## ⚠️ Legacy Documentation (deprecated)

> Everything below this line documents the deprecated package as it existed prior to deprecation. Refer to it only if you maintain a codebase that still imports `@gw-tools/autonomous-workflow-agent` and need context on the old behavior.

**Ship features while you sleep.** Give this agent a task description and walk away — it handles everything from planning to PR creation, all in an isolated Git worktree that won't touch your working branch.

> The **skill itself** lives at [**`mthines/agent-skills` → autonomous-workflow**](https://github.com/mthines/agent-skills#autonomous-workflow). This npm package is a thin Claude Agent SDK wrapper that loads that skill at runtime.

## Quick Start (Claude Code)

### Step 1: Install prerequisites

`gh` is required (PR creation). `gw` is optional but recommended for nicer worktree management — the workflow falls back to native `git worktree` if `gw` is absent.

```bash
brew install gh
brew install mthines/gw-tools/gw   # optional but recommended
```

### Step 2: Install the skill + companion agents

Install from [`mthines/agent-skills`](https://github.com/mthines/agent-skills#autonomous-workflow):

**Option A: Global** (recommended for personal use — works in all projects)

```bash
npx skills add https://github.com/mthines/agent-skills \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
          code-quality holistic-analysis tdd ux update-claude \
          review-changes create-pr ci-auto-fix \
  --agent claude-code \
  --global --yes
bash ~/.claude/skills/autonomous-workflow/install.sh --global
```

**Option B: Per-project** (recommended for teams — committable to git)

```bash
npx skills add https://github.com/mthines/agent-skills \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
          code-quality holistic-analysis tdd ux update-claude \
          review-changes create-pr ci-auto-fix \
  --agent claude-code \
  --yes
bash .claude/skills/autonomous-workflow/install.sh
```

The `install.sh` script links the planner + executor agent definitions and the auto-routing rule into `.claude/` so Claude Code picks them up.

If you're using `gw` for worktrees, run `gw init` once in the project to enable auto-copy of secrets, pre/post-checkout hooks, and shell-integrated `gw cd`.

### How to use it

Just tell Claude what to build:

```
"Implement dark mode toggle independently"
"Add user auth end-to-end with tests and PR"
"Handle this in isolation — refactor the API client to use retry logic"
```

The agent will ask clarifying questions, plan the implementation, create an isolated worktree, implement, test, and deliver a draft PR.

**What triggers the agent automatically:** _"independently"_, _"autonomously"_, _"in isolation"_, _"alone"_, _"on your own"_, _"end-to-end"_, _"handle this without me"_

**Explicit invocation** (works without the routing rule): `@autonomous-workflow implement X`

## For Agent SDK Developers

Building custom agents? Install via npm:

```bash
npm install @gw-tools/autonomous-workflow-agent
```

```typescript
import { autonomousWorkflowAgent } from '@gw-tools/autonomous-workflow-agent';

// Your agent now knows how to ship complete features autonomously.
```

---

## Built on gw-tools

This agent is powered by the [gw CLI](https://github.com/mthines/gw-tools)—a Git worktree management tool that handles branch isolation, file syncing, and cleanup. The agent orchestrates `gw` commands to create isolated development environments for each task.

## The Problem

Building features with AI agents today is frustrating:

- **Context loss** — Agents forget what they're doing mid-task
- **No isolation** — Changes happen in your working directory, blocking your flow
- **Incomplete work** — You get code dumps, not tested PRs
- **Manual babysitting** — You're constantly re-prompting and fixing mistakes

## The Solution

This agent implements a battle-tested 8-phase workflow that turns "implement X" into a ready-to-review PR:

1. **Validates** the task with you before writing any code
2. **Plans** the implementation by analyzing your actual codebase
3. **Isolates** work in a Git worktree (your main branch stays clean)
4. **Implements** incrementally with logical commits
5. **Tests** and iterates until everything passes
6. **Documents** changes appropriately
7. **Creates** a draft PR with full context
8. **Cleans up** the worktree after merge

The agent maintains a comprehensive plan file for context recovery, recovers from errors, and knows when to stop and ask for help instead of guessing.

## Installation

```bash
npm install @gw-tools/autonomous-workflow-agent
```

## Quick Start

### With Claude Code SDK

```typescript
import { autonomousWorkflowAgent } from '@gw-tools/autonomous-workflow-agent';
import { query } from '@anthropic-ai/claude-code-sdk';

for await (const message of query({
  prompt: 'Add user authentication with JWT tokens',
  options: {
    agents: {
      'autonomous-workflow': autonomousWorkflowAgent,
    },
  },
})) {
  console.log(message);
}
```

### Custom Agent Configuration

```typescript
import { autonomousWorkflowAgent } from '@gw-tools/autonomous-workflow-agent';

// Override defaults for your use case
const myAgent = {
  ...autonomousWorkflowAgent,
  model: 'opus', // Use Opus for complex tasks
  maxTurns: 150, // Allow more iterations
};
```

### Access the System Prompt Directly

```typescript
import { systemPrompt } from '@gw-tools/autonomous-workflow-agent';

// Use in your own agent framework
console.log(systemPrompt.length); // ~8KB lean orchestrator prompt
```

## How It Works

### Workflow Modes

The agent automatically detects the right workflow mode:

| Mode     | When                               | Artifacts                   |
| -------- | ---------------------------------- | --------------------------- |
| **Full** | 4+ files OR architectural changes  | `plan.md`, `walkthrough.md` |
| **Lite** | 1-3 files, straightforward changes | Mental plan only            |

### The 8 Phases

| Phase | Name           | What Happens                                                             |
| ----- | -------------- | ------------------------------------------------------------------------ |
| **0** | Validation     | Asks clarifying questions, confirms understanding, detects workflow mode |
| **1** | Planning       | Deep codebase analysis, creates implementation plan                      |
| **2** | Worktree Setup | Creates isolated Git worktree via `gw add`                               |
| **3** | Implementation | Writes code incrementally, commits logically                             |
| **4** | Testing        | Runs tests, iterates until green (no artificial limits)                  |
| **5** | Documentation  | Updates README, CHANGELOG, API docs as needed                            |
| **6** | PR Creation    | Pushes branch, creates draft PR with full context                        |
| **7** | Cleanup        | Removes worktree after PR is merged                                      |

### Safety Guardrails

The agent includes built-in safety mechanisms:

- **Soft limits**: ~10 commits, ~20 files (warns but continues if justified)
- **Hard limits**: 50+ files, 20+ test iterations (stops and asks)
- **Quality gates**: Can't skip phases, must pass validation checkpoints
- **Rollback ready**: Documented procedures for recovery

## Agent Definition

The exported agent conforms to the `AgentDefinition` interface:

```typescript
interface AgentDefinition {
  description: string;
  prompt: string;
  tools: ToolName[];
  model?: 'sonnet' | 'opus' | 'haiku';
  maxTurns?: number;
}

type ToolName = 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'WebSearch' | 'Skill';
```

### Default Configuration

| Property | Value                                                    |
| -------- | -------------------------------------------------------- |
| `model`  | `sonnet`                                                 |
| `tools`  | `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `Skill` |

## Requirements

- **Git** with worktree support (Git 2.5+)
- **`gh` CLI** for PR creation and CI watching
- **[`autonomous-workflow` skill](https://github.com/mthines/agent-skills#autonomous-workflow)** installed (this package's system prompt loads it at runtime)
- **[`gw` CLI](https://github.com/mthines/gw-tools)** — _recommended, optional_ — for worktree management with auto-copy + hooks (v0.20+). Falls back to native `git worktree` if absent.
- **Node.js** project (npm/pnpm/yarn)

## Compatibility

| Dependency                  | Minimum Version | Notes                                                                  |
| --------------------------- | --------------- | ---------------------------------------------------------------------- |
| Git                         | 2.5+            | Worktree support required                                              |
| `gh`                        | recent          | Required for PR + CI                                                   |
| `autonomous-workflow` skill | latest          | From [`mthines/agent-skills`](https://github.com/mthines/agent-skills) |
| `gw` CLI                    | 0.20+           | Optional; native `git worktree` fallback                               |
| Claude Code SDK             | 1.x             | Tested with v1.0.x                                                     |
| Node.js                     | 18+             | For running the agent                                                  |

## Performance Characteristics

Realistic expectations for agent behavior:

| Metric              | Typical Range | Notes                              |
| ------------------- | ------------- | ---------------------------------- |
| Agent turns         | 15-80         | Depends on task complexity         |
| Files changed       | 3-20          | Soft limit at 20, hard limit at 50 |
| Test iterations     | 2-8           | Escalates to user at 7+            |
| Commits per feature | 3-10          | Logical, incremental commits       |
| Success rate (Lite) | ~90%          | Simple fixes, 1-3 files            |
| Success rate (Full) | ~75%          | Complex features, 4+ files         |

**Note:** These are estimates based on typical usage. Actual performance varies by codebase complexity, test suite speed, and task clarity.

## Model Selection

The agent defaults to **Sonnet** which handles ~80% of tasks effectively. Consider **Opus** for:

| Use Opus When                                      | Stick with Sonnet When            |
| -------------------------------------------------- | --------------------------------- |
| Architectural changes (new patterns, abstractions) | Bug fixes and small features      |
| Complex multi-system integrations                  | Single-system changes             |
| Ambiguous requirements needing inference           | Clear, well-defined requirements  |
| Large refactoring (10+ files)                      | Focused changes (1-5 files)       |
| Novel problem domains                              | Familiar patterns in the codebase |

```typescript
// Override model for complex tasks
const myAgent = {
  ...autonomousWorkflowAgent,
  model: 'opus',
};
```

### Secret Handling in Worktrees

When the agent creates a new worktree, `gw` automatically copies configured files (`.env`, secrets) from your default branch. Setup:

```bash
gw init --auto-copy-files .env,secrets/,.env.local
```

📖 **Full details:** [gw-tools secret handling](https://github.com/mthines/gw-tools/tree/main/packages/gw-tool#initial-setup-secrets-in-the-default-branch)

## Examples

### Feature Implementation

```typescript
await query({
  prompt: 'Implement a caching layer for the API client with TTL support',
  options: { agents: { 'autonomous-workflow': autonomousWorkflowAgent } },
});
```

The agent will:

1. Ask about cache invalidation strategy, TTL defaults, storage backend
2. Analyze existing API client code
3. Create `feat/api-caching` worktree
4. Implement caching with tests
5. Create PR with implementation walkthrough

### Bug Fix

```typescript
await query({
  prompt: 'Fix the race condition in the WebSocket reconnection logic',
  options: { agents: { 'autonomous-workflow': autonomousWorkflowAgent } },
});
```

### Refactoring

```typescript
await query({
  prompt: 'Refactor the auth module to use dependency injection',
  options: { agents: { 'autonomous-workflow': autonomousWorkflowAgent } },
});
```

## Why Git Worktrees?

Traditional AI coding assistants modify your working directory directly. This means:

- You can't work on other things while the agent runs
- Failed attempts leave your repo in a dirty state
- You have to manually create branches and PRs

With worktrees, the agent works in a completely separate directory. Your main checkout stays clean, and you can review the agent's work when it's ready.

## Observability

### Watching Agent Progress

For Full Mode tasks, the agent maintains artifacts you can monitor:

```bash
# Check the implementation plan and progress
cat .gw/<branch>/plan.md

# After completion, review the walkthrough
cat .gw/<branch>/walkthrough.md
```

### Claude Code Hooks (Optional)

Get notifications when the agent completes significant actions:

```json
// ~/.claude/settings.json
{
  "hooks": {
    "postToolUse": {
      "Bash": "echo \"gw action completed\" | tee -a /tmp/agent.log"
    }
  }
}
```

**Platform-specific notifications:**

```bash
# macOS
osascript -e 'display notification "Agent completed action" with title "gw"'

# Linux (requires libnotify)
notify-send "gw" "Agent completed action"
```

## Troubleshooting

### "gw: command not found"

Install the gw CLI: `npm install -g @gw-tools/gw`

### Agent creates too many worktrees

The agent includes "smart detection" to reuse existing worktrees. If you're seeing sprawl, ensure you're cleaning up merged PRs with `gw remove <branch>`.

### Tests keep failing

The agent will iterate up to 20 times on test failures. If it's still stuck, it will stop and ask for help. Check the Progress Log in `.gw/<branch>/plan.md` for iteration history.

### Agent issued an invalid gw command

If the agent hallucinates a `gw` command that doesn't exist:

1. Check `.gw/<branch>/plan.md` for what the agent was trying to do
2. Look at the error message for the actual command attempted
3. Manually run the correct command or guide the agent

Common hallucinations:

- `gw create` → should be `gw checkout` or `gw add`
- `gw switch` → should be `gw cd`
- `gw delete` → should be `gw remove`

### Agent stuck in a loop

If the agent keeps trying the same fix repeatedly:

1. Check `.gw/<branch>/plan.md` Progress Log for iteration history
2. Look for repeated "Attempt N" entries with similar fixes
3. Interrupt and provide guidance: "Try a different approach—the issue is X"

The agent has built-in loop detection and will ask for help after 7+ similar attempts, but you can intervene earlier.

### Agent created wrong worktree name

The agent uses smart worktree detection. If it created a worktree with an unexpected name:

```bash
# List all worktrees
gw list

# Navigate to the correct one
gw cd <branch-name>

# Or remove and recreate
gw remove <wrong-branch>
```

### Secrets missing in new worktree

If `.env` or other secrets weren't copied:

1. Verify `autoCopyFiles` is configured: `cat .gw/config.json`
2. Ensure secrets exist in your `main` worktree
3. Manually sync: `gw sync <worktree> .env`

## Related

- **[gw-tools](https://github.com/mthines/gw-tools)** — Git worktree workflow CLI
- **[Skill Documentation](https://github.com/mthines/gw-tools/tree/main/skills/autonomous-workflow)** — Full skill with all rules and templates
- **[Claude Code SDK](https://github.com/anthropics/claude-code-sdk)** — Official SDK for building Claude agents

## Community & Support

- **Issues & Feature Requests:** [github.com/mthines/gw-tools/issues](https://github.com/mthines/gw-tools/issues)
- **Questions & Discussions:** Open an issue with the `question` label
- **Share your experience:** We'd love to hear how you're using the agent—open an issue with the `show-and-tell` label

## Contributing

Issues and PRs welcome at [github.com/mthines/gw-tools](https://github.com/mthines/gw-tools).

## License

MIT
