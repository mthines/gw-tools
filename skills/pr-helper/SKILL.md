---
name: "@gw-pr-helper"
description: Generate GitHub pull request descriptions by analyzing changes between current branch and main. Use this skill when creating PRs, filling out PR templates, or when users ask to "create a PR", "prepare a PR description", or "fill in the PR template". Automatically detects change types, summarizes commits, and generates comprehensive PR descriptions.
license: MIT
metadata:
  author: mthines
  version: "1.0.0"
---

# PR Helper - Generate Pull Request Descriptions

This skill helps you create comprehensive GitHub pull request descriptions by analyzing the changes between your current branch and the main branch.

## When to Use This Skill

Use this skill when:
- Creating a new pull request
- Users ask "create a PR" or "prepare PR description"
- Filling out the PR template
- Summarizing changes for code review
- Need to understand what changed in a branch

## What This Skill Does

1. **Analyzes Changes**: Compares current branch with main to identify all changes
2. **Categorizes Changes**: Identifies change types (feat, fix, docs, etc.)
3. **Summarizes Commits**: Extracts key information from commit messages
4. **Generates Description**: Creates a complete PR description following the template
5. **Identifies Breaking Changes**: Detects potential breaking changes
6. **Lists Modified Files**: Shows which files were changed and why

## Quick Start (For LLMs)

When user asks to create a PR, follow these steps:

1. **Gather information:**
   ```bash
   git branch --show-current
   git log main..HEAD --oneline
   git diff main...HEAD --name-status
   ```

2. **Identify change type** from commits (feat/fix/docs/refactor/test/chore)

3. **Generate PR description** using the template structure:
   - Summary (1-2 sentences)
   - Changes (3-7 bullet points)
   - Type (check primary type)
   - Testing (how changes were tested)
   - Breaking Changes (yes/no + explanation)
   - Checklist (mark completed items)

4. **Create draft PR:**
   ```bash
   gh pr create --draft --title "type(scope): description" --body "[generated description]"
   ```

See the detailed sections below for comprehensive guidance on each step.

## How to Use This Skill

### Step 1: Analyze the Current Branch

First, gather information about the changes:

```bash
# Get current branch name
git branch --show-current

# Compare with main branch
git diff main...HEAD --name-status

# Get commit messages since main
git log main..HEAD --oneline

# Get detailed diff statistics
git diff main...HEAD --stat
```

### Step 2: Read Changed Files

For each modified file, understand what changed:

```bash
# Read the actual changes
git diff main...HEAD -- <file-path>

# For key files, read the full content to understand context
```

Focus on:
- **Source files** (`*.ts`, `*.js`): New features, bug fixes, refactoring
- **Documentation** (`*.md`): Documentation updates
- **Tests** (`*.test.ts`, `*.spec.ts`): Test coverage
- **Configuration** (`*.json`, `*.yaml`): Config changes

### Step 3: Identify Change Type

Based on the files and commits, determine the primary change type:

- **feat**: New features or enhancements
  - New commands, new functions, new capabilities
  - Example: "feat(auto-clean): add interactive prompts"

- **fix**: Bug fixes
  - Fixing broken functionality, correcting errors
  - Example: "fix(PKGBUILD): add missing options"

- **docs**: Documentation changes only
  - README updates, skill documentation, comments
  - Example: "docs: update installation instructions"

- **refactor**: Code restructuring without behavior change
  - Reorganizing code, improving structure
  - Example: "refactor(utils): extract helper functions"

- **test**: Adding or updating tests
  - New test cases, test improvements
  - Example: "test(auto-clean): add prompt interaction tests"

- **chore**: Maintenance, tooling, dependencies
  - Build scripts, dependencies, CI/CD
  - Example: "chore: update dependencies"

### Step 4: Generate PR Description

Fill in each section of the PR template:

#### **Summary**
Write 1-2 sentences describing the main purpose:
- What problem does this solve?
- What new capability does this add?

**Good examples:**
- "Replaces automatic background cleanup with interactive prompts to prevent CLI freezing"
- "Adds support for custom worktree templates with variable substitution"
- "Fixes crash when running `gw clean` with no stale worktrees"

**Bad examples:**
- "Updated files" (too vague)
- "Changed auto-clean to use prompts and updated tests and docs and fixed some bugs" (too detailed for summary)

#### **Changes**
List the key changes (3-7 items):
- Focus on user-facing changes
- Include technical changes if significant
- Use bullet points

**Example:**
```markdown
- Added `promptAndRunAutoClean()` function for interactive cleanup
- Updated `gw add` and `gw list` to show cleanup prompts
- Modified help text and init prompts to reflect new behavior
- Added 7 new tests for prompt interactions
- Updated README and skills documentation
```

#### **Type**
Check the primary type based on Step 3 analysis.

If multiple types apply, choose the most significant:
- Prioritize: feat > fix > refactor > docs > test > chore

#### **Testing**
Describe how changes were tested:

**For code changes:**
```markdown
- Added unit tests (X passing)
- Manual testing of prompts with various responses
- Verified backward compatibility with existing configs
```

**For documentation:**
```markdown
- Reviewed all updated docs for accuracy
- Verified code examples compile and run correctly
```

