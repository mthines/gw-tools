---
title: 'Phase 1: Task Intake & Planning'
impact: HIGH
tags:
  - planning
  - analysis
  - phase-1
---

# Phase 1: Task Intake & Planning

---

## ⚠️ PREREQUISITE GATE: Workflow Mode Detection

**Before ANY Phase 1 work, you MUST have completed:**

### 1. Workflow Mode Detection

Confirm which mode applies to this task:

| Mode     | Criteria                    | Artifacts      |
| -------- | --------------------------- | -------------- |
| **Full** | 4+ files OR complex changes | **REQUIRED**   |
| **Lite** | 1-3 files AND simple        | Skip artifacts |

**⚠️ NOTE: Artifact files are NOT created yet.** Phase 1 planning happens in conversation. Artifact files (`.gw/{branch}/task.md`, `plan.md`) are created after Phase 2 worktree setup, so they live in the worktree — not on the main branch.

---

## Overview

Deep codebase analysis and implementation planning.
Create a detailed, comprehensive plan before any code changes.
Validate the plan against requirements from Phase 0.

**The plan.md is your single source of truth for context recovery.** It must contain enough detail that a brand new Claude session can pick up the work without re-reading the original conversation. When in doubt, include more detail — verbose plans are far better than sparse ones.

## Core Principles

- **Understand before changing**: Read existing code thoroughly.
- **Follow existing patterns**: Consistency with codebase.
- **Plan file changes**: Know exactly what to modify.
- **Self-validate**: Review plan against requirements.
- **Capture everything from Phase 0**: Every decision, requirement, rejected alternative, and edge case discussed must be preserved in plan.md.
- **Write for a future reader**: Assume the person reading plan.md has zero context from the original conversation.

## Procedure

### Step 1: Analyze Codebase

**Project Structure:**

- Identify relevant directories/modules
- Map dependencies between components
- Locate configuration files

Tools: `nx_workspace`, `nx_project_details`, `Glob`

**Existing Patterns:**

- Find similar features already implemented
- Study code style, naming conventions
- Understand error handling patterns
- Review testing patterns

Tools: `Grep`, `Read`

**Technology Stack:**

- Framework version and features
- Build tools and configuration
- Testing framework and conventions

### Step 2: Create Implementation Plan

**This is the most important step.** The plan.md must be comprehensive enough to serve as complete context for a new Claude session. Use the `templates/plan.template.md` as your structure and fill in EVERY section thoroughly.

#### 2a: Capture Phase 0 Discussion Context

Transfer ALL context from the Phase 0 discussion into plan.md:

- **Background & Context**: Why this change is needed, what problem it solves, any history
- **Every requirement**: Both explicit (user-stated) and implicit (inferred during analysis)
- **Every decision made**: What was decided, what alternatives were considered, and WHY
- **Out of scope items**: What was discussed but intentionally excluded
- **Edge cases**: Every edge case identified and the agreed handling strategy

#### 2b: Document Technical Design

Be specific and detailed in the technical approach:

- **Architecture/design**: How components interact, data flow, integration points
- **Patterns to follow**: Reference specific existing files as examples
- **API/interface design**: Include actual type signatures, function signatures, config shapes
- **Implementation order**: Numbered sequence of steps for Phase 3

#### 2c: Detail File Changes

Use a single consolidated table for all file changes (creates, modifies, doc updates):

```markdown
| Action | File                | Change                 | Reason             |
| ------ | ------------------- | ---------------------- | ------------------ |
| create | path/to/new-file.ts | Purpose / key exports  | Why needed         |
| modify | path/to/existing.ts | Specific modifications | Why this change    |
| modify | README.md           | Add feature docs       | User-facing change |
```

#### 2d: Define Testing Strategy with Specific Cases

Don't just list categories — list actual test cases in a single table:

