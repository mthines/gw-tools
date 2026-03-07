# @gw-tools/autonomous-workflow-agent

**Ship features while you sleep.** Give this agent a task description and walk away—it handles everything from planning to PR creation, all in an isolated Git worktree that won't touch your working branch.

## Quick Install for Claude Code

```bash
# One-liner (global - works in all projects)
curl -fsSL https://raw.githubusercontent.com/mthines/gw-tools/main/packages/autonomous-workflow-agent/agents/autonomous-workflow.md \
  -o ~/.claude/agents/autonomous-workflow.md
```

Or manually copy [`agents/autonomous-workflow.md`](./agents/autonomous-workflow.md) to:
- `~/.claude/agents/` — Available in all your projects
- `.claude/agents/` — Available only in that project (commit to git for team sharing)

That's it. Claude Code will now automatically delegate feature implementation tasks to this agent.

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

The agent tracks its own progress, recovers from errors, and knows when to stop and ask for help instead of guessing.

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
console.log(systemPrompt.length); // ~16KB of battle-tested instructions
```

## How It Works

### Workflow Modes

The agent automatically detects the right workflow mode:

| Mode     | When                               | Artifacts                              |
| -------- | ---------------------------------- | -------------------------------------- |
| **Full** | 4+ files OR architectural changes  | `task.md`, `plan.md`, `walkthrough.md` |
| **Lite** | 1-3 files, straightforward changes | Mental plan only                       |

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

type ToolName = 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'WebSearch' | 'Task' | 'Skill';
```

### Default Configuration

| Property | Value                                                    |
| -------- | -------------------------------------------------------- |
| `model`  | `sonnet`                                                 |
| `tools`  | `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `Skill` |

## Requirements

- **Git** with worktree support (Git 2.5+)
- **[gw CLI](https://github.com/mthines/gw-tools)** for worktree management
- **Node.js** project (npm/pnpm/yarn)

### Installing gw CLI

This agent uses the `gw` CLI under the hood to manage Git worktrees. The CLI handles:

- Creating isolated worktrees (`gw checkout feat/my-feature`)
- Auto-copying secrets and config files to new worktrees
- Running post-checkout hooks (dependency installation, etc.)
- Navigating between worktrees (`gw cd`)
- Cleaning up merged worktrees (`gw clean`)

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

## Troubleshooting

### "gw: command not found"

Install the gw CLI: `npm install -g @gw-tools/gw`

### Agent creates too many worktrees

The agent includes "smart detection" to reuse existing worktrees. If you're seeing sprawl, ensure you're cleaning up merged PRs with `gw remove <branch>`.

### Tests keep failing

The agent will iterate up to 20 times on test failures. If it's still stuck, it will stop and ask for help. Check the `task.md` file in `.gw/<branch>/` for iteration history.

## Related

- **[gw-tools](https://github.com/mthines/gw-tools)** — Git worktree workflow CLI
- **[Skill Documentation](https://github.com/mthines/gw-tools/tree/main/skills/autonomous-workflow)** — Full 26-file skill with all rules and templates
- **[Claude Code SDK](https://github.com/anthropics/claude-code-sdk)** — Official SDK for building Claude agents

## Contributing

Issues and PRs welcome at [github.com/mthines/gw-tools](https://github.com/mthines/gw-tools).

## License

MIT
