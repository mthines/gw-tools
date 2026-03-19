---
title: 'Task Tracking'
impact: HIGH
tags:
  - task
  - tracking
  - progress
  - checklist
---

# Task Tracking

## Overview

The `task.md` file is a dynamic checklist that tracks progress throughout the autonomous workflow. Inspired by Antigravity's Task List artifact, it provides real-time visibility into completed, current, and upcoming work.

## When to Create

Create `task.md` at **Phase 1** (Planning) immediately after understanding requirements.

```bash
# Create artifact directory
mkdir -p .gw/{branch-name}

# Create task.md using template
# See templates/task.template.md
```

## File Structure

Use `templates/task.template.md` as the base structure:

```markdown
---
created: 2026-03-07T14:30:00Z
branch: feat/dark-mode
task: Implement dark mode toggle
---

# Task: Implement dark mode toggle

## Status

- **Phase**: 3 (Implementation)
- **Last Updated**: 2026-03-07T15:45:00Z

## Completed

- [x] Phase 0: Validated requirements with user
- [x] Phase 1: Created implementation plan
- [x] Phase 2: Created worktree `feat/dark-mode`
- [x] Created ThemeContext.tsx

## Current

- [ ] Creating ThemeToggle component <- **IN PROGRESS**

## Upcoming

- [ ] Update Tailwind config for dark mode
- [ ] Add toggle to navbar
- [ ] Phase 4: Run tests and iterate
- [ ] Phase 5: Update documentation
- [ ] Phase 6: Create PR

## Decisions Log

| Decision                     | Rationale                  | Phase |
| ---------------------------- | -------------------------- | ----- |
| Use Tailwind `dark:` classes | Matches existing patterns  | 1     |
| Store in localStorage        | User requested persistence | 0     |

## Discoveries

- Found existing color system in `src/styles/colors.ts`
- Tests use Vitest, not Jest

## Blockers

None currently
```

## When to Update

Update `task.md` at these points:

| Event                 | Update                                      |
| --------------------- | ------------------------------------------- |
| Phase transition      | Move phase item to Completed, update Status |
| File created/modified | Add item to Completed or Current            |
| Decision made         | Add row to Decisions Log                    |
| Discovery found       | Add to Discoveries section                  |
| Blocker encountered   | Update Blockers section                     |
| Task completed        | Move from Current to Completed              |

## Dynamic Updates

Like Antigravity, the task list is **dynamic**:

- **Add tasks** as you discover dependencies
- **Remove tasks** if a path proves unnecessary
- **Reorder tasks** based on new understanding
- **Split tasks** if they're too large

```markdown
## Upcoming

- [ ] Update Tailwind config for dark mode
- [ ] Add toggle to navbar

* - [ ] Add system preference detection # Added: discovered this requirement
* - [ ] Add transition animations # Added: user requested

- [ ] Phase 4: Run tests and iterate
```

## Sections Explained

> **Note:** The VS Code extension detects task sections generically — any `##` section containing checkboxes (`[ ]` or `[x]`) will appear in the Agent Tasks tree. The headings below are recommended conventions, but custom headings (e.g., `## Checklist`, `## Open Questions`) work too. Known headings like Completed/Current/Upcoming are sorted to the top; unknown headings appear after them in document order.

### Status

Current phase and last update time. Update on every change.

### Completed

Checked items `[x]` showing finished work. Include:

- Phase milestones
- Files created/modified
- Significant steps

### Current

Single item marked `<- **IN PROGRESS**`. Only one item at a time.

### Upcoming

Unchecked items `[ ]` for planned work. Can be reordered.

### Decisions Log

Table of key decisions. Include:

- What was decided
- Why (rationale)
- When (phase number)

### Discoveries

Unexpected findings during implementation:

- Existing code to leverage
- Different patterns than expected
- Useful context for future

### Blockers

Current blockers or "None". If blocked:

- Describe the blocker
- What's needed to unblock
- Who/what is blocking

## Context Recovery

If context is compacted, read `task.md` to recover:

```bash
# In worktree, read task file
cat .gw/$(git branch --show-current | tr '/' '-')/task.md
```

The task file contains everything needed to resume work.

## References

- Related rule: [artifacts-overview](./artifacts-overview.md)
- Related rule: [phase-1-planning](./phase-1-planning.md)
- Template: `templates/task.template.md`
