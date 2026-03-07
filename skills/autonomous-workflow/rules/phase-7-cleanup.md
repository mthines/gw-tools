---
title: "Phase 7: Cleanup"
impact: LOW
tags:
  - cleanup
  - optional
  - phase-7
---

# Phase 7: Cleanup (Optional)

## Overview

Remove worktree after PR is merged or closed.
This phase is optional and should only run when appropriate.

## When to Use

**Run cleanup when:**
- PR has been merged
- PR has been closed/abandoned
- User explicitly requests cleanup

**Do NOT cleanup if:**
- PR still under review
- User hasn't reviewed changes yet
- Might need to iterate on PR

## Procedure

### Step 1: Check PR Status

```bash
gh pr view <pr-number> --json state,mergedAt
```

**Safe to cleanup if:**
- State: MERGED
- State: CLOSED (and user confirms)

**NOT safe if:**
- State: OPEN
- User hasn't reviewed yet

### Step 2: Confirm with User

If uncertain:

"The PR for <feature> is <state>. Should I remove the worktree?"

Wait for confirmation.

### Step 3: Remove Worktree

```bash
gw remove <branch-name>
```

**Validation:**
- Worktree removed from `gw list`?
- Directory deleted?

### Step 4: Navigate to Main

```bash
gw cd main
```

### Step 5: Report Cleanup

"✅ Worktree cleaned up. Disk space reclaimed."

## Cleanup Checklist

- [ ] PR status checked
- [ ] Safe to remove worktree
- [ ] Worktree removed successfully
- [ ] Navigated to main
- [ ] User notified

## References

- Related rule: [phase-6-pr-creation](./phase-6-pr-creation.md)
- Related skill: [git-worktree-workflows cleanup](../../git-worktree-workflows/rules/cleanup.md)
