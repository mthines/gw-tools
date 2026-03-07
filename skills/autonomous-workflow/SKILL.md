---
name: autonomous-workflow
description: >
  Autonomous feature development workflow using isolated worktrees.
  Use to autonomously implement features from task description through tested PR delivery.
  Handles worktree creation, implementation, testing, iteration, documentation, and PR creation.
  Triggers on autonomous feature development, end-to-end implementation, or "implement X autonomously."
license: MIT
metadata:
  author: mthines
  version: '2.0.0'
  workflow_type: autonomous
  phases:
    - validation_questions
    - intake_planning
    - worktree_setup
    - implementation
    - testing_iteration
    - documentation
    - pr_creation
    - cleanup
---

# Autonomous Workflow

Execute complete feature development cycles autonomously—from task intake through tested PR delivery—using isolated Git worktrees.

## Rules

| Rule                                                            | Description                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [overview](./rules/overview.md)                                 | **HIGH** - Workflow phases, when to use, expected outcomes                            |
| [smart-worktree-detection](./rules/smart-worktree-detection.md) | **CRITICAL** - Fuzzy match task to current worktree, prompt to continue or create new |
| [phase-0-validation](./rules/phase-0-validation.md)             | **CRITICAL** - MANDATORY - Validate requirements before any work                      |
| [phase-1-planning](./rules/phase-1-planning.md)                 | **HIGH** - Deep codebase analysis and implementation planning                         |
| [phase-2-worktree](./rules/phase-2-worktree.md)                 | **CRITICAL** - MANDATORY - Create isolated worktree with `gw add`                     |
| [phase-3-implementation](./rules/phase-3-implementation.md)     | **HIGH** - Incremental implementation with continuous validation                      |
| [phase-4-testing](./rules/phase-4-testing.md)                   | **CRITICAL** - Fast iteration loop until tests pass (Ralph Wiggum pattern)            |
| [phase-5-documentation](./rules/phase-5-documentation.md)       | **MEDIUM** - Update README, CHANGELOG, API docs                                       |
| [phase-6-pr-creation](./rules/phase-6-pr-creation.md)           | **HIGH** - Create draft PR, deliver results                                           |
| [phase-7-cleanup](./rules/phase-7-cleanup.md)                   | **LOW** - Optional worktree removal after merge                                       |
| [decision-framework](./rules/decision-framework.md)             | **HIGH** - Branch naming, test strategy, iteration decisions                          |
| [error-recovery](./rules/error-recovery.md)                     | **HIGH** - Recovery procedures for common errors                                      |
| [safety-guardrails](./rules/safety-guardrails.md)               | **CRITICAL** - Validation checkpoints, resource limits, rollback                      |
| [parallel-coordination](./rules/parallel-coordination.md)       | **HIGH** - Multi-agent coordination, handoff protocol                                 |
| [artifacts-overview](./rules/artifacts-overview.md)             | **HIGH** - Three-artifact pattern (Task, Plan, Walkthrough), file locations           |
| [task-tracking](./rules/task-tracking.md)                       | **HIGH** - Dynamic task updates throughout workflow                                   |
| [walkthrough-generation](./rules/walkthrough-generation.md)     | **MEDIUM** - Final summary generation at Phase 6                                      |

## Templates

Structured templates for consistent artifact generation:

| Template                                                       | Purpose                |
| -------------------------------------------------------------- | ---------------------- |
| [task.template.md](./templates/task.template.md)               | Dynamic task checklist |
| [plan.template.md](./templates/plan.template.md)               | Implementation plan    |
| [walkthrough.template.md](./templates/walkthrough.template.md) | Final summary          |

## Quick Reference

### Full Mode (4+ files, complex changes)

| Phase             | Command/Action                                                |
| ----------------- | ------------------------------------------------------------- |
| 0. Validation     | Ask clarifying questions, get user confirmation               |
| 1. Planning       | Analyze codebase, create `.gw/{branch}/task.md` and `plan.md` |
| 2. Worktree       | `gw add feat/feature-name`                                    |
| 3. Implementation | Code in worktree, update `task.md` on changes                 |
| 4. Testing        | `npm test`, iterate until all pass, log in `task.md`          |
| 5. Documentation  | Update README, CHANGELOG                                      |
| 6. PR Creation    | Generate `walkthrough.md`, `gh pr create --draft`             |
| 7. Cleanup        | `gw remove feat/feature-name` (after merge)                   |

