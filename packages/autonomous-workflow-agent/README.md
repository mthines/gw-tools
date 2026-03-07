# @gw-tools/autonomous-workflow-agent

Autonomous workflow agent for Claude Agent SDK. Executes complete feature development cycles—from task intake through tested PR delivery—using isolated Git worktrees.

## Installation

```bash
npm install @gw-tools/autonomous-workflow-agent
```

## Usage

### With Claude Agent SDK

```typescript
import { autonomousWorkflowAgent } from '@gw-tools/autonomous-workflow-agent';
import { query } from '@anthropic-ai/claude-code-sdk';

for await (const message of query({
  prompt: 'Implement user authentication feature',
  options: {
    agents: {
      'autonomous-workflow': autonomousWorkflowAgent,
    },
  },
})) {
  console.log(message);
}
```

### Access System Prompt Directly

```typescript
import { systemPrompt } from '@gw-tools/autonomous-workflow-agent';

// Use the system prompt in your own agent configuration
console.log(systemPrompt);
```

### Default Export

```typescript
import autonomousWorkflowAgent from '@gw-tools/autonomous-workflow-agent';

// Same as named export
```

## Agent Definition

The exported `autonomousWorkflowAgent` conforms to the `AgentDefinition` interface:

```typescript
interface AgentDefinition {
  description: string;
  prompt: string;
  tools: ToolName[];
  model?: 'sonnet' | 'opus' | 'haiku';
  maxTurns?: number;
}
```

### Configuration

| Property      | Value                                                            |
| ------------- | ---------------------------------------------------------------- |
| `description` | Autonomous feature development workflow using isolated worktrees |
| `tools`       | `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `Skill`         |
| `model`       | `sonnet`                                                         |

## Workflow Phases

The agent follows an 8-phase workflow:

| Phase | Name           | Description                           |
| ----- | -------------- | ------------------------------------- |
| 0     | Validation     | Ask questions, validate understanding |
| 1     | Planning       | Analyze codebase, create plan         |
| 2     | Worktree Setup | Create isolated worktree with `gw`    |
| 3     | Implementation | Code changes in isolated worktree     |
| 4     | Testing        | Iterate until tests pass              |
| 5     | Documentation  | Update docs                           |
| 6     | PR Creation    | Create draft PR                       |
| 7     | Cleanup        | Remove worktree after merge           |

## Requirements

- Git repository with worktree support
- [gw-tools](https://github.com/mthines/gw-tools) CLI installed
- Node.js project with npm/pnpm/yarn

## Building

Run `nx build autonomous-workflow-agent` to build the library.

## Running unit tests

Run `nx test autonomous-workflow-agent` to execute the unit tests via [Vitest](https://vitest.dev/).

## Related

- [gw-tools](https://github.com/mthines/gw-tools) - Git worktree workflow CLI
- [autonomous-workflow skill](https://github.com/mthines/gw-tools/tree/main/skills/autonomous-workflow) - Full skill documentation

## License

MIT
