---
paths: src/**/*.test.ts
---

# Testing Guidelines

- Tests use vitest, run with `nx test vscode-gw`
- Test files use `.test.ts` suffix alongside source files

## What to Test

- Parser functions (git-worktree.ts)
- Pure utility functions without VS Code dependencies

## What NOT to Test

- VS Code API interactions (requires full extension host)
- TreeDataProvider implementations (test the data parsing instead)

## Test Structure

- Use `describe` blocks for grouping related tests
- Use `it('should X when Y')` naming pattern
- Test edge cases: empty input, malformed data, ANSI codes in output
