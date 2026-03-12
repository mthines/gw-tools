# vscode-gw

VS Code extension for Git worktree management and autonomous agent workflow visualization.

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
    agent-tasks-provider # Agent tasks view
  parsers/               # Git and markdown parsing utilities
  watchers/              # File system watchers for .gw/ artifacts
```

## Key Concepts

- **Worktrees**: Parsed from `git worktree list --porcelain`
- **Agent Tasks**: Read from `.gw/{branch}/` directories (task.md, plan.md, walkthrough.md)
- **Artifact Watcher**: Watches `.gw/` for changes, triggers view refresh

## Extension Manifest

All commands, views, settings, and keybindings are defined in `package.json`:
- Commands: `contributes.commands`
- Views: `contributes.views` (gwWorktreeExplorer, gwAgentTasks)
- Settings: `contributes.configuration` (gw.* namespace)
- Keybindings: `contributes.keybindings`

## Code Style

- Use `vscode.window.withProgress` for long-running operations
- Commands accept optional TreeItem for context menu invocation
- Fall back to QuickPick when no item provided
- Use `openMarkdownFile()` helper for consistent markdown opening behavior

## Testing

- Unit tests use vitest with `.test.ts` suffix
- Test parsers directly (no VS Code API mocking needed)
- Parser tests cover edge cases in git output and markdown formats

## Gotchas

- VS Code API only available in extension context, not in tests
- `vscode` import will fail in vitest - isolate parsers from VS Code types
- ANSI codes must be stripped from gw CLI output before display
