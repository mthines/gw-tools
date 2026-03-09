# GW Worktrees - VS Code Extension

Manage Git worktrees and visualize autonomous agent workflows directly from the VS Code sidebar.

## Features

### Worktree Explorer

- **List all worktrees** in the sidebar with branch name, path, and current status
- **Open worktrees** in the current window or a new window with a single click
- **Create worktrees** using `gw checkout` directly from VS Code
- **Remove worktrees** with confirmation dialog
- Highlights the currently active worktree

### Agent Tasks

- **Visualize task progress** from `.gw/{branch}/task.md` files in real-time
- **Track phases** - see which workflow phase each agent branch is in
- **View task breakdown** - completed, current (with spinner), and upcoming items
- **Monitor blockers** and decisions at a glance
- **Plan overview** - see the implementation plan with files to create/modify
- **Auto-opens walkthrough.md** when an agent completes work (Phase 6)

### File Watching

The extension watches `.gw/` artifact files for changes and automatically refreshes the sidebar views. When a `walkthrough.md` is created (signaling task completion), it opens automatically.

## Sidebar Views

The extension adds a "GW Worktrees" activity bar icon with two views:

1. **Worktrees** - All git worktrees in the repository
2. **Agent Tasks** - Active autonomous workflow tasks from `.gw/` directory

## Commands

| Command | Description |
| --- | --- |
| `GW: Refresh Worktrees` | Refresh the worktree list |
| `GW: Create Worktree` | Create a new worktree via `gw checkout` |
| `GW: Open Worktree in New Window` | Open selected worktree in a new VS Code window |
| `GW: Open Worktree in Current Window` | Switch to selected worktree |
| `GW: Remove Worktree` | Remove a worktree (with confirmation) |
| `GW: Open Plan` | Open the plan.md for an agent branch |
| `GW: Open Task File` | Open the task.md for an agent branch |
| `GW: Open Walkthrough` | Open the walkthrough.md for a completed branch |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `gw.autoOpenWalkthrough` | `true` | Auto-open walkthrough.md when created |
| `gw.watchInterval` | `3000` | File watch interval in milliseconds |
| `gw.showBareWorktree` | `false` | Show bare repository in worktree list |

## Development

```bash
# Build the extension
nx build vscode-gw

# Package as .vsix
nx package vscode-gw

# Watch mode for development
cd packages/vscode-gw && node esbuild.config.mjs --watch
```

## How It Works

The extension reads data from two sources:

1. **Git worktree list** (`git worktree list --porcelain`) - for the worktree explorer
2. **`.gw/` directory** - for agent task visualization, parsing the markdown artifacts (task.md, plan.md, walkthrough.md) created by the autonomous workflow agent

The artifact files follow the format defined in the [autonomous-workflow skill](../../skills/autonomous-workflow/SKILL.md).
