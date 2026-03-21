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

## ⚠️ CRITICAL: When to Create Artifacts

**For Full Mode tasks, artifacts MUST be created AFTER Phase 2 worktree setup — inside the worktree, not on the main branch.**

Phase 1 planning happens in conversation. Artifact files are written to disk only after the worktree is created and you have navigated into it:

```bash
# Create AFTER worktree setup (end of Phase 2), inside the worktree
mkdir -p .gw/{branch-name}
touch .gw/{branch-name}/task.md
touch .gw/{branch-name}/plan.md
```

Then populate them with the content prepared during Phase 1.

**⛔ DO NOT create artifact files on the main branch. Always create them inside the worktree.**

---

## Overview

The autonomous workflow uses a three-artifact pattern inspired by Google Antigravity for tracking progress, documenting decisions, and generating summaries. These artifacts complement Claude's built-in memory by providing explicit, user-visible files.

## When to Use Artifacts

**Create artifacts (Full Mode) when:**

- Task involves 4+ files
- Multiple architectural decisions required
- Long session where context may be compacted
- Handoff to another agent is possible
- User wants detailed progress tracking
- Complex feature with many steps

**Skip artifacts (Lite Mode) when:**

- Task involves 1-3 files
- Implementation is straightforward
- Can be completed quickly in one session
- No complex decisions to track
- Simple bug fix or enhancement

See [overview](./overview.md) for the complete decision flow.

## Three-Artifact Pattern

| Artifact        | File             | Purpose                                   | Created       | Populated |
| --------------- | ---------------- | ----------------------------------------- | ------------- | --------- |
| **Task**        | `task.md`        | Dynamic checklist, decisions, discoveries | Phase 2 (end) | Phase 2+  |
| **Plan**        | `plan.md`        | Implementation strategy, files to change  | Phase 2 (end) | Phase 2   |
| **Walkthrough** | `walkthrough.md` | Final summary, verification steps         | Phase 6       | Phase 6   |

**Note:** Planning happens in Phase 1 (in conversation). Files are _created and populated_ inside the worktree after Phase 2 setup.

## File Location

**Pattern**: `.gw/{branch-name}/*.md`

```
.gw/
├── feat-dark-mode/
│   ├── task.md           # Dynamic task checklist
│   ├── plan.md           # Implementation plan
│   ├── walkthrough.md    # Final summary (created at Phase 6)
│   └── metadata.json     # Artifact metadata
├── fix-auth-bug/
│   └── ...
└── .gitignore            # Auto-created
```

Files are grouped by branch name for easy browsing.

## Metadata Format

Each branch directory includes `metadata.json`:

```json
{
  "branch": "feat/dark-mode",
  "task": "Implement dark mode toggle",
  "created": "2026-03-07T14:30:00Z",
  "updated": "2026-03-07T16:45:00Z",
  "phase": 4,
  "status": "in_progress"
}
```

**Fields:**

- `created`: ISO 8601 timestamp (enables future auto-cleanup)
- `updated`: Last modification time
- `phase`: Current workflow phase (0-7)
- `status`: `pending`, `in_progress`, `completed`, `blocked`

## Gitignore

The `.gw/` folder is gitignored. The workflow auto-adds to `.gitignore`:

```gitignore
# gw-tools artifacts (working files, not committed)
.gw/
```

## Context Recovery

When context is compacted, read `.gw/{branch}/task.md` to recover:

- Exact files changed and why
- Decisions made and rationale
- Current task and remaining work

**Instruction**: "If context has been compacted and you need to recall details, read `.gw/{branch}/task.md`"

## Templates

Use templates from `skills/autonomous-workflow/templates/` for consistency:

- `task.template.md` - Task list structure
- `plan.template.md` - Implementation plan structure
- `walkthrough.template.md` - Summary structure

## Key Principles

- **Plan in Phase 1**: Prepare artifact content in conversation during codebase analysis
- **Create AFTER Phase 2**: Write artifact files inside the worktree (never on main branch)
- **Populate at end of Phase 2**: Fill `task.md` and `plan.md` with planning content from Phase 1
- **Update frequently**: Update `task.md` on every significant change
- **Generate at end**: Create `walkthrough.md` at Phase 6
- **User-visible**: These are deliverables, not hidden state
- **Complement Claude**: Works with, not against, Claude's memory

## References

- Related rule: [task-tracking](./task-tracking.md)
- Related rule: [walkthrough-generation](./walkthrough-generation.md)
- Related rule: [phase-1-planning](./phase-1-planning.md)
- Research: [Antigravity Artifacts](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
