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

## PREREQUISITE GATE: Workflow Mode Detection

**Before ANY Phase 1 work, you MUST have completed:**

### 1. Workflow Mode Detection

Confirm which mode applies to this task:

| Mode     | Criteria                    | Artifacts      |
| -------- | --------------------------- | -------------- |
| **Full** | 4+ files OR complex changes | **REQUIRED**   |
| **Lite** | 1-3 files AND simple        | Skip artifacts |

**NOTE: Artifact files are NOT created yet.** Phase 1 planning happens in conversation. The `plan.md` file is created after Phase 2 worktree setup, so it lives in the worktree — not on the main branch.

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

**This is the most important step.** The plan.md must be comprehensive enough to serve as complete context for a new Claude session. The `create-plan` skill provides the exact template structure and validation checklist.

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

#### 2e: Define Verification Commands

Identify the project's verification commands to use during implementation:

- **After editing**: What fast check to run (e.g., `npx tsc --noEmit`, `go vet ./...`)
- **Before PR**: What full suite to run (e.g., `npm test && npm run build && npm run lint`)

Check `package.json` scripts, `Makefile`, or project config to determine the right commands.

#### 2f: Document Risks with Mitigations

```markdown
| Risk                | Likelihood | Impact | Mitigation              |
| ------------------- | ---------- | ------ | ----------------------- |
| Breaking API change | LOW        | HIGH   | Add deprecation warning |
```

### Step 3: Confidence Gate (Full Mode — MANDATORY)

After completing your analysis and planning, validate the plan quality:

```
Skill(skill: "confidence", args: "plan")
```

**Gate rules:**

- **90%+**: Proceed to Phase 2
- **Below 90%**: Do up to 2 iterations of additional research, analysis, and evidence collection, then re-assess
- **Still below 90% after 2 iterations**: Present findings to user and ask whether to proceed or refine further

**Do NOT proceed to Phase 2 until the confidence gate passes or the user explicitly approves.**

### Step 4: Create Plan Artifact (Full Mode — MANDATORY)

After the confidence gate passes and the worktree is created (Phase 2), generate the plan artifact:

```
Skill(skill: "create-plan")
```

This skill provides the exact template structure and validation checklist. It captures all Phase 0-1 discussion into a self-contained document inside `.gw/{branch}/plan.md`.

**The plan.md is the single source of truth.** A new Claude session must be able to execute from it alone.

## Planning Checklist

- [ ] Codebase analyzed (structure, patterns, stack)
- [ ] Technical approach designed with specific file references
- [ ] Confidence gate passed (90%+ or user-approved)
- [ ] Worktree created (Phase 2)
- [ ] `Skill("create-plan")` invoked to generate plan.md inside worktree

## References

- Related rule: [phase-0-validation](./phase-0-validation.md)
- Related rule: [phase-2-worktree](./phase-2-worktree.md)
- Related skill: [confidence](../../confidence/SKILL.md)
- Related skill: [create-plan](../../create-plan/SKILL.md)
