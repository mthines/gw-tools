---
title: "Safety Guardrails"
impact: CRITICAL
tags:
  - safety
  - guardrails
  - limits
  - rollback
---

# Safety Guardrails

## Overview

Validation checkpoints, resource limits, and rollback procedures.
These guardrails prevent runaway execution and enable recovery.

## Validation Checkpoints

### Phase 0: Before Any Work
- Requirements understood
- User confirmed understanding

### Phase 1: Before Implementation
- Plan matches requirements
- Approach is sound

### Phase 2: Before Coding (CRITICAL)
- Worktree created with `gw add`
- Currently in worktree directory
- Dependencies installed
- Environment builds

### Phase 3: During Implementation
- Working in isolated worktree
- Builds after each file
- Self-review before commit

### Phase 4: Before Delivery
- All tests pass
- Requirements verified

### Phase 5: Documentation
- Read as new user
- Examples tested

### Phase 6: Before PR
- All checks passing
- Complete and ready

## Self-Validation Questions

| After Phase | Ask |
|-------------|-----|
| Phase 1 | Can I explain approach in 2 sentences? |
| Phase 2 | Is `gw list` showing new worktree? |
| Phase 3 | Does code compile/lint pass? |
| Phase 4 | Are ALL tests passing? |
| Phase 5 | Do docs match implementation? |
| Phase 6 | Is PR description accurate? |

## Resource Limits

### Soft Limits (Guidelines)
- Commits: ~3-10 per feature
- Files changed: ~20 max
- Time: ~1-2 hours
- Iterations: No limit (iterate until correct)

### Hard Limits (Stop and Ask)
- >50 files changed → Scope too large, split PRs
- >3 hours stuck → Fundamental issue, need input
- >100 commits → Something wrong with approach
- 20+ test iterations → Get user guidance

## When to Stop and Ask

1. **Requirements ambiguous mid-implementation**
2. **Fundamental blocker encountered**
3. **Scope creep detected**
4. **Tests reveal misunderstanding**
5. **Resource limits approaching**

### How to Ask

```markdown
"⚠️ Pausing autonomous execution - need guidance.

**Situation:** [what happened]

**Issue:** [the blocker]

**Options:**
1. [Option A] - [pros/cons]
2. [Option B] - [pros/cons]

**My recommendation:** [which and why]

**Question:** [specific question]

Should I proceed with [recommended] or [alternative]?"
```

## Quality Gates

**Before each phase transition:**
- Previous phase checklist complete
- Self-validation passed
- No blocking errors
- Clear to proceed

**Before Phase 3 (CRITICAL GATE):**
- Phase 2 complete - worktree created
- Currently in worktree directory
- NOT in user's original directory
- Dependencies installed
- Build system works

**If this gate fails, return to Phase 2.**

## Rollback Procedures

```bash
# Undo uncommitted changes
git checkout .

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Return to starting point
git reset --hard origin/main

# Remove worktree entirely
gw remove <branch-name> --force
```

## Checkpoint Failure Protocol

If validation fails:
1. Do NOT proceed to next phase
2. Analyze what went wrong
3. Fix the issue
4. Re-validate
5. Only proceed when validation passes

## References

- Related rule: [error-recovery](./error-recovery.md)
- Related rule: [decision-framework](./decision-framework.md)
