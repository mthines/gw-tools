---
title: "Parallel Testing Pattern"
impact: MEDIUM
tags:
  - pattern
  - testing
  - parallel
---

# Parallel Testing Pattern

## Overview

Test code across multiple environments, Node versions, or configurations simultaneously.
Each test environment runs in its own worktree, enabling true parallel testing.

## Core Principles

- **One worktree per test environment**: Separate Node versions, configs, etc.
- **Use `--force` for same branch**: Multiple worktrees can test same code.
- **Run tests in parallel**: Each terminal tests a different environment.
- **Compare results**: Identify environment-specific issues.

## Procedure

### Testing Across Node Versions

```bash
# Create worktrees for each environment
gw add test-node18 -b feature-api
gw add test-node20 -b feature-api --force

# Terminal 1: Node 18
gw cd test-node18
nvm use 18
npm install
npm test

# Terminal 2: Node 20
gw cd test-node20
nvm use 20
npm install
npm test
```

### Testing Multiple Configurations

```bash
# Create worktrees
gw add test-config-a -b feature-x
gw add test-config-b -b feature-x --force

# Terminal 1: Config A
gw cd test-config-a
cp .env.config-a .env
npm test

# Terminal 2: Config B
gw cd test-config-b
cp .env.config-b .env
npm test
```

### Comparing Feature Implementations

```bash
# Two approaches to same feature
gw add feature-api-rest --from feature-api
gw add feature-api-graphql --from feature-api

# Implement differently in each
# Compare performance, code complexity
```

## Long-Running Experiments

```bash
# Create experiment worktree
gw add experiment-new-architecture -b experiment/new-arch

# Work over days/weeks
# Keep main development in other worktrees

# Later: merge if successful, delete if not
```

## Decision Table

| Goal | Setup |
|------|-------|
| Test Node versions | Multiple worktrees, same branch with `--force` |
| Test configurations | Multiple worktrees, different .env files |
| Compare implementations | Child branches from same parent |
| Long experiment | Separate branch, own worktree |

## Cleanup

```bash
# After testing complete
gw remove test-node18
gw remove test-node20

# Or batch cleanup
gw clean
```

## References

- Related pattern: [feature-branch](./feature-branch.md)
- Related rule: [cleanup](../cleanup.md)
