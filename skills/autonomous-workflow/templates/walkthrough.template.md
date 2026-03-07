---
created: { { TIMESTAMP } }
branch: { { BRANCH } }
task: { { TASK_DESCRIPTION } }
pr: { { PR_NUMBER } }
---

# Walkthrough: {{TASK_DESCRIPTION}}

## Quick Reference

- **Branch**: `{{BRANCH}}`
- **PR**: #{{PR_NUMBER}}
- **Worktree**: `{{WORKTREE_PATH}}`

## Summary

<!-- 2-3 sentence summary of what was done -->

## Files Changed

| File | Change | Purpose |
| ---- | ------ | ------- |

<!-- List all modified files -->

## Key Decisions

<!-- Numbered list of important decisions made -->

## Testing Results

<!-- Test outcomes with checkmark/x indicators -->

## How to Verify

<!-- Step-by-step verification instructions -->

1.
2.
3.

## Next Steps

<!-- What to do after reviewing this PR -->

1. Review draft PR
2. Mark as ready for review
3. After merge: `gw remove {{BRANCH}}`
