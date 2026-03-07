---
title: 'Walkthrough Generation'
impact: MEDIUM
tags:
  - walkthrough
  - summary
  - documentation
  - pr
---

# Walkthrough Generation

## Overview

The `walkthrough.md` file is the final summary generated at Phase 6 (PR Creation). Inspired by Antigravity's Walkthrough artifact, it provides a comprehensive report of what was done, how to verify it, and next steps.

## When to Generate

Generate `walkthrough.md` at **Phase 6** after:

- All tests pass
- Documentation updated
- Ready to create PR

## File Structure

Use `templates/walkthrough.template.md` as the base:

```markdown
---
created: 2026-03-07T16:30:00Z
branch: feat/dark-mode
task: Implement dark mode toggle
pr: 123
---

# Walkthrough: Implement dark mode toggle

## Quick Reference

- **Branch**: `feat/dark-mode`
- **PR**: #123 (draft)
- **Worktree**: `/Users/dev/project.worktrees/feat-dark-mode`

## Summary

Added dark mode toggle to the application navbar. User preference persists
in localStorage and respects system preferences as default.

## Files Changed

| File                             | Change   | Purpose                 |
| -------------------------------- | -------- | ----------------------- |
| `src/contexts/ThemeContext.tsx`  | Added    | Theme state management  |
| `src/components/ThemeToggle.tsx` | Added    | Toggle UI component     |
| `tailwind.config.js`             | Modified | Dark mode configuration |
| `README.md`                      | Modified | Usage documentation     |

## Key Decisions

1. Used Tailwind `dark:` classes (matches existing patterns)
2. Stored preference in localStorage (user requirement)
3. System preference as default, manual toggle overrides

## Testing Results

- 12 unit tests added (100% coverage of new code)
- Manual testing in Chrome, Firefox, Safari
- Existing tests pass (no regressions)

## How to Verify

1. Run `npm run dev` in worktree
2. Click toggle in navbar - theme should change
3. Refresh page - preference should persist
4. Check system preference detection (toggle OS dark mode)

## Next Steps

1. Review draft PR
2. Mark as ready for review
3. After merge: `gw remove feat/dark-mode`
```

## Generation Process

### Step 1: Gather Information

From `task.md`:

- Completed items (for Files Changed)
- Decisions Log (for Key Decisions)
- Discoveries (for context)

From git:

```bash
# Get files changed
git diff --stat main...HEAD

# Get commit messages
git log --oneline main...HEAD
```

### Step 2: Create Summary

Write 2-3 sentences covering:

- What was implemented
- Key functionality
- User-facing changes

### Step 3: List Files Changed

Create table with:

- File path
- Change type (Added/Modified/Deleted)
- Purpose (brief description)

### Step 4: Document Key Decisions

Number the important decisions from `task.md` Decisions Log.

### Step 5: Report Testing Results

List test outcomes:

- Unit tests added/passed
- Integration tests
- Manual verification steps completed

### Step 6: Write Verification Steps

Provide step-by-step instructions for reviewers to verify the changes work.

### Step 7: Define Next Steps

Standard next steps:

1. Review draft PR
2. Mark as ready for review
3. After merge: `gw remove {branch}`

## Delivery Format

The walkthrough is delivered in two ways:

### 1. Inline (to user)

Present summary directly in the conversation:

```
## Walkthrough: Dark mode toggle

**PR**: #123 (draft)
**Branch**: `feat/dark-mode`

### Summary
Added dark mode toggle with localStorage persistence...

### Files Changed
- `src/contexts/ThemeContext.tsx` (Added)
- `src/components/ThemeToggle.tsx` (Added)
...

### How to Verify
1. Run `npm run dev`
2. Click toggle in navbar
...
```

### 2. File (for reference)

Save to `.gw/{branch}/walkthrough.md` for:

- Future reference
- Handoff to other agents
- Context recovery

## Update Metadata

After creating walkthrough, update `metadata.json`:

```json
{
  "branch": "feat/dark-mode",
  "task": "Implement dark mode toggle",
  "created": "2026-03-07T14:30:00Z",
  "updated": "2026-03-07T16:30:00Z",
  "phase": 6,
  "status": "completed",
  "pr": 123
}
```

## References

- Related rule: [artifacts-overview](./artifacts-overview.md)
- Related rule: [phase-6-pr-creation](./phase-6-pr-creation.md)
- Template: `templates/walkthrough.template.md`
