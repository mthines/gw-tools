---
title: "Autonomous Workflow Overview"
impact: HIGH
tags:
  - overview
  - workflow
  - phases
---

# Autonomous Workflow Overview

## Overview

Execute complete feature development cycles autonomously—from task intake through tested PR delivery—using isolated Git worktrees.
This workflow operates with high autonomy after initial validation.

## Core Principles

- **Always validate first (Phase 0)**: Never skip directly to implementation.
- **Always create worktree (Phase 2)**: Isolation is mandatory.
- **Iterate until correct**: No artificial iteration limits.
- **Self-validate continuously**: Check work at every step.
- **Stop and ask when blocked**: Don't guess on ambiguity.

## Workflow Phases

| Phase | Name | Autonomy | Description |
|-------|------|----------|-------------|
| 0 | Validation | Interactive | Ask questions, validate understanding |
| 1 | Planning | Autonomous | Analyze codebase, create plan |
| 2 | Worktree Setup | **MANDATORY** | Create isolated worktree with `gw` |
| 3 | Implementation | Autonomous | Code changes in isolated worktree |
| 4 | Testing | Autonomous | Iterate until tests pass |
| 5 | Documentation | Autonomous | Update docs |
| 6 | PR Creation | Autonomous | Create draft PR |
| 7 | Cleanup | Optional | Remove worktree after merge |

## Phase Flow

```
Phase 0: Validation
    ↓ (user confirms)
Phase 1: Planning
    ↓ (plan validated)
Phase 2: Worktree Setup 🔴 MANDATORY
    ↓ (worktree created)
Phase 3: Implementation
    ↓ (code complete)
Phase 4: Testing & Iteration ← iterate until passing
    ↓ (all tests pass)
Phase 5: Documentation
    ↓ (docs complete)
Phase 6: PR Creation
    ↓ (PR delivered)
Phase 7: Cleanup (optional)
```

## When to Use

**Use this skill when:**
- User requests autonomous feature implementation
- Task has clear deliverable (feature, fix, refactor)
- Tests are available to validate correctness
- User wants parallel/isolated development

**Do NOT use when:**
- User wants to code alongside you
- Task is exploratory research
- Project doesn't use Git or gw-tools
- User says "work in current directory"

## Expected Outcomes

**Successful execution produces:**
- Isolated worktree created
- Complete implementation
- All tests passing
- Documentation updated
- Draft PR ready for review

**If unable to complete:**
- Partial implementation committed
- Clear explanation of blockers
- Recommendations for next steps

## References

- Related rule: [phase-0-validation](./phase-0-validation.md)
- Related rule: [phase-2-worktree](./phase-2-worktree.md)
