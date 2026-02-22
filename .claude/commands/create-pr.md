---
name: create-pr
description: Generate a comprehensive GitHub pull request description by analyzing changes between the current branch and main
---

# Generate Pull Request Description

Generate a comprehensive GitHub pull request description by analyzing changes between the current branch and main.

## Usage

When the user asks to "create a PR" or "prepare PR description", follow these steps:

## Step 1: Gather Information

```bash
# Get current branch and changes
git branch --show-current
git log main..HEAD --oneline
git diff main...HEAD --name-status
git diff main...HEAD --stat
```

## Step 2: Identify Change Type

Based on commit messages (which follow [Conventional Commits](https://www.conventionalcommits.org/)):

- **feat**: New features or enhancements
- **fix**: Bug fixes
- **docs**: Documentation only
- **refactor**: Code restructuring
- **test**: Test additions/updates
- **chore**: Maintenance/tooling

## Step 3: Generate PR Description

Fill in the template at `.github/pull_request_template.md`:

### Summary (1-2 sentences)

- What problem does this solve?
- What new capability does this add?

### Changes (3-7 bullet points)

- Focus on key user-facing changes
- Include significant technical changes
- Group related items

### Type

- Check the primary type
- If multiple apply, prioritize: feat > fix > refactor > docs > test > chore

### Testing

- How were changes tested?
- For code: unit tests, manual testing, verification
- For docs: review, example verification

### Breaking Changes

**Breaking if:**

- Changes to public API or command signatures
- Removed/renamed commands or options
- Changed default behavior incompatibly
- Modified config schema (removed fields)

**Not breaking:**

- New optional features
- Bug fixes restoring intended behavior
- Documentation updates
- Config additions with defaults

## Step 4: Push Branch and Create Draft PR

First push the branch to the remote (required for `gh pr create`), then create as **draft**:

```bash
# Push the branch first (tracking is already configured by gw add)
git push

# Create the draft PR
gh pr create --draft \
  --title "type(scope): brief description" \
  --body "$(cat <<'EOF'
## Summary

[Your summary here]

## Changes

- Change 1
- Change 2

## Type

- [x] `type` - Description
- [ ] Other types...

## Testing

- Test approach 1
- Test approach 2

## Breaking Changes

- [x] No breaking changes

## Checklist

- [x] Code follows the project's style guidelines
- [x] Documentation has been updated (if applicable)
- [x] Tests have been added/updated (if applicable)
- [x] All tests pass locally
EOF
)"
```

## Quick Analysis Commands

```bash
# Get everything needed
{
  echo "=== Current Branch ==="
  git branch --show-current

  echo -e "\n=== Commits Since Main ==="
  git log main..HEAD --oneline

  echo -e "\n=== Changed Files ==="
  git diff main...HEAD --name-status

  echo -e "\n=== Change Statistics ==="
  git diff main...HEAD --stat
}
```

## Examples

### Feature Addition

```markdown
## Summary

Replaces automatic background cleanup with interactive prompts to prevent the CLI from appearing to freeze when checking for stale worktrees.

## Changes

- Added `promptAndRunAutoClean()` function with interactive user prompts
- Updated `gw add` and `gw list` commands to use new prompt-based cleanup
- Modified `gw init` help text to reflect interactive behavior
- Added 7 comprehensive tests for prompt interactions
- Updated README and skills documentation

## Type

- [x] `feat` - New feature
- [ ] `fix` - Bug fix
- [ ] `docs` - Documentation only
- [ ] `refactor` - Code refactoring
- [ ] `test` - Adding or updating tests
- [ ] `chore` - Maintenance/tooling

## Testing

- Added 7 new unit tests (all passing)
- Manual testing with various user responses
- Verified backward compatibility

## Breaking Changes

- [x] No breaking changes
- [ ] Yes (describe below)

## Checklist

- [x] Code follows the project's style guidelines
- [x] Documentation has been updated (if applicable)
- [x] Tests have been added/updated (if applicable)
- [x] All tests pass locally
```

### Documentation Only

```markdown
## Summary

Updates installation instructions to include shell integration setup steps.

## Changes

- Added shell integration installation section to README
- Updated installation steps with `gw install-shell` command
- Clarified manual vs automatic installation options

## Type

- [ ] `feat` - New feature
- [ ] `fix` - Bug fix
- [x] `docs` - Documentation only
- [ ] `refactor` - Code refactoring
- [ ] `test` - Adding or updating tests
- [ ] `chore` - Maintenance/tooling

## Testing

- Reviewed documentation for accuracy
- Verified code snippets are correct

## Breaking Changes

- [x] No breaking changes
- [ ] Yes (describe below)

## Checklist

- [x] Code follows the project's style guidelines
- [x] Documentation has been updated (if applicable)
- [ ] Tests have been added/updated (if applicable)
- [ ] All tests pass locally
```

## Tips

- **Multiple types?** Choose the most significant (feat > fix > refactor > docs)
- **Too many changes?** Group related items, focus on user impact
- **Unsure about breaking?** Ask: "Do users need to change their code/config?"
- **Multi-package changes?** Group by package in the Changes section
- **Always push first!** `gh pr create` requires the branch to exist on the remote. When using `gw add`, tracking is pre-configured so `git push` works without `-u`
