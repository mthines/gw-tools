---
paths: src/**/*.ts
---

# VS Code Extension Code Style

- Use explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Use `vscode.` prefix for VS Code API types (not bare imports)

## Command Registration

- Commands receive optional TreeItem argument from context menus
- Show QuickPick fallback when called from command palette (no item)
- Use `vscode.window.withProgress` for operations taking >500ms

## Error Handling

- Catch errors from git commands and show via `vscode.window.showErrorMessage`
- Extract message from Error objects: `err instanceof Error ? err.message : String(err)`

## File Operations

- Use `fs.existsSync` to check files before opening
- Use `path.join` for all path construction
