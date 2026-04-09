---
title: 'Phase 6: PR Creation & Delivery'
impact: HIGH
tags:
  - pr
  - delivery
  - phase-6
---

# Phase 6: PR Creation & Delivery

## Overview

Create a DRAFT pull request with comprehensive description.
Deliver results to user with PR link.
Preserve worktree for user review.

## Core Principles

- **Pre-flight validation**: Everything must pass before PR.
- **Draft PR only**: Never mark ready-to-merge automatically.
- **Comprehensive description**: Reviewers understand context.
- **Preserve worktree**: User may want to review locally.
- **No AI co-author tags**: NEVER add `Co-Authored-By` lines (e.g., `Co-Authored-By: Claude ...`) to commit messages or PR descriptions. The user owns the commits.

## Procedure

### Step 1: Pre-Flight Validation

```bash
# All changes committed?
git status  # Should show clean
```

Run the **pre-pr** tier from the [verification strategy](./verification-strategy.md):

```
Read .gw/autonomous-workflow.json → find the matched directory key for changed files
Run the "pre-pr" command string from that directory key, with cwd = the matched directory
```

This is the one expensive check — the full verification suite (tests, type-check, lint). It runs once before PR creation, not in a loop.

**Documentation complete?**

- README updated? ✓
- CHANGELOG updated? ✓
- API docs updated? ✓

**If pre-pr verification fails: Stop, fix, re-validate. Do NOT create the PR.**

### Step 2: Push to Remote

```bash
git push -u origin <branch-name>
```

**Validation:**

- Push succeeded?
- Branch visible on GitHub?

### Step 3: Generate PR Description

```markdown
## Summary

[High-level overview]

## Changes

- [User-facing change 1]
- [User-facing change 2]

## Implementation Details

- Modified `file1.ts`: [what and why]
- Added `file2.ts`: [purpose]

## Testing

- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual testing completed

## Screenshots (if UI)

[Attach or request user to add]

## Breaking Changes

[None / List with migration path]

## Related Issues

Closes #[issue-number]
```

### Step 4: Generate Walkthrough

Create `.gw/{branch}/walkthrough.md` using the template:

```bash
# Use templates/walkthrough.template.md structure
```

**Include:**

- Quick Reference (branch, PR, worktree path)
- Summary (2-3 sentences)
- Files Changed (from task.md Completed items)
- Key Decisions (from task.md Decisions Log)
- Testing Results (from Phase 4 iterations)
- How to Verify (step-by-step instructions)
- Next Steps

Update `metadata.json`:

```json
{
  "phase": 6,
  "status": "completed",
  "pr": <pr-number>
}
```

See [walkthrough-generation](./walkthrough-generation.md) for full details.

### Step 5: Create Draft PR

```bash
gh pr create \
  --draft \
  --title "<type>(<scope>): <description>" \
  --body "$(cat <<'EOF'
[PR description]
EOF
)"
```

**Always use `--draft` flag.**

### Step 6: Report Completion

```markdown
✅ **Feature implementation complete!**

**Delivered:**

- Branch: `feat/dark-mode-toggle`
- Worktree: `/path/to/worktree`
- Draft PR: https://github.com/user/repo/pull/123

**Summary:**

- Implemented dark mode toggle
- All tests passing
- Documentation updated
- Ready for your review

**Next steps:**

1. Review the draft PR
2. Add screenshots if desired
3. Mark as ready for review when satisfied
4. Merge when approved

**Cleanup:**
Run `gw remove feat/dark-mode-toggle` after PR merged.
```

### Step 7: Preserve Worktree

**Do NOT remove worktree yet.**

User may want to:

- Review changes locally
- Make adjustments
- Test manually
- Add screenshots

Cleanup happens in Phase 7 (optional).

## Delivery Checklist

- [ ] Pre-flight validation passed
- [ ] All tests passing
- [ ] Branch pushed to remote
- [ ] PR description comprehensive
- [ ] Draft PR created
- [ ] PR link delivered to user
- [ ] Worktree preserved for review
- [ ] Workflow complete!

## References

- Related rule: [phase-5-documentation](./phase-5-documentation.md)
- Related rule: [phase-7-cleanup](./phase-7-cleanup.md)
- Related rule: [walkthrough-generation](./walkthrough-generation.md)
- Template: `templates/walkthrough.template.md`
