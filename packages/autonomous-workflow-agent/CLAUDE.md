# @gw-tools/autonomous-workflow-agent

Claude Agent SDK package for autonomous feature development using Git worktrees.

## Commands

```bash
# Build
nx build autonomous-workflow-agent

# Test
nx test autonomous-workflow-agent

# Lint
nx lint autonomous-workflow-agent

# Release (dry run)
nx run autonomous-workflow-agent:release:dry-run
```

## Architecture

```
src/
├── index.ts                          # Public exports
└── lib/
    ├── autonomous-workflow-agent.ts  # Agent definition and types
    ├── system-prompt.ts              # ~400 line system prompt
    └── *.spec.ts                     # Tests
agents/
└── autonomous-workflow.md            # Claude Code agent file (copied to dist)
```

## Key Concepts

- **AgentDefinition** - Interface matching Claude Agent SDK's expected shape
- **systemPrompt** - The large prompt string exported for custom agent builds
- **agents/\*.md** - Markdown files Claude Code loads as subagents

## Gotchas

- The `agents/` directory is copied to `dist/` via project.json assets config
- Package uses ES modules (`"type": "module"`) - use `.js` extensions in imports
- `systemPrompt` is ~20KB - changes affect agent behavior significantly
- The system prompt references the `autonomous-workflow` skill which must be installed

## ⚠️ Coupled Documentation

This package and `skills/autonomous-workflow/` describe the **same workflow** and must stay in sync. When changing workflow behavior (phase ordering, artifact timing, worktree setup, etc.):

1. Update the skill files first: `skills/autonomous-workflow/SKILL.md`, `rules/*.md`, `references/*.md`, `README.md`
2. Then update the system prompt here: `src/lib/system-prompt.ts`
3. Verify the two do not contradict each other

The skill is the **source of truth** — the system prompt should mirror it.

## Related

@../../skills/autonomous-workflow/SKILL.md
