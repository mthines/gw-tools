# @gw-tools/autonomous-workflow-agent

**Ship features while you sleep.** Give this agent a task description and walk away—it handles everything from planning to PR creation, all in an isolated Git worktree that won't touch your working branch.

## Prerequisites

This agent requires:

1. **gw CLI** — Manages Git worktrees
2. **autonomous-workflow skill** — Contains the workflow instructions the agent follows

### 1. Install gw CLI

```bash
# Install (Homebrew on macOS)
brew install mthines/gw-tools/gw

# Or install via npm
npm install -g @gw-tools/gw

# Or install via Linux package manager
yay -S gw-tools
```

Then initialize gw in your project:

```bash
gw init <repo-url>
```

See the [gw Quick Start guide](https://www.npmjs.com/package/@gw-tools/gw#quick-start) for detailed setup instructions.

### 2. Install the autonomous-workflow skill

The agent delegates workflow logic to this skill. Install it globally:

```bash
npx skills add https://github.com/mthines/gw-tools --skill autonomous-workflow --global --yes
```

### 3. (Optional) Enable auto-triggering

So Claude automatically uses the agent when you say "do this independently", "work in isolation", etc.:

```bash
cp ~/.claude/autonomous-workflow/templates/routing-rule.template.md \
   .claude/rules/autonomous-workflow-routing.md
```

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
- **[gw CLI](https://github.com/mthines/gw-tools)** for worktree management (v0.20+)
- **Node.js** project (npm/pnpm/yarn)

## Compatibility

| Dependency      | Minimum Version | Notes                     |
| --------------- | --------------- | ------------------------- |
| Git             | 2.5+            | Worktree support required |
| gw CLI          | 0.20+           | Earlier versions may work |
| Claude Code SDK | 1.x             | Tested with v1.0.x        |
| Node.js         | 18+             | For running the agent     |

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

### Installing gw CLI

This agent uses the `gw` CLI under the hood to manage Git worktrees. The CLI handles:

- Creating isolated worktrees (`gw checkout feat/my-feature`)
- Auto-copying secrets and config files to new worktrees
- Running post-checkout hooks (dependency installation, etc.)
- Navigating between worktrees (`gw cd`)
- Cleaning up merged worktrees (`gw clean`)

### Secret Handling in Worktrees

When the agent creates a new worktree, `gw` automatically copies configured files from your default branch (usually `main`). This ensures secrets and environment files are available without committing them to git.

**Setup (one-time):**

```bash
# Configure which files to auto-copy
gw init --auto-copy-files .env,secrets/,.env.local

# Ensure secrets exist in your main worktree first
cd main
cp .env.example .env
# Edit .env with your actual secrets
```

**How it works:**

1. Secrets are stored in your `main` worktree (the source)
2. When `gw checkout` creates a new worktree, it copies `autoCopyFiles` from `main`
3. Worktree secrets are independent—changes don't affect other worktrees
4. Use `gw sync <worktree>` to update secrets in existing worktrees

**Security notes:**

- `.env` files are never committed (ensure they're in `.gitignore`)
- Each worktree gets its own copy—no shared state
- The agent never reads or logs secret values

📖 **Full details:** [gw-tools secret handling](https://github.com/mthines/gw-tools/tree/main/packages/gw-tool#initial-setup-secrets-in-the-default-branch)

```bash
# Via npm
npm install -g @gw-tools/gw

# Via Homebrew
brew install mthines/tap/gw

# Or download from releases
```

📖 **Full CLI documentation:** [gw-tools README](https://github.com/mthines/gw-tools/tree/main/packages/gw-tool)

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
