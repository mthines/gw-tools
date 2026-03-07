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

| Rule | Description |
|------|-------------|
| [overview](./rules/overview.md) | **HIGH** - Workflow phases, when to use, expected outcomes |
| [smart-worktree-detection](./rules/smart-worktree-detection.md) | **CRITICAL** - Fuzzy match task to current worktree, prompt to continue or create new |
| [phase-0-validation](./rules/phase-0-validation.md) | **CRITICAL** - MANDATORY - Validate requirements before any work |
| [phase-1-planning](./rules/phase-1-planning.md) | **HIGH** - Deep codebase analysis and implementation planning |
| [phase-2-worktree](./rules/phase-2-worktree.md) | **CRITICAL** - MANDATORY - Create isolated worktree with `gw add` |
| [phase-3-implementation](./rules/phase-3-implementation.md) | **HIGH** - Incremental implementation with continuous validation |
| [phase-4-testing](./rules/phase-4-testing.md) | **CRITICAL** - Fast iteration loop until tests pass (Ralph Wiggum pattern) |
| [phase-5-documentation](./rules/phase-5-documentation.md) | **MEDIUM** - Update README, CHANGELOG, API docs |
| [phase-6-pr-creation](./rules/phase-6-pr-creation.md) | **HIGH** - Create draft PR, deliver results |
| [phase-7-cleanup](./rules/phase-7-cleanup.md) | **LOW** - Optional worktree removal after merge |
| [decision-framework](./rules/decision-framework.md) | **HIGH** - Branch naming, test strategy, iteration decisions |
| [error-recovery](./rules/error-recovery.md) | **HIGH** - Recovery procedures for common errors |
| [safety-guardrails](./rules/safety-guardrails.md) | **CRITICAL** - Validation checkpoints, resource limits, rollback |
| [parallel-coordination](./rules/parallel-coordination.md) | **HIGH** - Multi-agent coordination, handoff protocol |

## Quick Reference

| Phase | Command/Action |
|-------|----------------|
| 0. Validation | Ask clarifying questions, get user confirmation |
| 1. Planning | Analyze codebase, create implementation plan |
| 2. Worktree | `gw add feat/feature-name` (MANDATORY) |
| 3. Implementation | Code in isolated worktree, commit incrementally |
| 4. Testing | `npm test`, iterate until all pass |
| 5. Documentation | Update README, CHANGELOG |
| 6. PR Creation | `gh pr create --draft` |
| 7. Cleanup | `gw remove feat/feature-name` (after merge) |

## Key Principles

- **Always validate first (Phase 0)**: Never skip directly to implementation.
- **Always create worktree (Phase 2)**: Isolation is mandatory.
- **Smart worktree detection**: Check if current worktree matches task before creating new.
- **Iterate until correct**: No artificial iteration limits (Ralph Wiggum pattern).
- **Fast feedback loops**: Run tests frequently, fix failures immediately.
- **Self-validate continuously**: Check work at every step.
- **Stop and ask when blocked**: Don't guess on ambiguity.

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

| Scenario | Action |
|----------|--------|
| On main/master | Always create new worktree |
| Worktree name matches task keywords | Prompt user to continue or create new |
| No keyword match | Create new worktree |

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

## Resources

- [Complete Workflow Example](./examples/autonomous-workflow-complete.md)
- [Error Recovery Scenarios](./examples/error-recovery-scenarios.md)
- [Iterative Refinement Example](./examples/iterative-refinement.md)

## Research Sources

- [Ralph Wiggum AI Coding Loops](https://ralph-wiggum.ai) - Iteration pattern
- [Addy Osmani's LLM Workflow](https://addyosmani.com/blog/ai-coding-workflow/) - Fast feedback loops
- [Claude Code Worktree Support](https://code.claude.com/docs/en/common-workflows) - Best practices