### Lite Mode (1-3 files, simple changes)

| Phase             | Command/Action                               |
| ----------------- | -------------------------------------------- |
| 0. Validation     | Quick clarification if needed                |
| 1. Planning       | Brief mental plan (no artifact files)        |
| 2. Worktree       | `gw add fix/bug-name` (optional for trivial) |
| 3. Implementation | Code directly, commit when done              |
| 4. Testing        | `npm test`, fix any failures                 |
| 5. PR Creation    | `gh pr create --draft`                       |

## Workflow Modes

| Mode     | Files Changed | Artifacts | Use When                             |
| -------- | ------------- | --------- | ------------------------------------ |
| **Lite** | 1-3 files     | No        | Simple fixes, small enhancements     |
| **Full** | 4+ files      | Yes       | Features, refactors, complex changes |

**Full Mode**: Creates `.gw/{branch}/` artifacts for progress tracking and context recovery.

**Lite Mode**: Faster execution without artifact overhead. Still uses worktree isolation.

## Key Principles

- **Always validate first (Phase 0)**: Never skip directly to implementation.
- **Always create worktree (Phase 2)**: Isolation is mandatory (can skip for trivial fixes).
- **Track progress with artifacts**: Use `.gw/{branch}/` files for complex changes.
- **Smart worktree detection**: Check if current worktree matches task before creating new.
- **Iterate until correct**: No artificial iteration limits (Ralph Wiggum pattern).
- **Fast feedback loops**: Run tests frequently, fix failures immediately.
- **Self-validate continuously**: Check work at every step.
- **Stop and ask when blocked**: Don't guess on ambiguity.

## Artifact System

Inspired by Google Antigravity, this workflow produces three artifacts in `.gw/{branch-name}/`:

| Artifact        | File             | Created | Purpose                                   |
| --------------- | ---------------- | ------- | ----------------------------------------- |
| **Task**        | `task.md`        | Phase 1 | Dynamic checklist, decisions, discoveries |
| **Plan**        | `plan.md`        | Phase 1 | Implementation strategy                   |
| **Walkthrough** | `walkthrough.md` | Phase 6 | Final summary for PR                      |

Files are gitignored and grouped by branch for easy browsing.

## Workflow Flow

```
Phase 0: Validation ← MANDATORY
    ↓ (user confirms)
Phase 1: Planning
    ↓ (plan validated)
Phase 2: Worktree Setup ← MANDATORY (with smart detection)
    ↓ (worktree created)
Phase 3: Implementation
    ↓ (code complete)
Phase 4: Testing ← iterate until passing
    ↓ (all tests pass)
Phase 5: Documentation
    ↓ (docs complete)
Phase 6: PR Creation
    ↓ (draft PR delivered)
Phase 7: Cleanup (optional)
```

## Smart Worktree Detection

Before creating a new worktree, the workflow checks if the current context matches the task:

| Scenario                            | Action                                |
| ----------------------------------- | ------------------------------------- |
| On main/master                      | Always create new worktree            |
| Worktree name matches task keywords | Prompt user to continue or create new |
| No keyword match                    | Create new worktree                   |

## Fast Iteration Loop (Phase 4)

Based on the Ralph Wiggum pattern:

```
while not all_tests_pass:
    1. Run tests
    2. If pass: done
    3. If fail: analyze → fix → commit → continue
    4. Safety: warn at 10 iterations, stop at 20
```

## Related Skills

- [git-worktree-workflows](../git-worktree-workflows/) - Worktree fundamentals
- [gw-config-management](../gw-config-management/) - Configure auto-copy and hooks

## References

Detailed examples and scenarios (loaded on-demand):

- [Complete Workflow Example](./references/autonomous-workflow-complete.md)
- [Error Recovery Scenarios](./references/error-recovery-scenarios.md)
- [Iterative Refinement Example](./references/iterative-refinement.md)

## Research Sources

- [Google Antigravity Artifacts](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/) - Three-artifact pattern
- [Ralph Wiggum AI Coding Loops](https://ralph-wiggum.ai) - Iteration pattern
- [Addy Osmani's LLM Workflow](https://addyosmani.com/blog/ai-coding-workflow/) - Fast feedback loops
- [Claude Code Worktree Support](https://code.claude.com/docs/en/common-workflows) - Best practices
