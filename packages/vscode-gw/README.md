# GW Worktrees - VS Code Extension

Manage Git worktrees directly from the VS Code sidebar.

## Looking for Agent Tasks?

The Agent Tasks view has moved to a dedicated extension. Install **[Agent Tasks](https://marketplace.visualstudio.com/items?itemName=mthines.agent-tasks)** from the VS Code Marketplace to continue visualizing `plan.md`, `task.md`, and `walkthrough.md` artifacts from your autonomous workflow sessions.

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

| Setting               | Default | Description                                    |
| --------------------- | ------- | ---------------------------------------------- |
| `gw.watchInterval`    | `3000`  | File watch interval in milliseconds            |
| `gw.showBareWorktree` | `false` | Show bare repository in worktree list          |
| `gw.autoOpenWorktree` | `true`  | Auto-open new worktree in a new window         |

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for build instructions, publishing, and technical details.
