---
title: 'Artifacts Overview'
impact: HIGH
tags:
  - artifacts
  - tracking
  - progress
  - antigravity
---

# Artifacts Overview

---

## CRITICAL: When to Create Artifacts

**For Full Mode tasks, artifacts MUST be created AFTER Phase 2 worktree setup — inside the worktree, not on the main branch.**

Phase 1 planning happens in conversation. Artifact files are written to disk only after the worktree is created and you have navigated into it:

```bash
# Create AFTER worktree setup (end of Phase 2), inside the worktree
mkdir -p .gw/{branch-name}
# Write plan.md with content prepared during Phase 1
```

**DO NOT create artifact files on the main branch. Always create them inside the worktree.**

---

## Overview

The autonomous workflow uses a two-artifact pattern for documenting decisions, tracking progress, and generating summaries. Artifact creation is handled by dedicated skills that guarantee consistent, complete output.

## When to Use Artifacts

**Create artifacts (Full Mode) when:**

- Task involves 4+ files
- Multiple architectural decisions required
- Long session where context may be compacted
- Handoff to another agent is possible

**Skip artifacts (Lite Mode) when:**

- Task involves 1-3 files
- Implementation is straightforward
- Can be completed quickly in one session

See [overview](./overview.md) for the complete decision flow.

## Two-Artifact Pattern

| Artifact        | File             | Created by                    | When          |
| --------------- | ---------------- | ----------------------------- | ------------- |
| **Plan**        | `plan.md`        | `Skill("create-plan")`        | After Phase 2 |
| **Walkthrough** | `walkthrough.md` | `Skill("create-walkthrough")` | Phase 6       |

**plan.md** is the single source of truth. A new Claude session should be able to execute from it alone.

## Quality Gate

Before creating plan.md, the plan is validated via:

```
Skill(skill: "confidence", args: "plan")
```

The confidence gate must reach 90%+ (or be user-approved) before proceeding.

## File Location

**Pattern**: `.gw/{branch-name}/*.md`

```
.gw/
├── feat-dark-mode/
│   ├── plan.md           # Implementation plan + progress log
│   └── walkthrough.md    # Final summary (created at Phase 6)
├── fix-auth-bug/
│   └── ...
└── .gitignore            # Auto-created
```

## Gitignore

The `.gw/` folder is gitignored. The workflow auto-adds to `.gitignore`:

```gitignore
# gw-tools artifacts (working files, not committed)
.gw/
```

## Context Recovery

When context is compacted or a new session starts, read `.gw/{branch}/plan.md` to recover:

- Full requirements and decisions
- Technical approach and implementation order
- Progress log showing what's been completed
- Verification commands

**Instruction**: "If context has been compacted, read `.gw/{branch}/plan.md` to recover full context."

## Key Principles

- **Plan in Phase 1**: Analyze codebase and prepare plan content in conversation
- **Validate with confidence gate**: `Skill("confidence", "plan")` must pass before artifact creation
- **Create AFTER Phase 2**: Artifact files go inside the worktree (never on main branch)
- **Use dedicated skills**: `Skill("create-plan")` and `Skill("create-walkthrough")` guarantee format consistency
- **Update Progress Log at milestones**: Append entries at phase transitions and key completions

## References

- Related skill: [confidence](../../confidence/SKILL.md) — Quality gate for plan validation
- Related skill: [create-plan](../../create-plan/SKILL.md) — Plan artifact generation
- Related skill: [create-walkthrough](../../create-walkthrough/SKILL.md) — Walkthrough artifact generation
- Related rule: [phase-1-planning](./phase-1-planning.md)
- Research: [Antigravity Artifacts](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
