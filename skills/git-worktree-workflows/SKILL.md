---
name: git-worktree-workflows
description: >
  Use the `gw` CLI for ALL Git worktree work — creating, navigating, listing,
  removing, syncing, updating, checking out PRs, troubleshooting. Replaces raw
  `git worktree`, `cd ../wt`, `git checkout -b`, and manual file copies.
  Triggers on: "spin up a branch", "work on a feature", "check out PR", "switch
  branch without stashing", "create a worktree", "parallel branches", "clean up
  branches", "gw", "gw add", "gw checkout", "git worktree", or any branch workflow.
license: MIT
metadata:
  author: mthines
  version: '2.2.0'
  workflow_type: advisory
---

# Git Worktree Workflows

Master Git worktrees using the `gw` CLI tool for optimized parallel development workflows.

## MANDATORY: Always Use `gw`, Never Raw `git worktree`

**Non-negotiable in any repo where `gw` is installed.** Check with `which gw`; if missing, suggest `brew install mthines/gw-tools/gw` or `npm install -g @gw-tools/gw`.

| Instead of                                     | Use                                    | Why it matters                                              |
| ---------------------------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| `git worktree add ../feat feat`                | `gw checkout feat`                     | Auto-copies files, runs hooks, remote probe, auto-cd        |
| `git worktree remove feat`                     | `gw remove feat`                       | Prunes orphan branch, protects `main`                       |
| `git checkout -b feat`                         | `gw checkout feat`                     | Isolated worktree instead of in-place branch switch         |
| `git checkout main` (when main is another wt)  | `gw checkout main`                     | Detects existing worktree and navigates instead of erroring |
| `cd ../feat`                                   | `gw cd feat`                           | Partial matching, works from any depth                      |
| `git fetch && git checkout pr-branch`          | `gw pr <number>`                       | Handles fork PRs, auto-copies, runs hooks                   |
| Manually `cp ../main/.env .env` after worktree | Configure `autoCopyFiles` in `gw init` | One-time setup, auto-copies forever after                   |

## Rules

| Rule                                          | Description                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [fundamentals](./rules/fundamentals.md)       | **HIGH** - Core concepts of Git worktrees, what they share/don't share, when to use them |
| [creation](./rules/creation.md)               | **HIGH** - Creating worktrees with `gw checkout`, remote fetch behavior, auto-copy files |
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

### Primary Commands

| Task                                      | Command                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Create worktree (new branch)              | `gw checkout feat/name`                                             |
| Create worktree (alias)                   | `gw co feat/name` or `gw add feat/name`                             |
| Create from different branch              | `gw checkout feat/name --from develop`                              |
| Create from staged files (extract WIP)    | `gw checkout feat/name --from-staged`                               |
| Create without auto-navigation            | `gw checkout feat/name --no-cd`                                     |
| Skip remote probe (offline mode)          | `gw checkout feat/name --no-fetch`                                  |
| Navigate to worktree by name              | `gw cd feat/name`                                                   |
| Navigate by partial match                 | `gw cd feat` (matches first worktree with "feat")                   |
| Navigate to branch (even if in other wt)  | `gw checkout main`                                                  |
| List all worktrees                        | `gw list`                                                           |
| Check out a PR into a worktree            | `gw pr 123`                                                         |
| Check out a PR by URL                     | `gw pr https://github.com/user/repo/pull/123`                       |
| Update with main (merge or rebase)        | `gw update`                                                         |
| Update from specific branch               | `gw update --from develop`                                          |
| Sync auto-copy files to current worktree  | `gw sync`                                                           |
| Sync specific files                       | `gw sync .env .env.local`                                           |
| Remove worktree + delete local branch     | `gw remove feat/name`                                               |
| Remove worktree but keep branch           | `gw remove feat/name --preserve-branch`                             |
| Remove multiple worktrees by name         | `gw remove feat-a feat-b feat-c`                                    |
| Remove every worktree under a scope       | `gw remove feat/*` (with shell integration) or `gw remove 'feat/*'` |
| Remove every worktree starting with name  | `gw remove fix*` (greedy across `/`)                                |
| Preview a destructive `gw remove`         | `gw remove --dry-run feat/*`                                        |
| Batch remove safe (committed, pushed) wts | `gw clean`                                                          |
| Preview batch cleanup                     | `gw clean --dry-run`                                                |
| Full cleanup: worktrees + orphan branches | `gw prune`                                                          |
| Get repo root path (worktree-aware)       | `gw root`                                                           |

