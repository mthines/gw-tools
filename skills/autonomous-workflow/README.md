# Autonomous Workflow

> Execute complete feature development cycles autonomously using isolated worktrees

## What This Skill Does

This skill enables AI agents to autonomously execute complete feature development workflows from requirements to tested PR delivery. It provides comprehensive procedures for:

- **Phase 0: Validation & Questions** - ALWAYS ask clarifying questions first
- **Phase 1: Task Intake & Planning** - Deep analysis and implementation planning
- **Phase 2: Worktree Setup** - Create isolated environment with validation
- **Phase 3: Implementation** - Code with continuous verification
- **Phase 4: Testing & Iteration** - Aggressive iteration until all tests pass
- **Phase 5: Documentation** - Generate clear, validated documentation
- **Phase 6: PR Creation & Delivery** - Create comprehensive draft PR
- **Phase 7: Cleanup** - Safe worktree removal (optional)

## Installation

### Step 1: Install prerequisites

Install the gw CLI:

```bash
brew install mthines/gw-tools/gw
```

### Step 2: Install the skill + agent

Choose **global** or **per-project**:

**Option A: Global** (personal use — works in all projects)

```bash
npx skills add https://github.com/mthines/gw-tools \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
  --global --yes && \
  mkdir -p ~/.claude/agents && \
  ln -sf ~/.agents/skills/autonomous-workflow/templates/agent.template.md \
     ~/.claude/agents/autonomous-workflow.md
```

Installs all skills to `~/.agents/skills/` and links the agent definition into `~/.claude/agents/` so it's available in every project.

**Option B: Per-project** (team use — committable to git)

```bash
npx skills add https://github.com/mthines/gw-tools \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
  --yes && \
  mkdir -p .claude/agents .claude/rules && \
  ln -sf .agents/skills/autonomous-workflow/templates/agent.template.md \
     .claude/agents/autonomous-workflow.md && \
  ln -sf .agents/skills/autonomous-workflow/templates/routing-rule.template.md \
     .claude/rules/autonomous-workflow-routing.md
```

Installs all skills to `.agents/skills/` in your project and links the agent + routing rule into `.claude/`. All paths are relative, so the setup can be committed and shared with your team.

To customize the agent for a specific project, copy instead of symlink and edit the file.

Say _"implement X independently"_ and the agent takes over.

## Prerequisites

- `gw` CLI tool installed (`npm install -g @gw-tools/gw`)
- Git worktree support (Git 2.5+)
- Testing framework available in project
- GitHub CLI (`gh`) for PR creation

## What's Included

### Main Documentation

- **[SKILL.md](./SKILL.md)** - Complete autonomous workflow procedures

### Companion Skills

- **[confidence](../confidence/SKILL.md)** - Quality gate for plan, code, or bug analysis validation
- **[create-plan](../create-plan/SKILL.md)** - Generates `plan.md` artifact with consistent structure
- **[create-walkthrough](../create-walkthrough/SKILL.md)** - Generates `walkthrough.md` summary for PR delivery

### Templates

- **[routing-rule.template.md](./templates/routing-rule.template.md)** - Auto-trigger rule for Claude Code

### References (Lazy-loaded)

- **[Complete Workflow](./references/autonomous-workflow-complete.md)** - Full end-to-end execution trace
- **[Error Recovery](./references/error-recovery-scenarios.md)** - Common errors and recovery procedures
- **[Iterative Refinement](./references/iterative-refinement.md)** - Progressive improvement examples

## Usage

After installing, trigger autonomous execution with natural language:

```
"Implement dark mode toggle independently"
"Add user authentication feature end-to-end"
"Handle this in isolation — refactor the API client to use retry logic"
```

You can also invoke explicitly: `@autonomous-workflow implement X`

## When to Use This Skill

**Use when:**

- Complete feature implementation from requirements to PR
- Autonomous task execution with minimal human intervention
- Isolated worktree-based development
- Self-validating implementation with continuous iteration

**Do NOT use for:**

- Interactive coding sessions (use conversational mode)
- Exploratory research tasks (use explore agent)

## Workflow Modes

### Full Mode (Complex Changes)

**Use when:** Multi-file features, significant refactors, new capabilities (4+ files)

Creates `.gw/{branch}/` artifacts:

- `plan.md` — Implementation strategy, decisions, progress log (single source of truth)
- `walkthrough.md` — Final summary generated at Phase 6

### Lite Mode (Simple Changes)

**Use when:** Single-file fixes, small enhancements (1-3 files)

No artifact files created. Plan exists only in conversation.

### Decision Guide

| Complexity | Files Changed | Artifacts | Worktree |
| ---------- | ------------- | --------- | -------- |
| Trivial    | 1 file        | No        | Optional |
| Small      | 2-3 files     | No        | Yes      |
| Medium     | 4-10 files    | Yes       | Yes      |
| Large      | 10+ files     | Yes       | Yes      |

## Key Principles

1. **Phase 0 is MANDATORY** - Never skip validation questions
2. **plan.md is the single source of truth** - Must be comprehensive enough for a new session to execute alone
3. **Verify after editing** - Run fast checks after each change, full suite before PR
4. **Iterate until correct** - No artificial iteration limits (Ralph Wiggum pattern)
5. **Stop and ask when blocked** - Don't guess on ambiguity

## Related Skills

- [git-worktree-workflows](../git-worktree-workflows/) - Learn worktree basics first
- [gw-config-management](../gw-config-management/) - Configure gw for your project

## Need Help?

- Check the [references](./references/) for detailed scenarios
- Read [SKILL.md](./SKILL.md) for complete procedures
- Open an issue in the [main repository](https://github.com/mthines/gw-tools/issues)

---

_Part of the [gw-tools skills collection](../)_
