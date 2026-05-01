# vscode-gw

VS Code extension for Git worktree management.

## Commands

```bash
# Development
nx dev vscode-gw         # Watch mode with esbuild

# Build
nx build vscode-gw       # Build extension
nx package vscode-gw     # Create .vsix package

# Testing
nx test vscode-gw        # Run vitest tests
nx lint vscode-gw        # Run ESLint

# Publishing
nx release vscode-gw     # Publish to VS Code Marketplace + Open VSX
nx release vscode-gw --configuration=dry-run  # Dry-run release
```

## Architecture

```
src/
  extension.ts           # Entry point, command registration
  providers/             # TreeDataProviders for sidebar views
    worktree-provider    # Worktree explorer view
  parsers/               # Git parsing utilities
    git-worktree.ts      # Parses `git worktree list --porcelain`
  watchers/              # File system watchers
    worktree-watcher.ts  # Watches for worktree changes
```

## Key Concepts

- **Worktrees**: Parsed from `git worktree list --porcelain`
- **WorktreeWatcher**: Watches `.git/worktrees/` for changes, triggers view refresh

## Extension Manifest

All commands, views, settings, and keybindings are defined in `package.json`:

- Commands: `contributes.commands`
- Views: `contributes.views` (gwWorktreeExplorer)
- Settings: `contributes.configuration` (gw.\* namespace)
- Keybindings: `contributes.keybindings`

## Code Style

- Use `vscode.window.withProgress` for long-running operations
- Commands accept optional TreeItem for context menu invocation
- Fall back to QuickPick when no item provided
- **Always use `stripAnsi()` on CLI output** before displaying in notifications, dialogs, or error messages. The `gw` CLI outputs colored text with ANSI escape codes that VS Code doesn't render.

## Structured Progress (--progress=json)

The `createWorktreeWithProgress` and `createWorktreeFromStagedWithProgress` functions in `parsers/git-worktree.ts` use `cp.spawn` + `--progress=json` to stream NDJSON progress events from the gw CLI. These are the progress-aware replacements for `createWorktree` and `createWorktreeFromStaged`.

Key helpers:
- `parseProgressEvent(line)` — parses a single stderr line; returns a typed `GwProgressEvent` or `undefined`
- `progressEventToLabel(event)` — maps a start event to a VS Code notification subtitle string
- `HookFailureError` — thrown by the spawn-based functions when a hook error event is detected

Hook failure handling in `extension.ts`:
- Pre-checkout hook failure: `showErrorMessage` (worktree NOT created, fatal)
- Post-checkout hook failure: `showWarningMessage` with "Show Output" / "Open Worktree" buttons (worktree WAS created, non-fatal)

Only `start` events update `progress.report({ message })`. `end` and `error` events are handled separately.

## Testing

- Unit tests use vitest with `.test.ts` suffix
- Test parsers directly (no VS Code API mocking needed)
- Parser tests cover edge cases in git output formats

## Gotchas

- VS Code API only available in extension context, not in tests
- `vscode` import will fail in vitest - isolate parsers from VS Code types
- ANSI codes must be stripped from gw CLI output before display
