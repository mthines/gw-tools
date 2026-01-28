---
name: update-docs
description: Update the project documentation files based on code changes
---

# Update Documentation Files

You are tasked with updating documentation to reflect recent code changes.

## Step 1: Analyze Changes

First, check the git diff to understand what has changed:

```bash
git diff --name-only HEAD~1..HEAD
git diff HEAD~1..HEAD -- "*.ts"
```

If there are no committed changes, check unstaged changes:

```bash
git diff --name-only
git diff -- "*.ts"
```

## Step 2: Identify Affected Documentation

Based on the changes, determine which documentation files need updates:

### Code Files -> Documentation Mapping

| Changed File | Documentation to Update |
|--------------|------------------------|
| `packages/gw-tool/src/commands/*.ts` | README, Skills docs, CLI help text in the command file |
| `packages/gw-tool/src/lib/*.ts` | README if user-facing behavior changed |
| `packages/gw-tool/src/lib/cli.ts` | README command reference |

### Documentation Files to Check

1. **Main README**: `packages/gw-tool/README.md`
   - Command usage and examples
   - Feature descriptions
   - Configuration options

2. **Skills Documentation**:
   - `skills/config-management/SKILL.md` - Configuration-related features
   - `skills/git-worktree-workflows/SKILL.md` - Worktree workflow features
   - `skills/multi-worktree-dev/SKILL.md` - Multi-worktree development features

3. **CLI Help Text**: Update `showXxxHelp()` functions in command files

4. **Examples**: Check `skills/*/examples/` for outdated references

## Step 3: Update Documentation

For each affected documentation file:

1. **Read the current documentation**
2. **Identify sections that reference the changed functionality**
3. **Update those sections to reflect the new behavior**
4. **Ensure examples are accurate and working**

### Documentation Style Guidelines

- Use clear, concise language
- Include code examples where helpful
- Document both the "what" and "why"
- Keep CLI help text brief but informative
- Use consistent formatting across all docs

## Step 4: Verify Changes

After updating documentation:

1. **Check CLI help text compiles**: `nx run gw-tool:check`
2. **Ensure examples are syntactically correct**
3. **Verify cross-references between docs are valid**

## Output

Provide a summary of:
- Which files were analyzed
- Which documentation files were updated
- What changes were made to each file
