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

The autonomous workflow uses a two-artifact pattern for documenting decisions, tracking progress, and generating summaries. These artifacts provide explicit, user-visible files that survive context compaction and enable session handoff.

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

| Artifact        | File             | Purpose                                           | Created       |
| --------------- | ---------------- | ------------------------------------------------- | ------------- |
| **Plan**        | `plan.md`        | Implementation strategy, decisions, progress log  | Phase 2 (end) |
| **Walkthrough** | `walkthrough.md` | Final summary, verification steps for PR delivery | Phase 6       |

**plan.md** is the single source of truth. It contains:

- Full Phase 0 discussion context (requirements, decisions, rationale)
- Technical approach and implementation order
- Verification commands for the project
- **Progress Log** — append-only log updated at phase transitions and milestones

A new Claude session should be able to execute from plan.md alone.

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

## Templates

Use templates from `skills/autonomous-workflow/templates/` for consistency:

- `plan.template.md` - Implementation plan structure with Progress Log
- `walkthrough.template.md` - Summary structure for PR delivery

## Key Principles

- **Plan in Phase 1**: Prepare artifact content in conversation during codebase analysis
- **Create AFTER Phase 2**: Write artifact files inside the worktree (never on main branch)
- **Populate at end of Phase 2**: Fill `plan.md` with planning content from Phase 1
- **Update Progress Log at milestones**: Append entries at phase transitions and key completions
- **Generate walkthrough at Phase 6**: Create `walkthrough.md` for PR delivery

## References

- Related rule: [walkthrough-generation](./walkthrough-generation.md)
- Related rule: [phase-1-planning](./phase-1-planning.md)
- Research: [Antigravity Artifacts](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
