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

Incremental implementation with continuous verification.
Work in the isolated worktree created in Phase 2.
Follow existing patterns, commit logically.

## Prerequisite

**Before starting, verify:**

- Worktree created with `gw add`
- Currently in worktree directory (`pwd` check)
- Dependencies installed
- Environment validated
- plan.md populated (Full Mode)

**If worktree not created, STOP and return to Phase 2.**

## Core Principles

- **Follow existing patterns**: Consistency with codebase.
- **Implement incrementally**: Small, focused changes.
- **Verify after editing**: Run fast checks after each change.
- **Commit logically**: Meaningful commit messages.

## Procedure

### Step 1: Implementation Order

Implement in logical order (per plan.md Implementation Order):

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

**After Editing — Verify:**

Run the fast check identified in plan.md's Verification section. Examples:

```bash
npx tsc --noEmit           # TypeScript type check
go vet ./...               # Go vet
npm run lint -- <file>     # Lint changed file
```

If verification fails, fix immediately before moving on. Max 3 attempts per failure — if still failing after 3 tries, reassess your approach rather than continuing to iterate.

### Step 3: Commit Incrementally

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
- NEVER add `Co-Authored-By` lines to commit messages

### Step 4: Periodic Validation

After every 2-3 files changed, run a broader check:

```bash
# Run tests related to changed code
npm test -- --testPathPattern="relevant"

# Full build check
npm run build
```

**Self-assessment:**

- Is implementation on track with plan.md?
- Any deviations from plan?
- Need to adjust approach?

### Step 5: Update Progress Log (Full Mode)

At key milestones (not after every file), append to plan.md's Progress Log:

```markdown
- [TIMESTAMP] Phase 3: Implemented ThemeContext and ThemeToggle components
- [TIMESTAMP] Phase 3: Updated Tailwind config for dark mode classes
```

### Step 6: Pre-Testing Commit

After all implementation complete:

```bash
git add .
git commit -m "feat(scope): implement <feature-name>

- Detail 1
- Detail 2"
```

## Implementation Checklist

- [ ] All planned files modified
- [ ] Code follows existing patterns
- [ ] Verification passes after each change
- [ ] Commits are logical and clear
- [ ] Self-reviewed all changes
- [ ] Progress Log updated (Full Mode)
- [ ] Ready for testing

## References

- Related rule: [phase-2-worktree](./phase-2-worktree.md)
- Related rule: [phase-4-testing](./phase-4-testing.md)
