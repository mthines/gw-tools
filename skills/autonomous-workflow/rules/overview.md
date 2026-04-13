---
title: 'Autonomous Workflow Overview'
impact: HIGH
tags:
  - overview
  - workflow
  - phases
---

# Autonomous Workflow Overview

---

## CRITICAL: First Step - Mode Detection

**Before starting ANY phase, you MUST determine the workflow mode:**

| Mode     | Criteria                             | Artifacts Required  |
| -------- | ------------------------------------ | ------------------- |
| **Full** | 4+ files OR complex/architectural    | **YES - MANDATORY** |
| **Lite** | 1-3 files AND simple/straightforward | No                  |

**For Full Mode:** Plan artifact content during Phase 1, then create `.gw/{branch-name}/plan.md` inside the worktree AFTER Phase 2 setup. **Never create artifact files on the main branch.**

**State your mode selection explicitly before proceeding.**

---

## Overview

Execute complete feature development cycles autonomously — from task intake through tested PR delivery — using isolated Git worktrees.
This workflow operates with high autonomy after initial validation.

## Core Principles

- **Always validate first (Phase 0)**: Never skip directly to implementation.
- **Always create worktree (Phase 2)**: Isolation is mandatory.
- **plan.md is the single source of truth**: A new session must be able to execute from it alone.
- **Iterate until correct**: No artificial iteration limits.
- **Self-validate continuously**: Check work at every step.
- **Stop and ask when blocked**: Don't guess on ambiguity.

## Artifact System

The workflow produces two artifacts:

| Artifact        | File                          | Purpose                                        |
| --------------- | ----------------------------- | ---------------------------------------------- |
| **Plan**        | `.gw/{branch}/plan.md`        | Implementation strategy, progress log, context |
| **Walkthrough** | `.gw/{branch}/walkthrough.md` | Final summary for PR delivery                  |

See [artifacts-overview](./artifacts-overview.md) for full details.

## Workflow Phases

| Phase | Name           | Autonomy      | Description                           |
| ----- | -------------- | ------------- | ------------------------------------- |
| 0     | Validation     | Interactive   | Ask questions, validate understanding |
| 1     | Planning       | Autonomous    | Analyze codebase, create plan         |
| 2     | Worktree Setup | **MANDATORY** | Create isolated worktree with `gw`    |
| 3     | Implementation | Autonomous    | Code changes in isolated worktree     |
| 4     | Testing        | Autonomous    | Iterate until tests pass              |
| 5     | Documentation  | Autonomous    | Update docs                           |
| 6     | PR Creation    | Autonomous    | Create draft PR                       |
| 7     | Cleanup        | Optional      | Remove worktree after merge           |

## Phase Flow

```
Phase 0: Validation + Mode Detection
    | (user confirms, mode selected)
Phase 1: Planning (Full: prepare plan in conversation, Lite: mental plan)
    | (plan validated)
Phase 2: Worktree Setup - MANDATORY
    | Full Mode: CREATE & POPULATE plan.md INSIDE worktree
    | (worktree created, plan.md populated)
Phase 3: Implementation (Full: update Progress Log, Lite: just code)
    | Verify after editing. Verify periodically. Fix failures immediately.
    | (code complete)
Phase 4: Testing & Iteration <- iterate until passing
    | (all tests pass)
Phase 5: Documentation
    | (docs complete)
Phase 6: PR Creation (Full: generate walkthrough.md)
    | (PR delivered)
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

## Workflow Modes

### Full Mode (with Artifacts)

Use for complex, multi-file changes:

- Creates `.gw/{branch}/plan.md` and `walkthrough.md`
- Tracks progress via plan.md Progress Log
- Enables context recovery and handoff
- Generates comprehensive PR summary

**Triggers:**

- 4+ files changed
- Multiple decisions required
- Long session expected
- Handoff to another agent possible

### Lite Mode (without Artifacts)

Use for simple, focused changes:

- No artifact files created
- Plan exists only in conversation
- Faster execution

**Triggers:**

- 1-3 files changed
- Straightforward implementation
- Single session completion
- No complex decisions

### Decision Flow

```
DECIDE MODE FIRST (before any work):

Is this a complex change? (4+ files OR architectural)
|-- Yes -> Full Mode
|   |-- Plan artifacts in Phase 1 (in conversation)
|   |-- Create plan.md INSIDE worktree (after Phase 2)
|-- No (1-3 files, straightforward)
    |-- Lite Mode (no artifacts, still use worktree)
```

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
- Related rule: [artifacts-overview](./artifacts-overview.md)
- Research: [Antigravity Artifacts](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
