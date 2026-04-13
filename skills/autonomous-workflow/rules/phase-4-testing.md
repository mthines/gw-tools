---
title: 'Phase 4: Testing & Iteration'
impact: CRITICAL
tags:
  - testing
  - iteration
  - ralph-wiggum
  - phase-4
---

# Phase 4: Testing & Iteration

## Overview

Run comprehensive tests and iterate aggressively until all pass.
Based on the Ralph Wiggum pattern: iterate until tests pass, no artificial limits.
Fast iteration loops with continuous self-validation.

## Core Principles

- **Iterate until correct**: No hard iteration limits.
- **Fast feedback loops**: Run tests frequently.
- **Fix root causes**: Not symptoms.
- **Track progress**: Know if you're getting closer.
- **Fresh context if stuck**: Review approach from scratch.

## The "Ship Until Done" Loop

```
iteration = 0
while not all_tests_pass:
    1. Run tests
    2. If pass: done = true; break
    3. If fail:
       a. Analyze failure logs
       b. Identify root cause
       c. Fix implementation
       d. Commit fix: "fix: address test failure - [specific issue]"
       e. iteration++
    4. Safety checks:
       - If iteration == 10: Warn user, continue
       - If iteration == 20: Hard stop, ask user
```

## Procedure

### Step 1: Determine Test Strategy

| Changed          | Test Type                      |
| ---------------- | ------------------------------ |
| Pure functions   | Unit tests                     |
| React components | Component tests                |
| API endpoints    | Integration tests              |
| Database ops     | Integration tests with test DB |
| UI interactions  | E2E tests                      |

### Step 2: Run Existing Tests

```bash
npm test
# Or specific tests
npm test -- --testPathPattern="relevant"
```

**Expected outcomes:**

- All existing tests pass (no regressions)
- Some tests fail (if changing behavior intentionally)

### Step 3: Iteration Loop

**CRITICAL: Focus on ONE failing test at a time.**

#### Attempts 1-2: Fix Obvious Issues

1. Read error message completely
2. Identify assertion that failed
3. Fix most likely cause
4. Rerun tests
5. Assess: Did failures decrease?

#### Attempts 3-4: Deep Analysis

If still failing:

1. Add logging to understand state
2. Check assumptions about data/types
3. Verify mocks/stubs are correct
4. Fix root cause (not symptom)
5. Rerun tests

#### Attempts 5-6: Alternative Approach

If still failing:

1. Question implementation approach
2. Review similar code in codebase
3. Consider simpler solution
4. Refactor if necessary
5. Rerun tests

#### Attempts 7+: Escalate

If still failing after 6 focused attempts, escalate to user with:

- What you've tried
- What you think the root cause is
- What you'd try next

### Step 4: Self-Reflection Checkpoint

Every 3 iterations, ask yourself:

- Are failures decreasing? (Good — keep going)
- Am I fixing the same thing repeatedly? (Bad — try different approach)
- Am I making the problem worse? (Bad — revert and rethink)

### Step 5: Fresh Context Strategy

If iteration > 5 and making no progress:

1. Commit current state
2. Step back and review approach from scratch
3. Ask: Is the approach fundamentally wrong?
4. Consider alternative implementation

### Step 6: Add New Tests

If new functionality added:

```typescript
describe('DarkModeToggle', () => {
  it('should toggle theme when clicked', () => {
    // Test new functionality
  });

  it('should persist preference', () => {
    // Test persistence
  });
});
```

### Step 7: Final Validation

Run full suite using plan.md's before-PR verification commands:

```bash
npm test -- --coverage
```

### Step 8: Update Progress Log (Full Mode)

Append to plan.md's Progress Log:

```markdown
- [TIMESTAMP] Phase 4: Tests passing (X iterations, fixed Y and Z)
```

### Step 9: Commit Test Changes

```bash
git add <test-files>
git commit -m "test(scope): add comprehensive tests

- Unit tests for X
- Integration tests for Y
- Edge case coverage for Z"
```

## When to Stop and Ask

- 20+ iterations without progress
- Tests pass but don't actually validate requirement
- Discovered requirement ambiguity
- Need architectural decision

## Testing Checklist

- [ ] Test strategy determined
- [ ] Existing tests pass
- [ ] Failures analyzed and fixed
- [ ] Iterated until all pass
- [ ] New tests added (if applicable)
- [ ] Coverage adequate
- [ ] Requirements validated
- [ ] Ready for documentation

## References

- Research: [Ralph Wiggum Pattern](https://ralph-wiggum.ai)
- Research: [Fast Feedback Loops](https://addyosmani.com/blog/ai-coding-workflow/)
- Related rule: [phase-3-implementation](./phase-3-implementation.md)
- Related rule: [phase-5-documentation](./phase-5-documentation.md)
