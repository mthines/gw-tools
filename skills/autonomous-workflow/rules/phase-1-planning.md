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

## ⚠️ PREREQUISITE GATE: Workflow Mode & Artifacts

**Before ANY Phase 1 work, you MUST have completed:**

### 1. Workflow Mode Detection

Confirm which mode applies to this task:

| Mode | Criteria | Artifacts |
| ---- | -------- | --------- |
| **Full** | 4+ files OR complex changes | **REQUIRED** |
| **Lite** | 1-3 files AND simple | Skip artifacts |

### 2. Artifact Creation (Full Mode ONLY)

**⛔ STOP if Full Mode and artifacts don't exist yet.**

```bash
# Create artifact directory FIRST
mkdir -p .gw/{branch-name}

# Create required files
touch .gw/{branch-name}/task.md
touch .gw/{branch-name}/plan.md
```

Verify files exist before proceeding:
```bash
ls -la .gw/{branch-name}/
# Must show: task.md, plan.md
```

**Only proceed to Phase 1 analysis after artifacts are created.**

---

## Overview

Deep codebase analysis and implementation planning.
Create a detailed plan before any code changes.
Validate the plan against requirements from Phase 0.

## Core Principles

- **Understand before changing**: Read existing code thoroughly.
- **Follow existing patterns**: Consistency with codebase.
- **Plan file changes**: Know exactly what to modify.
- **Self-validate**: Review plan against requirements.

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

Document your plan:

```markdown
**Changes Required:**

1. File: `path/to/file1.ts`
   - Add: [specific additions]
   - Modify: [specific changes]
   - Reason: [why this change]

2. New file: `path/to/file2.ts`
   - Purpose: [what this does]
   - Exports: [public API]

**Testing Strategy:**

- Unit tests: [what to test]
- Integration tests: [if applicable]

**Documentation Updates:**

- README.md: [what to add/change]
- CHANGELOG: [entry to add]

**Risks & Mitigations:**

- Risk: [potential issue]
  Mitigation: [how to handle]
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

### Step 4: Populate Artifacts (Full Mode)

**Note:** Artifact files should already exist from the Prerequisite Gate above.

Now populate the artifacts with your planning content:

**task.md** - Initialize with:

- Phase 0 and Phase 1 marked complete
- Phase 2-6 in Upcoming
- Decisions from Phase 0 in Decisions Log

**plan.md** - Document:

- Summary of approach
- Files to create/modify
- Testing strategy
- Dependencies and risks

**metadata.json** - Create with:

```json
{
  "branch": "<branch-name>",
  "task": "<task-description>",
  "created": "<ISO-timestamp>",
  "updated": "<ISO-timestamp>",
  "phase": 1,
  "status": "in_progress"
}
```

See [artifacts-overview](./artifacts-overview.md) for full details.

### Step 5: Iterate if Needed

If self-validation reveals issues:

1. Refine the plan
2. Update `plan.md`
3. Re-validate
4. Iterate until plan is solid

**Do NOT proceed to Phase 2 until plan is validated.**

## Planning Checklist

- [ ] Codebase deeply analyzed
- [ ] All relevant files identified
- [ ] Implementation approach defined
- [ ] Testing strategy clear
- [ ] Documentation scope identified
- [ ] Plan self-validated
- [ ] Ready to execute

## References

- Related rule: [phase-0-validation](./phase-0-validation.md)
- Related rule: [phase-2-worktree](./phase-2-worktree.md)
- Related rule: [artifacts-overview](./artifacts-overview.md)
- Template: `templates/task.template.md`
- Template: `templates/plan.template.md`
