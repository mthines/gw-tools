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
Don't give up on errors — diagnose and recover.

## Worktree Creation Failures

**Error:** `gw add` fails

| Cause                 | Fix                                    |
| --------------------- | -------------------------------------- |
| Branch already exists | Use different name or `gw cd <branch>` |
| Permission error      | Check directory permissions            |
| Disk space issue      | Run `gw prune`, free space             |
| Git error             | Read message, fix underlying issue     |

## Dependency Installation Failures

**Error:** `npm install` fails

| Cause                   | Fix                                          |
| ----------------------- | -------------------------------------------- |
| Network error           | Check connection, try different registry     |
| Version incompatibility | Check node requirements, switch version      |
| Lock file mismatch      | Delete lock file and node_modules, reinstall |
| Disk space              | Clean npm cache: `npm cache clean --force`   |

## Test Failures During Iteration

See [phase-4-testing](./phase-4-testing.md) for the full iteration strategy.

**Quick reference:**

- Attempts 1-2: Fix obvious issues (read error, fix likely cause)
- Attempts 3-4: Deep analysis (add logging, check assumptions)
- Attempts 5-6: Alternative approach (rethink, check similar code)
- Attempts 7+: Escalate to user

## Build Failures

| Cause              | Fix                                  |
| ------------------ | ------------------------------------ |
| TypeScript error   | Fix type issues, add missing types   |
| Missing dependency | Install missing package              |
| Path/import error  | Check file locations, fix imports    |
| Config error       | Review build config, restore working |

## Agent-Specific Recovery

### Hallucinated Commands

| Hallucinated Command | Correct Command           |
| -------------------- | ------------------------- |
| `gw create`          | `gw checkout` or `gw add` |
| `gw switch`          | `gw cd`                   |
| `gw delete`          | `gw remove`               |
| `gw new`             | `gw checkout`             |

### Stuck in Loop

**Detection:** Same fix attempted 3+ times without progress.

**Recovery:**

1. Identify the loop pattern
2. Force alternative approach
3. Provide concrete direction — "Look at how `<similar-file>` handles this"
4. Consider scope reduction

### Context Loss

**Detection:** Agent re-does completed work or asks answered questions.

**Recovery:**

1. Read `.gw/{branch}/plan.md` for full context (decisions, progress, requirements)
2. Check Progress Log for what's been completed
3. Resume from where the log left off

## References

- Related rule: [phase-4-testing](./phase-4-testing.md)
- Related rule: [safety-guardrails](./safety-guardrails.md)
