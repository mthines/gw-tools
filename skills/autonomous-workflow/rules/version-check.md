---
title: 'Version Check'
impact: HIGH
tags:
  - version
  - update
  - preflight
---

# Version Check

## Overview

Before starting any autonomous workflow, check whether the installed skill version matches the latest available version. This ensures users benefit from the latest improvements, bug fixes, and new features.

**This check runs before Phase 0, but only prompts if the user hasn't already skipped the detected version.**

## Skip Persistence

When a user declines an update, record the skipped version in `.gw/.skipped-skill-versions.json`:

```json
{
  "autonomous-workflow": "2.1.0"
}
```

This file lives in `.gw/` (already gitignored) and persists across conversations. The user is only prompted again when a *newer* version than their previously skipped version becomes available.

## Procedure

### Step 1: Read Local Version

Extract the `version` field from the installed SKILL.md metadata block:

```yaml
metadata:
  version: 'X.Y.Z'  # ← this value
```

### Step 2: Fetch Latest Version

Use WebFetch to retrieve the latest SKILL.md from the main branch:

```
https://raw.githubusercontent.com/mthines/gw-tools/main/skills/autonomous-workflow/SKILL.md
```

Extract the `version` field from the fetched content's metadata block.

### Step 3: Compare Versions

| Scenario                     | Action                                            |
| ---------------------------- | ------------------------------------------------- |
| Versions match               | Proceed silently                                  |
| Fetch fails (network error)  | Proceed silently — do not block on network issues |
| Local version is older       | Check skip file, then **maybe prompt** (see below)|
| Local version is newer (dev) | Proceed silently — likely a development build     |

### Step 4: Check Skip File

If local version is older than latest, read `.gw/.skipped-skill-versions.json`:

| Skip File State                                        | Action                          |
| ------------------------------------------------------ | ------------------------------- |
| File missing or unreadable                             | Prompt user                     |
| `autonomous-workflow` key missing                      | Prompt user                     |
| Skipped version **equals** latest version              | **Proceed silently** — already declined this version |
| Skipped version is **older than** latest version       | Prompt user — a newer version is available           |

### Step 5: Prompt User (if needed)

When prompting, be clear and concise:

```markdown
**Skill Update Available**

Your `autonomous-workflow` skill is on version **{local_version}**, but **{latest_version}** is available.

To update, run:
```bash
npx skills add https://github.com/mthines/gw-tools --skill @gw-autonomous-workflow
```

Would you like to:
1. **Update now** — I'll wait while you update, then we continue
2. **Skip** — Continue with the current version (won't ask again for this version)
```

### Step 6: Handle User Response

| User Response     | Action                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Update now        | Wait for user to confirm update is complete, then proceed                                           |
| Skip / decline    | Write latest version to `.gw/.skipped-skill-versions.json`, then proceed immediately                |
| No clear response | Ask once more, then proceed if still unclear                                                        |

**When writing the skip file**, create `.gw/` if it doesn't exist, and merge with existing content (other skills may store their skipped versions too):

```bash
# Pseudocode
read existing .gw/.skipped-skill-versions.json (or start with {})
set "autonomous-workflow" = "{latest_version}"
write back to .gw/.skipped-skill-versions.json
```

## Version Comparison Logic

Use semantic versioning comparison:

1. Split both versions on `.` to get `[major, minor, patch]`
2. Compare major first, then minor, then patch
3. Local is outdated if any component is less than the latest (respecting precedence)

**Examples:**

| Local   | Latest  | Result     |
| ------- | ------- | ---------- |
| `2.0.0` | `2.0.0` | Up to date |
| `2.0.0` | `2.1.0` | Outdated   |
| `1.9.9` | `2.0.0` | Outdated   |
| `2.1.0` | `2.0.0` | Newer (dev)|

## Error Handling

- **Network failure:** Proceed without prompting. Version check is best-effort.
- **Parse failure:** If the fetched content doesn't contain a valid version, proceed silently.
- **GitHub rate limit:** Proceed without prompting.
- **Skip file write failure:** Proceed without persisting — user may be prompted again next session.

The version check must NEVER block the workflow. It is advisory only.

## References

- Related rule: [overview](./overview.md)
- Related rule: [phase-0-validation](./phase-0-validation.md)
