---
title: 'Parallel Agent Coordination'
impact: HIGH
tags:
  - parallel
  - multi-agent
  - coordination
  - handoff
---

# Parallel Agent Coordination

## Overview

Patterns for coordinating multiple autonomous agents working simultaneously.
Ensures agents don't conflict and can hand off work cleanly.

## Core Principles

- **Unique worktree names**: Prevent conflicts between agents.
- **Never share branches**: Each agent works on its own branch.
- **Document state for handoff**: Clear notes when handing off.
- **Check before creating**: Always run `gw list` first.

## Worktree Naming Convention

When multiple agents may run in parallel:

### Include Unique Identifier

**Pattern:** `<type>/<name>-<identifier>`

**Options:**

- Timestamp: `feat/auth-20240315-143022`
- Agent ID: `feat/auth-agent-abc123`
- Session ID: `feat/auth-session-xyz`

**Examples:**

```bash
# With timestamp
gw add feat/dark-mode-$(date +%Y%m%d-%H%M%S)

# With agent identifier
gw add feat/dark-mode-agent-${AGENT_ID}
```

## Avoiding Conflicts

### Before Creating Worktree

```bash
# Always check existing worktrees
gw list

# Check for similar branches
git branch --list "*dark-mode*"
```

### Rules

1. Never work on same branch as another worktree
2. Use descriptive names to avoid confusion
3. Check `gw list` before every `gw add`

## Handoff Protocol

When handing off work to another agent:

### Step 1: Commit All Changes

```bash
git add .
git commit -m "WIP: [current state description]"
```

### Step 2: Document State

Create `HANDOFF.md` in worktree:

```markdown
# Handoff Notes

## Current State

- Phase: [current phase]
- Last completed: [what's done]
- Next step: [what's next]

## Outstanding Issues

- [Issue 1]
- [Issue 2]

## Important Context

- [Key decision made]
- [Edge case discovered]

## Commands to Resume

\`\`\`bash
cd $(gw path <branch-name>)
npm install
npm test
\`\`\`
```

### Step 3: Push Branch

```bash
git push -u origin <branch-name>
```

### Step 4: Provide Handoff Info

Share with next agent:

- Worktree path: `/path/to/worktree`
- Branch name: `feat/feature-name`
- PR (if created): `https://github.com/...`
- Handoff notes: Read `HANDOFF.md`

## Receiving Handoff

### Step 1: Navigate to Worktree

```bash
gw cd <branch-name>
```

### Step 2: Read Handoff Notes

```bash
cat HANDOFF.md
```

### Step 3: Verify State

```bash
git status
npm test
```

### Step 4: Continue Work

Resume from documented state.

## Parallel Execution Patterns

### Independent Features

Multiple agents working on unrelated features:

```
Agent A: feat/dark-mode-agent-a
Agent B: feat/user-profile-agent-b
Agent C: fix/login-error-agent-c
```

No coordination needed—completely independent.

### Related Features

Multiple agents working on related features:

```
Agent A: feat/auth-base-agent-a     (foundation)
Agent B: feat/auth-oauth-agent-b    (depends on A)
```

**Coordination:**

1. Agent B waits for Agent A to complete
2. Agent B creates branch from Agent A's branch:
   ```bash
   gw add feat/auth-oauth --from feat/auth-base
   ```

### Split Task

Single task split across agents:

```
Agent A: feat/dashboard-charts
Agent B: feat/dashboard-filters
```

**Coordination:**

1. Both start from same base (main)
2. Merge both PRs to main
3. Or: One agent integrates both at the end

## Conflict Resolution

If conflict detected:

```bash
# Check who owns the worktree
gw list

# If another agent's worktree:
# - Use different branch name
# - Coordinate with that agent

# If orphaned worktree:
gw remove <conflicting-worktree>
```

## References

- Related rule: [phase-2-worktree](./phase-2-worktree.md)
- Related rule: [smart-worktree-detection](./smart-worktree-detection.md)
- Research: [Claude Code Worktree Support](https://code.claude.com/docs/en/common-workflows)