```markdown
| Type        | Test Case              | File              | Validates          |
| ----------- | ---------------------- | ----------------- | ------------------ |
| unit        | handles empty input    | processor.spec.ts | Returns default    |
| unit        | rejects invalid config | config.spec.ts    | Throws ConfigError |
| integration | end-to-end flow        | feature.e2e.ts    | Full pipeline      |
| manual      | toggle and verify      | —                 | Visual check       |
```

#### 2e: Document Risks with Mitigations

```markdown
| Risk                | Likelihood | Impact | Mitigation              |
| ------------------- | ---------- | ------ | ----------------------- |
| Breaking API change | LOW        | HIGH   | Add deprecation warning |
```

### Step 3: Self-Validation

Ask yourself:

**Completeness:**

- Does this plan achieve all requirements from Phase 0?
- Are edge cases addressed?

**Correctness:**

- Does this follow existing project patterns?
- Are dependencies correct?

**Testability:**

- Can this be validated with tests?
- Are test cases comprehensive?

**Maintainability:**

- Is this approach simple enough?
- Will other developers understand this?

### Step 4: Prepare Artifact Content (Full Mode)

**⚠️ Do NOT write artifact files to disk yet.** Artifact files are created after Phase 2 worktree setup so they live in the worktree, not on the main branch.

Prepare the following content in conversation (to be written to disk after worktree setup):

**task.md** - Plan to initialize with:

- Phase 0 and Phase 1 marked complete
- Phase 2-6 in Upcoming
- Decisions from Phase 0 in Decisions Log

**plan.md** - Prepare ALL sections from the template (`templates/plan.template.md`):

- **Summary**: What, why, and definition of "done"
- **Background & Context**: Full motivation and history from discussion
- **Requirements**: Every requirement (tagged [user-stated] or [inferred]), plus out-of-scope items
- **Decisions**: Every decision with rejected alternatives and rationale
- **Technical Approach**: Architecture, patterns to follow, edge cases, API/interface designs
- **Implementation Order**: Numbered step-by-step execution sequence
- **File Changes**: Single table covering creates, modifies, and doc updates with rationale
- **Tests**: Specific test cases with type (unit/integration/manual)
- **Dependencies**: With versions, mark new additions
- **Risks**: With likelihood, impact, and mitigations

**⚠️ The plan.md content should be detailed and comprehensive — a new Claude session must be able to execute from it alone without the original conversation. Optimize for information density: be thorough in content, but use tables and structured formats rather than prose where possible.**

**metadata.json** - Prepare with:

```json
{
  "branch": "<branch-name>",
  "task": "<task-description>",
  "created": "<ISO-8601-with-time e.g. 2026-03-07T14:30:00Z>",
  "updated": "<ISO-8601-with-time e.g. 2026-03-07T14:30:00Z>",
  "phase": 1,
  "status": "in_progress"
}
```

**These files will be written to `.gw/{branch}/` after the worktree is created in Phase 2.**

See [artifacts-overview](./artifacts-overview.md) for full details.

### Step 5: Iterate if Needed

If self-validation reveals issues:

1. Refine the plan
2. Update `plan.md`
3. Re-validate
4. Iterate until plan is solid

**Do NOT proceed to Phase 2 until plan is validated.**

## Planning Checklist

- [ ] Codebase analyzed (structure, patterns, stack)
- [ ] Background & context documented (the "why")
- [ ] ALL requirements captured with tags ([user-stated]/[inferred]) + out-of-scope items
- [ ] ALL decisions documented with rejected alternatives and rationale
- [ ] Technical approach detailed (architecture, patterns, edge cases, APIs)
- [ ] Implementation order defined (numbered steps)
- [ ] File changes table complete (creates, modifies, doc updates)
- [ ] Tests defined as specific cases (not just categories)
- [ ] Risks documented with likelihood, impact, and mitigations
- [ ] Plan self-validated — a new session could execute from plan.md alone

## References

- Related rule: [phase-0-validation](./phase-0-validation.md)
- Related rule: [phase-2-worktree](./phase-2-worktree.md)
- Related rule: [artifacts-overview](./artifacts-overview.md)
- Template: `templates/task.template.md`
- Template: `templates/plan.template.md`
