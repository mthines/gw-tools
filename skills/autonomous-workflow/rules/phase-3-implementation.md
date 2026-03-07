---
title: 'Phase 3: Implementation'
impact: HIGH
tags:
  - implementation
  - coding
  - phase-3
---

# Phase 3: Implementation

## Overview

Incremental implementation with continuous validation.
Work in the isolated worktree created in Phase 2.
Follow existing patterns, commit logically.

## Prerequisite

**Before starting, verify:**

- Worktree created with `gw add`
- Currently in worktree directory (`pwd` check)
- Dependencies installed
- Environment validated
- Artifacts initialized (`.gw/{branch}/task.md` exists)

**If worktree not created, STOP and return to Phase 2.**

## Core Principles

- **Follow existing patterns**: Consistency with codebase.
- **Implement incrementally**: Small, focused changes.
- **Validate continuously**: Self-check at every step.
- **Commit logically**: Meaningful commit messages.

## Procedure

### Step 1: Implementation Order

Implement in logical order:

1. Types/interfaces (if TypeScript)
2. Core logic/functions
3. UI components (if applicable)
4. Integration/glue code
5. Configuration updates

### Step 2: One Change at a Time

**Before Editing:**

- Read existing file completely
- Understand current structure
- Identify insertion points
- Note existing patterns

**During Editing:**

- Make focused change (one concern)
- Follow existing code style
- Maintain consistent formatting
- Add comments only if logic non-obvious

**After Editing:**

```bash
# Does it compile?
npm run build  # or tsc --noEmit

# Does it pass linting?
npm run lint -- <file-path>
```

**Self-review questions:**

- Does this match existing patterns?
- Is naming consistent?
- Are imports organized correctly?
- Is this the simplest solution?

### Step 3: Update Task Tracking

After each file change, update `.gw/{branch}/task.md`:

```markdown
## Completed

- [x] Created ThemeContext.tsx # Move from Current/Upcoming

## Current

- [ ] Creating ThemeToggle <- **IN PROGRESS**
```

**Update on:**

- File created → Add to Completed
- Decision made → Add to Decisions Log
- Discovery found → Add to Discoveries
- Blocker hit → Update Blockers section

See [task-tracking](./task-tracking.md) for full details.

### Step 4: Commit Incrementally

After each logical unit:

```bash
git add <changed-files>
git commit -m "<type>(<scope>): <description>"
```

**Conventional commit format:**

- `feat(ui): add dark mode toggle button`
- `feat(theme): implement theme context provider`
- `test(theme): add theme toggle unit tests`

**Guidelines:**

- One logical change per commit
- Clear, descriptive messages
- Keep commits atomic

### Step 5: Continuous Validation

After every 2-3 files changed:

```bash
# Full build
npm run build

# All lint rules
npm run lint

# Quick test run
npm test -- --coverage=false --maxWorkers=1
```

**Self-assessment:**

- Is implementation on track?
- Any deviations from plan?
- Need to adjust approach?

### Step 6: Integration Check

After all implementation:

- All files compile together?
- No TypeScript/lint errors?
- Imports resolve correctly?
- No circular dependencies?

### Step 7: Pre-Testing Commit

```bash
git add .
git commit -m "feat(scope): implement <feature-name>

- Detail 1
- Detail 2"
```

## Implementation Checklist

- [ ] All planned files modified
- [ ] Code follows existing patterns
- [ ] Builds/compiles successfully
- [ ] Linting passes
- [ ] Commits are logical and clear
- [ ] Self-reviewed all changes
- [ ] Ready for testing

## References

- Related rule: [phase-2-worktree](./phase-2-worktree.md)
- Related rule: [phase-4-testing](./phase-4-testing.md)
- Related rule: [task-tracking](./task-tracking.md)
