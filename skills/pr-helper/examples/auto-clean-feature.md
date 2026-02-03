# Example: Auto-Clean Feature PR

This example shows how to generate a PR description for the auto-clean interactive prompts feature.

## Context

User made changes to replace automatic background cleanup with interactive prompts. The changes include:
- New function for prompting users
- Updated commands to use prompts
- Updated tests and documentation

## Analysis

### Changed Files
```
M packages/gw-tool/README.md
M packages/gw-tool/src/commands/add.ts
M packages/gw-tool/src/commands/init.ts
M packages/gw-tool/src/commands/list.ts
M packages/gw-tool/src/lib/auto-clean.test.ts
M packages/gw-tool/src/lib/auto-clean.ts
M skills/config-management/SKILL.md
```

### Commits
```
3b1ad2a feat(auto-clean): implement interactive prompts for stale worktree cleanup
```

### Key Changes
- Added `promptAndRunAutoClean()` function
- Modified add.ts and list.ts to use interactive prompts
- Updated help text in init.ts
- Added 7 new tests
- Updated documentation

## Generated PR Description

```markdown
## Summary

Replaces automatic background cleanup with interactive prompts to prevent the CLI from appearing to freeze when checking for stale worktrees. Users now see a confirmation prompt and can choose to clean up immediately or skip.

## Changes

- Added `promptAndRunAutoClean()` function with interactive user prompts
- Updated `gw add` and `gw list` commands to use new prompt-based cleanup
- Modified `gw init` help text and prompts to reflect interactive behavior
- Added 7 comprehensive tests for prompt interactions (user accepts, declines, defaults)
- Updated README with new prompt format and behavior examples
- Enhanced skills documentation with autoClean configuration section

## Type

- [x] `feat` - New feature
- [ ] `fix` - Bug fix
- [ ] `docs` - Documentation only
- [ ] `refactor` - Code refactoring
- [ ] `test` - Adding or updating tests
- [ ] `chore` - Maintenance/tooling

## Testing

- Added 7 new unit tests covering all prompt scenarios (all passing)
- Manual testing with various user responses (y, n, empty, Enter)
- Verified cooldown behavior (24-hour limit on prompts)
- Tested with both enabled and disabled autoClean configs
- Confirmed backward compatibility with existing configurations

## Breaking Changes

- [x] No breaking changes
- [ ] Yes (describe below)

This is a UX improvement that changes behavior from silent background cleanup to interactive prompts. Users with `autoClean: true` will see prompts instead of silent cleanup, which is an improvement (fixes the freezing issue). No migration needed.

## Checklist

- [x] Code follows the project's style guidelines
- [x] Documentation has been updated (if applicable)
- [x] Tests have been added/updated (if applicable)
- [x] All tests pass locally
```

## Notes

- Primary type is "feat" because it adds a new user-facing feature (interactive prompts)
- Not a breaking change because it improves existing functionality without requiring user changes
- All documentation was updated, so documentation checklist item is checked
- Tests were added, so test checklist item is checked
