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
- **No AI co-author tags**: NEVER add `Co-Authored-By` lines to commit messages or PR descriptions. The user owns the commits.

## Procedure

### Step 1: Pre-Flight Validation

Run the full verification suite (from plan.md's Verification section):

```bash
# All changes committed?
git status  # Should show clean

# Run full suite — build, test, lint
# Use whatever commands the project uses, e.g.:
npm test && npm run build && npm run lint
```

**If ANY check fails: Stop, fix, re-validate. Do NOT create the PR.**

### Step 2: Push to Remote

```bash
git push -u origin <branch-name>
```

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

## Breaking Changes

[None / List with migration path]

## Related Issues

Closes #[issue-number]
```

### Step 4: Generate Walkthrough (Full Mode)

Create `.gw/{branch}/walkthrough.md` using `templates/walkthrough.template.md`:

**Source information from:**

- plan.md (decisions, requirements, file changes)
- git diff/log (actual changes made)
- Phase 4 results (test outcomes)

See [walkthrough-generation](./walkthrough-generation.md) for details.

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

### Step 6: Update Progress Log (Full Mode)

```markdown
- [TIMESTAMP] Phase 6: PR #XX created (draft), walkthrough.md generated
```

### Step 7: Report Completion

Present walkthrough inline to user with PR link, summary, and next steps.

### Step 8: Preserve Worktree

**Do NOT remove worktree yet.** User may want to review, adjust, or test locally.

## Delivery Checklist

- [ ] Pre-flight validation passed
- [ ] All tests passing
- [ ] Branch pushed to remote
- [ ] PR description comprehensive
- [ ] Draft PR created
- [ ] Walkthrough generated and shown to user (Full Mode)
- [ ] PR link delivered to user
- [ ] Worktree preserved for review

## References

- Related rule: [phase-5-documentation](./phase-5-documentation.md)
- Related rule: [walkthrough-generation](./walkthrough-generation.md)
- Template: `templates/walkthrough.template.md`