#### **Breaking Changes**
Analyze if changes break existing functionality:

**Breaking change indicators:**
- Changes to public API or command signatures
- Removed or renamed commands/options
- Changed default behavior in incompatible ways
- Modified config schema (removed fields)

**Not breaking:**
- New optional features
- Internal refactoring
- Bug fixes that restore intended behavior
- Documentation updates
- Additions to config (with defaults)

### Step 5: Generate the Complete PR Description

Combine all sections into the template format:

```markdown
## Summary

[1-2 sentence summary from Step 4]

## Changes

- [Key change 1]
- [Key change 2]
- [Key change 3]
...

## Type

- [x] `[primary-type]` - [Description]
- [ ] Other types...

## Testing

- [Testing approach 1]
- [Testing approach 2]

## Breaking Changes

- [x] No breaking changes

OR

- [x] Yes (describe below)

[Description of breaking changes and migration path]

## Checklist

- [x] Code follows the project's style guidelines
- [x] Documentation has been updated (if applicable)
- [x] Tests have been added/updated (if applicable)
- [x] All tests pass locally
```

## Example: Complete Workflow

### User Request
> "Can you create a PR for the auto-clean changes?"

### Step 1: Analyze Changes

```bash
$ git branch --show-current
autoclean

$ git log main..HEAD --oneline
3b1ad2a feat(auto-clean): implement interactive prompts for stale worktree cleanup
```

### Step 2: Check Modified Files

```bash
$ git diff main...HEAD --name-status
M packages/gw-tool/README.md
M packages/gw-tool/src/commands/add.ts
M packages/gw-tool/src/commands/init.ts
M packages/gw-tool/src/commands/list.ts
M packages/gw-tool/src/lib/auto-clean.test.ts
M packages/gw-tool/src/lib/auto-clean.ts
M skills/config-management/SKILL.md
```

### Step 3: Identify Type
- Primary type: **feat** (new interactive prompt feature)
- Secondary: docs (README and skills updated)

### Step 4: Generate Description

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

## Tips for LLMs

### Quick Analysis Commands

Use these commands to gather all necessary information quickly:

```bash
# Get everything in one go
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

### Common Patterns

**Feature Addition:**
- Type: `feat`
- Look for: New files, new functions, new commands
- Breaking: Usually no (unless removing old way)

**Bug Fix:**
- Type: `fix`
- Look for: Error handling, edge cases, corrections
- Breaking: No (fixes restore intended behavior)

**Documentation Update:**
- Type: `docs`
- Look for: Only `*.md` files changed
- Breaking: Never

**Refactoring:**
- Type: `refactor`
- Look for: File moves, function extraction, reorganization
- Breaking: Should not (by definition)

### Red Flags for Breaking Changes

Watch for these patterns:
- Removing or renaming CLI commands
- Changing command option names or behavior
- Removing config options
- Changing default values that affect existing users
- Modifying function signatures in public API

### Quality Checklist

Before finalizing the PR description:
- [ ] Summary is concise (1-2 sentences)
- [ ] Changes list is comprehensive but not overwhelming (3-7 items)
- [ ] Type is correctly identified based on primary change
- [ ] Testing section describes actual test approach
- [ ] Breaking changes are accurately assessed
- [ ] All checklist items are checked (if true)

## Troubleshooting

**Problem**: Not sure what type to choose
- **Solution**: If multiple types apply, prioritize: feat > fix > refactor > docs

**Problem**: Too many changes to list
- **Solution**: Group related changes, focus on user-facing impacts

**Problem**: Unsure if breaking
- **Solution**: Ask: "Would existing users need to change their code/config?" If no, not breaking.

**Problem**: Can't find test information
- **Solution**: Check for `*.test.ts` files in the diff, run `git diff main...HEAD --stat` to see test file changes

## Creating the Pull Request

Once you've generated the PR description, create a **draft** pull request using the GitHub CLI:

```bash
# Create draft PR with the generated description
gh pr create --draft --title "feat(component): brief description" --body-file pr-description.md

# Or pipe the description directly
echo "## Summary
..." | gh pr create --draft --title "feat: description" --body -

# Or use heredoc for multi-line
gh pr create --draft --title "feat: description" --body "$(cat <<'EOF'
## Summary

Your PR description here...

## Changes

- Change 1
- Change 2
EOF
)"
```

**Important:** Always use the `--draft` flag. Draft PRs allow for:
- Review and refinement before marking ready
- CI/CD checks to run before official review
- Additional commits without notifying reviewers
- Flexibility to adjust the description

The user will manually convert the draft to a ready-for-review PR in the GitHub UI when ready.

## Advanced: Multi-Package Changes

For changes spanning multiple packages in the monorepo:

1. Group changes by package in the Changes section
2. Note if changes are coordinated (e.g., "Updated both CLI and docs for consistency")
3. Consider if cross-package changes indicate breaking changes

```markdown
## Changes

**gw-tool package:**
- Added interactive cleanup prompts
- Updated commands to use new prompt system

**Skills documentation:**
- Added autoClean configuration documentation
- Updated examples to reflect new behavior
```
