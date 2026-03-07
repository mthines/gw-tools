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

## Agent-Specific Recovery

### Hallucinated Commands

**Error:** Agent issues a `gw` command that doesn't exist

**Common hallucinations and corrections:**

| Hallucinated Command | Correct Command              |
| -------------------- | ---------------------------- |
| `gw create`          | `gw checkout` or `gw add`    |
| `gw switch`          | `gw cd`                      |
| `gw delete`          | `gw remove`                  |
| `gw new`             | `gw checkout`                |
| `gw branch`          | `gw checkout` (creates new)  |
| `gw copy`            | `gw sync`                    |

**Recovery:**

1. Read the error message to understand what was attempted
2. Check `.gw/{branch}/task.md` for context on what the agent was trying to do
3. Run the correct command manually
4. If in an agentic session, provide guidance: "The command is `gw checkout`, not `gw create`"

### Stuck in Loop

**Error:** Agent repeats same fix multiple times without progress

**Detection:**

Check `.gw/{branch}/task.md` for patterns:

```
## Test Iterations
- Attempt 1: Fixed import statement → Still failing
- Attempt 2: Fixed import statement again → Still failing
- Attempt 3: Fixed import statement differently → Still failing
```

**Recovery:**

1. **Identify the loop pattern** — What is being repeated?
2. **Force alternative approach** — "Stop fixing imports. The issue is likely X instead."
3. **Provide concrete direction** — "Look at how `<similar-file>` handles this"
4. **Consider scope reduction** — "Let's skip this test for now and create an issue"

### Context Loss

**Error:** Agent forgets previous decisions or work done

**Detection:**

- Agent re-does work already completed
- Agent asks questions already answered
- Agent ignores previously stated constraints

**Recovery:**

1. **Point to artifacts:** "Read `.gw/{branch}/task.md` for previous decisions"
2. **Summarize context:** "We already decided X. Continue from there."
3. **Check artifact existence:** Ensure `task.md` and `plan.md` were created

### Wrong Worktree

**Error:** Agent makes changes in wrong worktree

**Detection:**

```bash
pwd                    # Check current directory
gw list               # See all worktrees
git branch --show-current  # Verify branch
```

**Recovery:**

1. Navigate to correct worktree: `gw cd <correct-branch>`
2. Check for unintended changes: `git status` in wrong worktree
3. If changes made in wrong place, copy them: `gw sync <correct-branch> <files>`

## References

- Related rule: [phase-4-testing](./phase-4-testing.md)
- Related rule: [safety-guardrails](./safety-guardrails.md)
