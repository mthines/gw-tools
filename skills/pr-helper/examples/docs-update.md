# Example: Documentation Update PR

This example shows how to generate a PR description for a documentation-only change.

## Context

User updated installation instructions in the README to include shell integration setup steps.

## Analysis

### Changed Files
```
M packages/gw-tool/README.md
```

### Commits
```
2b9c7a8 docs: update installation instructions for gw CLI tool to include shell integration
```

### Key Changes
- Only documentation files changed
- Added shell integration setup steps
- Updated installation section with new instructions

## Generated PR Description

```markdown
## Summary

Updates the installation instructions in the README to include the shell integration setup steps, making it easier for new users to configure `gw` navigation correctly.

## Changes

- Added shell integration installation section to README
- Updated installation steps with explicit `gw install-shell` command
- Clarified manual vs automatic installation options

## Type

- [ ] `feat` - New feature
- [ ] `fix` - Bug fix
- [x] `docs` - Documentation only
- [ ] `refactor` - Code refactoring
- [ ] `test` - Adding or updating tests
- [ ] `chore` - Maintenance/tooling

## Testing

- Reviewed documentation for accuracy and clarity
- Verified all code snippets are correct
- Confirmed links and formatting render properly

## Breaking Changes

- [x] No breaking changes
- [ ] Yes (describe below)

## Checklist

- [x] Code follows the project's style guidelines
- [x] Documentation has been updated (if applicable)
- [ ] Tests have been added/updated (if applicable)
- [ ] All tests pass locally
```

## Notes

- Type is "docs" because only documentation files were changed
- No code changes means test checklist item is unchecked (not applicable)
- Breaking changes are never applicable for documentation-only PRs
- Testing section focuses on documentation verification rather than code tests
