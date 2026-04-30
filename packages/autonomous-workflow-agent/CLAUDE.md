# @gw-tools/autonomous-workflow-agent — DEPRECATED

> **This package is deprecated.** The skill it wraps now lives in [`mthines/agent-skills`](https://github.com/mthines/agent-skills#autonomous-workflow) and ships with companion agents + an `install.sh`. New users should install the skill there directly. Do not add new features here.

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
    ├── system-prompt.ts              # ~250 line system prompt (lean orchestrator)
    └── *.spec.ts                     # Tests
```

## Key Concepts

- **AgentDefinition** - Interface matching Claude Agent SDK's expected shape
- **systemPrompt** - Lean prompt that loads the full skill at runtime via `Skill(skill: "autonomous-workflow")`
- The system prompt is an **orchestrator**, not a duplicate of the skill content

## Gotchas

- Package uses ES modules (`"type": "module"`) - use `.js` extensions in imports
- `systemPrompt` is ~8KB — it references the skill for detailed procedures, not duplicates them
- The system prompt references the `autonomous-workflow` skill which must be installed
- Companion skills (`confidence`, `create-plan`, `create-walkthrough`) must also be installed — the workflow invokes them via `Skill()`

## Coupled Documentation

This package and `skills/autonomous-workflow/` describe the **same workflow** and must stay in sync:

1. Update the skill files first: `skills/autonomous-workflow/SKILL.md`, `rules/*.md`, `README.md`
2. Update companion skills if artifact format changes: `skills/create-plan/`, `skills/create-walkthrough/`, `skills/confidence/`
3. Then update `src/lib/system-prompt.ts` — keep it lean, reference skill for details
4. Verify the skill, companion skills, and system prompt do not contradict each other

The skill is the **source of truth**. Companion skills handle artifact generation. The system prompt is a lean orchestrator.

## Related

@../../skills/autonomous-workflow/SKILL.md
@../../skills/create-plan/SKILL.md
@../../skills/create-walkthrough/SKILL.md
@../../skills/confidence/SKILL.md