### Setup Commands

| Task                                          | Command                                                         |
| --------------------------------------------- | --------------------------------------------------------------- |
| Clone repo and configure gw (interactive)     | `gw init git@github.com:user/repo.git --interactive`            |
| Init gw in existing repo                      | `gw init --auto-copy-files .env --post-checkout "pnpm install"` |
| Show current gw config                        | `gw show-init`                                                  |
| Install shell integration (required for `cd`) | `eval "$(gw install-shell)"` (add to `~/.zshrc`)                |
| Remove shell integration                      | `gw install-shell --remove`                                     |

### Proxy Commands (pass-through to `git worktree`)

| Task                 | Command                      |
| -------------------- | ---------------------------- |
| Lock worktree        | `gw lock feat/name`          |
| Unlock worktree      | `gw unlock feat/name`        |
| Repair worktree      | `gw repair`                  |
| Move worktree        | `gw move feat/name new-path` |
| Prune stale metadata | `gw prune --stale-only`      |

## Key Principles

- **`gw checkout` is canonical.** `gw add` and `gw co` are aliases — prefer `gw checkout` in explanations.
- **One branch per worktree.** Same branch cannot be checked out in two worktrees. `gw checkout <existing>` detects this and navigates instead.
- **Remote probe before treating a branch as new.** `gw checkout` runs `git ls-remote` (3s timeout) so a teammate's freshly-pushed branch isn't silently forked locally. Use `--no-fetch` when offline.
- **Auto-copy beats manual copying.** Configure `autoCopyFiles` once in `gw init`; `.env`, secrets, etc. land in every new worktree.
- **Post-checkout hooks beat manual installs.** Wire `pnpm install` / equivalent so each worktree is ready immediately.
- **Shell integration is required for `cd`.** Without `eval "$(gw install-shell)"` in `~/.zshrc`, `gw cd` and auto-nav after `gw checkout` silently no-op.

## Typical Worktree Workflow

```bash
# 1. First-time repo setup (one-time per project)
gw init git@github.com:org/repo.git \
  --auto-copy-files .env,.env.local \
  --post-checkout "pnpm install" \
  --interactive

# 2. Start a feature
gw checkout feat/my-feature
# - creates worktree, copies .env, runs pnpm install, auto-navigates

# 3. Work, then update with main
gw update

# 4. Open a PR for review (in another terminal / worktree)
gw pr 456
# - fetches PR branch, creates worktree, copies .env, auto-navigates

# 5. Navigate between worktrees
gw cd feat/my-feature
gw checkout main        # navigates to main worktree (already checked out)

# 6. Extract staged WIP to a new branch
git add src/new-thing.ts
gw checkout feat/extracted --from-staged

# 7. Clean up when done
gw remove feat/my-feature   # removes worktree + local branch
gw clean                    # batch remove safe (committed + pushed) worktrees
gw prune                    # full cleanup: worktrees + orphan branches
```

## Config Reference

Config lives at `.gw/config.json` (committable) and `.gw/config.local.json` (gitignored, personal overrides):

```jsonc
{
  "defaultBranch": "main",
  "autoCopyFiles": [".env", ".env.local", "secrets/"],
  "hooks": {
    "checkout": {
      "pre": ["echo 'Creating: {worktree}'"],
      "post": ["pnpm install"],
    },
  },
  "cleanThreshold": 7, // days before worktrees are "stale" for gw clean
  "autoClean": true, // silently prune stale worktrees on gw checkout / gw list
  "updateStrategy": "merge", // "merge" | "rebase"
}
```

Hook variables: `{worktree}`, `{worktreePath}`, `{gitRoot}`, `{branch}`.

## Related Skills

- [gw-config-management](../gw-config-management/) - Configure auto-copy files and hooks
- [autonomous-workflow](https://github.com/mthines/agent-skills#autonomous-workflow) - Autonomous development in isolated worktrees (lives in `mthines/agent-skills`)

## Resources

- [Getting Started Example](./references/getting-started.md)
- [Parallel Development Example](./references/parallel-development.md)
- [Troubleshooting Guide](./references/troubleshooting-worktrees.md)
- [gw CLI Documentation](../../packages/gw-tool/README.md)
