---
title: 'Autonomous Workflow Overview'
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
- **Track progress with artifacts**: Use `.gw/{branch}/` files for transparency.
- **Iterate until correct**: No artificial iteration limits.
- **Self-validate continuously**: Check work at every step.
- **Stop and ask when blocked**: Don't guess on ambiguity.

## Artifact System

Inspired by Google Antigravity, this workflow produces three artifacts:

| Artifact        | File                          | Purpose                                   |
| --------------- | ----------------------------- | ----------------------------------------- |
| **Task**        | `.gw/{branch}/task.md`        | Dynamic checklist, decisions, discoveries |
| **Plan**        | `.gw/{branch}/plan.md`        | Implementation strategy                   |
| **Walkthrough** | `.gw/{branch}/walkthrough.md` | Final summary for PR                      |

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

## Workflow Modes

### Full Mode (with Artifacts)

Use for complex, multi-file changes:

- Creates `.gw/{branch}/task.md`, `plan.md`, `walkthrough.md`
- Tracks progress, decisions, and discoveries
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
Is this a complex change?
├── Yes (4+ files, multiple decisions) → Full Mode with artifacts
└── No (1-3 files, straightforward)
    ├── Still want worktree isolation? → Lite Mode with worktree
    └── Very simple fix? → Direct implementation (no worktree)
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
