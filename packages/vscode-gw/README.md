# GW Worktrees - VS Code Extension

Manage Git worktrees directly from the VS Code sidebar.

> ## 📦 Agent Tasks has moved
>
> Starting in **v0.69.0**, the Agent Tasks view (visualizing `plan.md`, `task.md`, and `walkthrough.md` from autonomous workflow sessions) is no longer part of this extension. It now lives in its own dedicated extension:
>
> ### → [Install Agent Tasks from the Marketplace](https://marketplace.visualstudio.com/items?itemName=mthines.agent-tasks)
>
> **Why?** The autonomous workflow no longer depends on the `gw` CLI, so the artifact viewer was decoupled and now ships from [`mthines/agent-skills`](https://github.com/mthines/agent-skills) where the workflow itself lives.
>
> **What's different in the new extension?**
>
> - Defaults to scanning `.agent/` directories (with `.gw/` as fallback)
> - The directory list is **configurable** via `agentTasks.directories`
> - Settings moved from `gw.*` → `agentTasks.*` (you'll re-pick your preferences once)
> - View IDs and command IDs renamed to `agentTasks.*`
>
> **Existing users:** the first time this extension activates after upgrading, you'll see a one-time prompt with an "Install" button to switch to the new extension. Closing the prompt without choosing keeps it active for next session.

## Features

### Worktree Explorer

- **List all worktrees** in the sidebar with branch name, path, and current status
- **Open worktrees** in the current window or a new window with a single click
- **Create worktrees** using `gw checkout` directly from VS Code
- **Remove worktrees** with confirmation dialog
- Highlights the currently active worktree

### File Watching

The extension watches for worktree changes and automatically refreshes the sidebar view.

## Sidebar Views

The extension adds a "gw" activity bar icon with one view:

1. **Worktrees** - All git worktrees in the repository

## Commands

| Command                               | Description                                    |
| ------------------------------------- | ---------------------------------------------- |
| `GW: Refresh Worktrees`               | Refresh the worktree list                      |
| `GW: Create Worktree`                 | Create a new worktree via `gw checkout`        |
| `GW: Open Worktree in New Window`     | Open selected worktree in a new VS Code window |
| `GW: Open Worktree in Current Window` | Switch to selected worktree                    |
| `GW: Remove Worktree`                 | Remove a worktree (with confirmation)          |

## Settings

| Setting               | Default | Description                            |
| --------------------- | ------- | -------------------------------------- |
| `gw.watchInterval`    | `3000`  | File watch interval in milliseconds    |
| `gw.showBareWorktree` | `false` | Show bare repository in worktree list  |
| `gw.autoOpenWorktree` | `true`  | Auto-open new worktree in a new window |

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for build instructions, publishing, and technical details.
