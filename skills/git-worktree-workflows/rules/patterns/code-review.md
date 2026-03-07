---
title: 'Code Review Workflow Pattern'
impact: HIGH
tags:
  - pattern
  - review
  - pr
---

# Code Review Workflow Pattern

## Overview

Review pull requests in a real environment without disrupting your current work.
Use `gw pr` to quickly check out PRs into isolated worktrees.

## Core Principles

- **Use `gw pr` for quick checkout**: Fetches PR and creates worktree in one step.
- **Review in real environment**: Run tests, start dev server, test manually.
- **Don't disrupt your work**: PR worktree is separate from your feature work.
- **Clean up after review**: Remove PR worktree when done.

## Procedure

### 1. Check Out PR

```bash
# Using PR number (recommended)
gw pr 123

# Using full GitHub URL
gw pr https://github.com/user/repo/pull/123

# Custom worktree name
gw pr 123 --name review-auth-feature
```

### 2. Set Up Environment

```bash
# Dependencies (if not handled by post-add hook)
npm install

# Run tests
npm test

# Start dev server
npm run dev
```

### 3. Review and Test

```bash
# Check the code
# Run automated tests
# Test manually in browser
# Check for edge cases
```

### 4. Provide Feedback

```bash
# Make suggestion commits if needed
git checkout -b pr-123-suggestions
# Make changes...
git push origin pr-123-suggestions

# Or just comment on PR via GitHub
```

### 5. Return to Work

```bash
# Go back to your feature
gw cd feature-dashboard
```

### 6. Cleanup

```bash
# After PR reviewed/merged
gw remove <pr-branch-name>
```

## Manual Alternative

If `gh` CLI is not available:

```bash
# Manually create reviewer worktree
gw add review-pr-123 -b pr-123 origin/pr-123

# Navigate and review
gw cd review-pr-123
```

## Requirements

- GitHub CLI (`gh`) must be installed
- Authenticated with `gh auth login`

## Decision Table

| Situation               | Action                                         |
| ----------------------- | ---------------------------------------------- |
| Review a PR             | `gw pr 123`                                    |
| Review without gh CLI   | `gw add review-pr-123 -b pr-123 origin/pr-123` |
| Done reviewing          | `gw remove <pr-branch>`                        |
| Want to suggest changes | Create suggestion branch, push                 |

## References

- Related pattern: [feature-branch](./feature-branch.md)
- Related rule: [cleanup](../cleanup.md)
