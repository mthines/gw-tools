---
title: 'Walkthrough Generation'
impact: MEDIUM
tags:
  - walkthrough
  - summary
  - documentation
  - pr
---

# Walkthrough Generation

## Overview

The `walkthrough.md` file is the final summary generated at Phase 6 (PR Creation). It provides a comprehensive report of what was done, how to verify it, and next steps.

## When to Generate

Generate `walkthrough.md` at **Phase 6** after:

- All tests pass
- Documentation updated
- Ready to create PR

## Generation Process

### Step 1: Gather Information

From `plan.md`:

- Decisions (for Key Decisions)
- Requirements (for context)
- Progress Log (for what was done)

From git:

```bash
git diff --stat main...HEAD
git log --oneline main...HEAD
```

### Step 2: Create Summary

Write 2-3 sentences covering what was implemented and key functionality.

### Step 3: List Files Changed

Create table with file path, change type (Added/Modified/Deleted), and purpose.

### Step 4: Document Key Decisions

Number the important decisions from plan.md's Decisions section.

### Step 5: Report Testing Results

List test outcomes: unit tests, integration tests, manual verification.

### Step 6: Write Verification Steps

Step-by-step instructions for reviewers to verify the changes work.

### Step 7: Define Next Steps

Standard:

1. Review draft PR
2. Mark as ready for review
3. After merge: `gw remove {branch}`

## Delivery Format

The walkthrough is delivered in two ways:

### 1. Inline (to user)

Present summary directly in the conversation with PR link and key details.

### 2. File (for reference)

Save to `.gw/{branch}/walkthrough.md` for future reference and handoff.

## References

- Related rule: [artifacts-overview](./artifacts-overview.md)
- Related rule: [phase-6-pr-creation](./phase-6-pr-creation.md)
- Template: `templates/walkthrough.template.md`
