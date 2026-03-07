---
title: 'Error Recovery Procedures'
impact: HIGH
tags:
  - errors
  - recovery
  - troubleshooting
---

# Error Recovery Procedures

## Overview

Recovery procedures for common errors during autonomous execution.
Don't give up on errors—diagnose and recover.

## Worktree Creation Failures

**Error:** `gw add` fails

**Diagnosis:**

```bash
git status
git worktree list
git branch --list <branch-name>
```

**Recovery:**

| Cause                 | Fix                                    |
| --------------------- | -------------------------------------- |
| Branch already exists | Use different name or `gw cd <branch>` |
| Permission error      | Check directory permissions            |
| Disk space issue      | Run `gw prune`, free space             |
| Git error             | Read message, fix underlying issue     |

## Dependency Installation Failures

**Error:** `npm install` fails

**Diagnosis:**

```bash
node --version
which npm pnpm yarn
ping registry.npmjs.org
```

**Recovery:**

| Cause                   | Fix                                          |
| ----------------------- | -------------------------------------------- |
| Network error           | Check connection, try different registry     |
| Version incompatibility | Check node requirements, switch version      |
| Lock file mismatch      | Delete lock file and node_modules, reinstall |
| Disk space              | Clean npm cache: `npm cache clean --force`   |

## Test Failures During Iteration

**Error:** Tests fail after implementation

**Recovery Approach:**

### Iteration 1: Fix Obvious Issues

1. Read error message completely
2. Identify assertion that failed
3. Fix most likely cause
4. Rerun tests
5. Assess: Better or worse?

### Iteration 2: Deep Analysis

1. Add console.logs to understand state
2. Check assumptions about data/types
3. Verify mocks/stubs are correct
4. Fix root cause (not symptom)

### Iteration 3+: Alternative Approach

1. Question implementation approach
2. Review similar code in codebase
3. Consider simpler solution
4. Refactor if necessary

### If Truly Stuck

1. Commit working code with failing test
2. Document exact failure and attempts
3. Ask user for guidance

**Never give up after fixed iterations.**

## Merge Conflicts

**Error:** Merge conflict when pushing/rebasing

**Recovery:**

1. **Understand conflicts:**
   - Read both versions
   - Determine correct resolution

2. **Resolve conflicts:**
   - Edit files to resolve
   - Remove conflict markers

3. **Test after resolution:**

   ```bash
   npm run build
   npm test
   ```

4. **Complete resolution:**
   ```bash
   git add <resolved-files>
   git commit  # Or git rebase --continue
   ```

## Build Failures

**Error:** `npm run build` fails

**Recovery:**

| Cause              | Fix                                  |
| ------------------ | ------------------------------------ |
| TypeScript error   | Fix type issues, add missing types   |
| Missing dependency | Install missing package              |
| Path/import error  | Check file locations, fix imports    |
| Config error       | Review build config, restore working |

## References

- Related rule: [phase-4-testing](./phase-4-testing.md)
- Related rule: [safety-guardrails](./safety-guardrails.md)
