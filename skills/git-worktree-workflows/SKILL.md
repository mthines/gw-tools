---
name: git-worktree-workflows
description: >
  Master Git worktrees and gw-tools workflows for parallel development.
  Use when creating worktrees, managing multiple branches simultaneously, navigating between worktrees, troubleshooting worktree issues, or setting up feature branch workflows.
  Triggers on git worktree commands, branch isolation, parallel development, or gw CLI usage.
license: MIT
metadata:
  author: mthines
  version: '2.0.0'
  workflow_type: advisory
---

# Git Worktree Workflows

Master Git worktrees using the `gw` CLI tool for optimized parallel development workflows.

## Rules

| Rule                                          | Description                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [fundamentals](./rules/fundamentals.md)       | **HIGH** - Core concepts of Git worktrees, what they share/don't share, when to use them |
| [creation](./rules/creation.md)               | **HIGH** - Creating worktrees with `gw add`, remote fetch behavior, auto-copy files      |
| [navigation](./rules/navigation.md)           | **MEDIUM** - Navigating with `gw cd` and `gw checkout`, shell integration setup          |
| [inspection](./rules/inspection.md)           | **LOW** - Listing worktrees with `gw list`, understanding worktree states                |
| [cleanup](./rules/cleanup.md)                 | **MEDIUM** - Removing worktrees, `gw clean`, `gw prune`, disk space management           |
| [troubleshooting](./rules/troubleshooting.md) | **HIGH** - Common errors and solutions, recovery procedures                              |

## Workflow Patterns

| Pattern                                                  | Description                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| [feature-branch](./rules/patterns/feature-branch.md)     | **HIGH** - Feature development workflow with worktrees        |
| [hotfix](./rules/patterns/hotfix.md)                     | **HIGH** - Urgent bug fixes without interrupting feature work |
| [code-review](./rules/patterns/code-review.md)           | **HIGH** - Review PRs in isolated environments with `gw pr`   |
| [parallel-testing](./rules/patterns/parallel-testing.md) | **MEDIUM** - Test across Node versions or configurations      |

## Quick Reference

| Task                         | Command                              |
| ---------------------------- | ------------------------------------ |
| Create worktree              | `gw add feature-name`                |
| Create from different branch | `gw add feature-name --from develop` |
| Navigate to worktree         | `gw cd feature-name`                 |
| List all worktrees           | `gw list`                            |
| Remove worktree              | `gw remove feature-name`             |
| Check out PR                 | `gw pr 123`                          |
| Update with main             | `gw update`                          |
| Batch cleanup                | `gw clean`                           |
| Full cleanup                 | `gw prune`                           |

## Key Principles

- **Use worktrees for parallel work**: Keep main ready while developing features.
- **Always use `gw add`**: Gets auto-copy, shell navigation, smart fetch.
- **One branch per worktree**: Cannot check out same branch in multiple worktrees.
- **Clean up when done**: Use `gw remove`, `gw clean`, or `gw prune`.

## Related Skills

- [gw-config-management](../gw-config-management/) - Configure auto-copy files and hooks
- [autonomous-workflow](../autonomous-workflow/) - Autonomous development in isolated worktrees

## Resources

- [Getting Started Example](./examples/getting-started.md)
- [Parallel Development Example](./examples/parallel-development.md)
- [Troubleshooting Guide](./examples/troubleshooting-worktrees.md)
- [gw CLI Documentation](../../packages/gw-tool/README.md)
