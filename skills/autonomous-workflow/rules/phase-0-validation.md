---
title: 'Phase 0: Validation & Questions'
impact: CRITICAL
tags:
  - validation
  - questions
  - mandatory
  - phase-0
---

# Phase 0: Validation & Questions (MANDATORY)

## Overview

This phase is MANDATORY.
Never skip directly to implementation.
Understand requirements completely before any code changes.

## Core Principles

- **No assumptions**: Ask about anything unclear.
- **Surface edge cases early**: Identify potential issues upfront.
- **Get explicit confirmation**: User must approve understanding.
- **Define "done"**: Clear acceptance criteria before starting.

## Procedure

### Step 1: Parse User Request

Read the request carefully. Identify:

- Primary feature/fix being requested
- Mentioned technologies, files, or patterns
- Implied requirements (what's assumed but not stated)
- Missing information (what's unclear)

### Step 2: Analyze Codebase Context

Before asking questions, understand the project:

- Project structure (monorepo? single app?)
- Technology stack (framework, language, tools)
- Testing setup (unit, integration, e2e?)
- Documentation patterns (where docs live)
- Existing similar features (patterns to follow)

Tools: `nx_workspace`, `nx_project_details`, `Read`, `Glob`, `Grep`

### Step 3: Formulate Clarifying Questions

Ask about:

**Requirements clarity:**

- "Should X feature also handle Y scenario?"
- "What should happen when Z edge case occurs?"

**Scope boundaries:**

- "Should this include tests/docs/migrations?"
- "Are we updating existing feature or adding new?"

**Technical decisions:**

- "Prefer approach A (simpler) or B (more flexible)?"
- "Follow pattern X from file.ts or pattern Y from other.ts?"

**Acceptance criteria:**

- "How will we know this is complete?"
- "What tests should pass?"

### Step 4: Present Understanding

Summarize your understanding:

```markdown
Based on your request, I understand:

1. **Goal**: [primary objective]
2. **Scope**: [what's included/excluded]
3. **Approach**: [technical approach]
4. **Tests**: [validation strategy]
5. **Docs**: [documentation updates]

Questions before proceeding:

- [Question 1]
- [Question 2]

Does this match your intent?
```

### Step 5: Get Explicit Confirmation

Wait for user response. Do NOT proceed until:

- All questions answered
- Understanding validated
- Scope confirmed
- User explicitly says "proceed" or equivalent

If user clarifies/corrects:

- Update your understanding
- Re-validate if significant changes
- Confirm again before proceeding

**⚠️ IMPORTANT: Every detail discussed in this phase — requirements, decisions, alternatives considered, edge cases, rationale, out-of-scope items — MUST be captured in plan.md during Phase 1. The plan.md serves as the complete context record. A new Claude session should be able to execute the plan from plan.md alone without needing the original conversation.**

### Step 6: Detect Workflow Mode

**After user confirmation, before Phase 1:**

#### 6a. Determine Mode

Analyze the confirmed scope:

| Mode     | Criteria                             | Artifacts    |
| -------- | ------------------------------------ | ------------ |
| **Full** | 4+ files OR complex/architectural    | **REQUIRED** |
| **Lite** | 1-3 files AND simple/straightforward | Skip         |

**When in doubt, choose Full Mode.**

#### 6b. Announce Mode Selection

State explicitly:

> "This is a **Full Mode** task (affects X files). Artifacts will be created after worktree setup."

or

> "This is a **Lite Mode** task (Y files, simple fix). Proceeding without artifacts."

**⚠️ IMPORTANT: Do NOT create artifact files here.** Artifact files must be created inside the worktree directory (after Phase 2), not on the main branch. Phase 1 planning happens in conversation; artifacts are written to disk after the worktree is set up.

**⛔ DO NOT proceed to Phase 1 without completing Step 6.**

## Example

```markdown
User: "Add dark mode toggle to the app"

Agent (Phase 0):
"Let me understand this requirement before implementation.

Current analysis:

- Project: Next.js app with Tailwind CSS
- Existing: Light theme only
- Location: No theme infrastructure found

Clarifying questions:

1. **Scope**: Should dark mode apply globally or per-page?
2. **Persistence**: Save user preference (localStorage/cookie)?
3. **Default**: System preference or manual toggle?
4. **Toggle UI**: Where should the toggle appear (navbar/settings)?

My proposed approach:

- Add theme context provider
- Use Tailwind dark: classes
- Save preference to localStorage
- Toggle in navbar

Does this match your vision?"

[Wait for user confirmation before Phase 1]
```

## Validation Checklist

Before leaving Phase 0:

- [ ] User request fully understood
- [ ] All ambiguities clarified
- [ ] Scope explicitly confirmed
- [ ] Acceptance criteria defined
- [ ] Technical approach validated
- [ ] User gave explicit "proceed" signal
- [ ] **Workflow mode determined (Full or Lite)**
- [ ] **Branch name decided** (artifacts will be created after worktree setup in Phase 2)

**If any checkbox unchecked, DO NOT proceed to Phase 1.**

## References

- Related rule: [phase-1-planning](./phase-1-planning.md)
- Related rule: [decision-framework](./decision-framework.md)
