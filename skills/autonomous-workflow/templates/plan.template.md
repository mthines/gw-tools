---
created: { { TIMESTAMP (ISO 8601 with time: YYYY-MM-DDTHH:MM:SSZ) } }
branch: { { BRANCH } }
task: { { TASK_DESCRIPTION } }
complexity: <!-- LOW | MEDIUM | HIGH -->
status: planning <!-- planning | approved | in-progress | testing | documenting | delivered -->
approved: false
---

# Plan: {{TASK_DESCRIPTION}}

## Summary

<!-- What, why, and definition of "done" in 2-3 sentences -->

## Background & Context

<!-- Why is this needed? What problem does it solve? Include history and motivation from Phase 0 discussion. Write so a reader with zero prior context understands the full "why". -->

## Requirements

<!-- ALL requirements from Phase 0. Tag: [user-stated] or [inferred]. Include non-functional (perf, compat, security) inline. -->

1. <!-- requirement — [user-stated | inferred] -->

### Out of Scope

<!-- Discussed but excluded, with reason. Prevents scope creep. -->

1. <!-- item — reason -->

## Decisions

<!-- Every decision from Phase 0, including rejected alternatives and rationale. Critical for context recovery. -->

| Decision | Alternatives Rejected | Rationale |
| -------- | --------------------- | --------- |

## Technical Approach

<!-- Architecture, data flow, integration points. Specific enough for a new session to implement without the original conversation. -->

### Patterns to Follow

<!-- Existing codebase patterns to match. Reference specific files. -->

### Edge Cases

| Edge Case | Handling |
| --------- | -------- |

### API / Interfaces

<!-- Type signatures, function signatures, config shapes. Omit if N/A. -->

```typescript

```

## Implementation Order

<!-- Ordered steps for Phase 3 execution. Enables context recovery if interrupted mid-implementation. -->

1. <!-- step -->

## File Changes

<!-- All files: create, modify, or update (including docs). -->

| Action | File          | Change                         | Reason       |
| ------ | ------------- | ------------------------------ | ------------ |
| create | <!-- path --> | <!-- purpose / key exports --> | <!-- why --> |
| modify | <!-- path --> | <!-- specific changes -->      | <!-- why --> |

## Tests

<!-- Specific test cases, not categories. -->

| Type        | Test Case             | File          | Validates         |
| ----------- | --------------------- | ------------- | ----------------- |
| unit        | <!-- case -->         | <!-- file --> | <!-- behavior --> |
| integration |                       |               |                   |
| manual      | <!-- step-by-step --> |               |                   |

## Dependencies

<!-- "None" or list. Mark new additions with [new]. -->

## Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |

## Verification

<!-- What commands to run. The agent figures out the right commands from project config. -->
<!-- Examples: npx tsc --noEmit, npm test, npm run lint, go vet ./... -->

- **After editing**: <!-- fast check: type-check or compile changed files -->
- **Before PR**: <!-- full suite: build + test + lint -->

## Progress Log

<!-- Append-only log updated at phase transitions and key milestones. Enables context recovery. -->

- [TIMESTAMP] Phase 1: Plan created
