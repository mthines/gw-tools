---
title: "Phase 6: PR Creation & Delivery"
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

## Procedure

### Step 1: Pre-Flight Validation

```bash
# All changes committed?
git status  # Should show clean

# All tests passing?
npm test

# Build succeeds?
npm run build

# Linting clean?
npm run lint
```

**Documentation complete?**
- README updated? ✓
- CHANGELOG updated? ✓
- API docs updated? ✓

**If ANY check fails: Stop, fix, re-validate.**

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

### Step 4: Create Draft PR

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

### Step 5: Report Completion

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

### Step 6: Preserve Worktree

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
