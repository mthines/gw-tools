---
title: "Phase 5: Documentation"
impact: MEDIUM
tags:
  - documentation
  - phase-5
---

# Phase 5: Documentation

## Overview

Update relevant documentation based on changes made.
Self-validate clarity by reading as a new user would.
Maintain style consistency with existing docs.

## Core Principles

- **Document user-facing changes**: README, guides.
- **Update CHANGELOG**: Every change gets an entry.
- **Test code examples**: Examples must actually work.
- **Read as new user**: Validate clarity.

## Procedure

### Step 1: Identify Documentation Needs

| Change Type | Documentation |
|-------------|---------------|
| User-facing feature | README, user guides |
| API changes | JSDoc/TSDoc, API reference |
| Configuration | Config docs, setup instructions |
| Breaking changes | CHANGELOG, migration guide |
| All changes | CHANGELOG entry |

### Step 2: Update README (If Applicable)

```markdown
### Dark Mode

The app now supports dark mode!

#### Using the UI
Click the theme toggle in the navigation bar.

#### Programmatically
\`\`\`typescript
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { theme, setTheme } = useTheme();
  setTheme(theme === 'light' ? 'dark' : 'light');
}
\`\`\`
```

**Validation:**
- Is it clear how to use the feature?
- Are code examples correct?
- Is it easy to find?

### Step 3: Update API Documentation

```typescript
/**
 * Theme context providing theme state and controls.
 *
 * @example
 * \`\`\`tsx
 * const { theme, setTheme } = useTheme();
 * \`\`\`
 */
export function useTheme(): ThemeContextValue {
  // ...
}
```

### Step 4: Update CHANGELOG

```markdown
## [Unreleased]

### Added
- Dark mode toggle in navigation bar (#123)
  - Respects system preference
  - Persists user choice to localStorage

### Changed
- Theme context exported from `@/contexts/ThemeContext`
```

### Step 5: Self-Validation

Read your documentation with fresh eyes:

**Clarity check:**
- Can I understand this without context?
- Are examples self-contained?

**Completeness check:**
- Are all new features documented?
- Are edge cases explained?

**Accuracy check:**
- Do code examples actually work?
- Are paths/names correct?

### Step 6: Commit Documentation

```bash
git add README.md CHANGELOG.md docs/
git commit -m "docs(feature): document dark mode toggle

- Add usage examples to README
- Update CHANGELOG
- Document theme context API"
```

## Documentation Checklist

- [ ] Documentation scope identified
- [ ] README updated (if applicable)
- [ ] API docs updated (if applicable)
- [ ] CHANGELOG entry added
- [ ] Code examples tested
- [ ] Self-validated for clarity
- [ ] Style consistent with project
- [ ] Ready for PR creation

## References

- Related rule: [phase-4-testing](./phase-4-testing.md)
- Related rule: [phase-6-pr-creation](./phase-6-pr-creation.md)
