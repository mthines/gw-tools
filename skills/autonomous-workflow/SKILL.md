---
name: autonomous-workflow
description: >
  Autonomous feature development workflow using isolated worktrees.
  Use to autonomously implement features from task description through tested PR delivery.
  Handles worktree creation, implementation, testing, iteration, documentation, and PR creation.
  Triggers on autonomous feature development, end-to-end implementation, or "implement X autonomously."
license: MIT
metadata:
  author: mthines
  version: '3.0.0'
  workflow_type: autonomous
  phases:
    - validation_questions
    - intake_planning
    - worktree_setup
    - implementation
    - testing_iteration
    - documentation
    - pr_creation
    - cleanup
---

# Autonomous Workflow

Execute complete feature development cycles autonomously — from task intake through tested PR delivery — using isolated Git worktrees.

---

## CRITICAL: Before Starting ANY Work

**You MUST complete these steps IN ORDER before writing any code:**

### Step 1: Detect Workflow Mode (MANDATORY)

Analyze the task scope to determine the workflow mode:

| Mode     | Criteria                             | Artifacts Required  |
| -------- | ------------------------------------ | ------------------- |
| **Full** | 4+ files OR complex/architectural    | **YES - MANDATORY** |
| **Lite** | 1-3 files AND simple/straightforward | No                  |

**When in doubt, choose Full Mode.**

### Step 2: Plan Artifact Content (Full Mode ONLY)

For **Full Mode**, you will need these artifacts. **Do NOT create the files yet** — they must be created inside the worktree after Phase 2, not on the main branch.

| File             | Purpose                                                        | Created       |
| ---------------- | -------------------------------------------------------------- | ------------- |
| `plan.md`        | Implementation strategy, decisions, requirements, progress log | After Phase 2 |
| `walkthrough.md` | Final summary for PR delivery                                  | Phase 6       |

**plan.md is the single source of truth.** It must be comprehensive enough that a new Claude session can execute from it alone without the original conversation.

**DO NOT create artifact files on the main branch.**

### Step 3: Announce Mode Selection

State your mode selection explicitly:

> "This is a **Full Mode** task (affects 5+ files). Creating `.gw/{branch-name}/` artifacts after worktree setup."

or

> "This is a **Lite Mode** task (2 files, simple fix). Proceeding without artifacts."

---

## Prerequisites: gw CLI Installation

Before Phase 2 (Worktree Setup), verify the `gw` CLI is installed:

```bash
which gw
```

### If gw is NOT installed

**STOP and prompt the user to install gw.** The workflow cannot proceed without it.

**Installation options (present to user):**

```bash
# Via npm (recommended)
npm install -g @gw-tools/gw

# Via Homebrew (macOS)
brew install mthines/gw-tools/gw

# Via pnpm
pnpm add -g @gw-tools/gw
```

**After installation, set up shell integration:**

```bash
# For zsh (add to ~/.zshrc)
echo 'eval "$(gw install-shell)"' >> ~/.zshrc
source ~/.zshrc

# For bash (add to ~/.bashrc)
echo 'eval "$(gw install-shell)"' >> ~/.bashrc
source ~/.bashrc
```

**Verify installation:**

```bash
gw --version
gw --help
```

**Then initialize gw in the repository (if not already done):**

```bash
gw init
gw init --auto-copy-files .env,secrets/ --post-checkout "npm install"
```

Once `gw` is installed and configured, resume the workflow from Phase 2.

---

## Rules

| Rule                                                            | Description                                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [overview](./rules/overview.md)                                 | **HIGH** - Workflow phases, when to use, expected outcomes                 |
| [smart-worktree-detection](./rules/smart-worktree-detection.md) | **CRITICAL** - Fuzzy match task to current worktree before creating new    |
| [phase-0-validation](./rules/phase-0-validation.md)             | **CRITICAL** - MANDATORY - Validate requirements before any work           |
| [phase-1-planning](./rules/phase-1-planning.md)                 | **HIGH** - Deep codebase analysis and implementation planning              |
| [phase-2-worktree](./rules/phase-2-worktree.md)                 | **CRITICAL** - MANDATORY - Create isolated worktree with `gw add`          |
| [phase-3-implementation](./rules/phase-3-implementation.md)     | **HIGH** - Incremental implementation with verification after each change  |
| [phase-4-testing](./rules/phase-4-testing.md)                   | **CRITICAL** - Fast iteration loop until tests pass (Ralph Wiggum pattern) |
| [phase-5-documentation](./rules/phase-5-documentation.md)       | **MEDIUM** - Update README, CHANGELOG, API docs                            |
| [phase-6-pr-creation](./rules/phase-6-pr-creation.md)           | **HIGH** - Create draft PR, deliver results                                |
| [phase-7-cleanup](./rules/phase-7-cleanup.md)                   | **LOW** - Optional worktree removal after merge                            |
| [decision-framework](./rules/decision-framework.md)             | **HIGH** - Branch naming, test strategy, iteration decisions               |
| [error-recovery](./rules/error-recovery.md)                     | **HIGH** - Recovery procedures for common errors                           |
| [safety-guardrails](./rules/safety-guardrails.md)               | **CRITICAL** - Validation checkpoints, resource limits, rollback           |
| [parallel-coordination](./rules/parallel-coordination.md)       | **HIGH** - Multi-agent coordination, handoff protocol                      |
| [artifacts-overview](./rules/artifacts-overview.md)             | **HIGH** - Two-artifact pattern (Plan, Walkthrough), file locations        |
| [walkthrough-generation](./rules/walkthrough-generation.md)     | **MEDIUM** - Final summary generation at Phase 6                           |

## Templates

| Template                                                         | Purpose                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| [plan.template.md](./templates/plan.template.md)                 | Implementation plan with progress log        |
| [walkthrough.template.md](./templates/walkthrough.template.md)   | Final summary for PR delivery                |
| [agent.template.md](./templates/agent.template.md)               | Agent file (copy to `~/.claude/agents/`)     |
| [routing-rule.template.md](./templates/routing-rule.template.md) | Auto-trigger rule (copy to `.claude/rules/`) |

## Auto-Trigger Setup (Recommended)

Install the agent and routing rule so Claude auto-triggers on phrases like _"independently"_, _"in isolation"_.

**Option A: Global** (personal use — works in all projects)

```bash
mkdir -p ~/.claude/agents && \
  ln -sf ~/.claude/skills/autonomous-workflow/templates/agent.template.md \
     ~/.claude/agents/autonomous-workflow.md
```

Then add the routing rule per-project:

```bash
mkdir -p .claude/rules && \
  ln -sf ~/.claude/skills/autonomous-workflow/templates/routing-rule.template.md \
     .claude/rules/autonomous-workflow-routing.md
```

**Option B: Project-level** (team use — committable to git, customizable)

```bash
mkdir -p .claude/agents .claude/rules && \
  ln -sf ~/.claude/skills/autonomous-workflow/templates/agent.template.md \
     .claude/agents/autonomous-workflow.md && \
  ln -sf ~/.claude/skills/autonomous-workflow/templates/routing-rule.template.md \
     .claude/rules/autonomous-workflow-routing.md
```

To customize the agent for a specific project, copy instead of symlink and edit directly. See [routing-rule.template.md](./templates/routing-rule.template.md) and [agent.template.md](./templates/agent.template.md) for details.

## Quick Reference

### Full Mode (4+ files, complex changes)

| Phase             | Command/Action                                                               |
| ----------------- | ---------------------------------------------------------------------------- |
| 0. Validation     | Ask clarifying questions, get user confirmation, detect mode                 |
| 1. Planning       | Analyze codebase, prepare plan content in conversation (verbose, all detail) |
| 2. Worktree       | `gw add feat/feature-name`, then CREATE & POPULATE `.gw/{branch}/plan.md`    |
| 3. Implementation | Code in worktree, verify after editing, update Progress Log at milestones    |
| 4. Testing        | `npm test`, iterate until passing, log results in Progress Log               |
| 5. Documentation  | Update README, CHANGELOG                                                     |
| 6. PR Creation    | CREATE `walkthrough.md`, `gh pr create --draft`, SHOW walkthrough to user    |
| 7. Cleanup        | `gw remove feat/feature-name` (after merge)                                  |

### Lite Mode (1-3 files, simple changes)

| Phase             | Command/Action                        |
| ----------------- | ------------------------------------- |
| 0. Validation     | Quick clarification if needed         |
| 1. Planning       | Brief mental plan (no artifact files) |
| 2. Worktree       | `gw add fix/bug-name`                 |
| 3. Implementation | Code directly, commit when done       |
| 4. Testing        | `npm test`, fix any failures          |
| 5. PR Creation    | `gh pr create --draft`                |

## Key Principles

1. **Detect workflow mode FIRST**: Determine Full vs Lite before any other action.
2. **plan.md is the single source of truth**: Must be comprehensive enough for a new session to execute alone.
3. **Always validate first (Phase 0)**: Never skip directly to implementation.
4. **Always create worktree (Phase 2)**: Isolation is mandatory.
5. **Verify after editing**: Run fast checks after each change, full suite before PR.
6. **Iterate until correct**: No artificial iteration limits (Ralph Wiggum pattern).
7. **CREATE walkthrough.md AND SHOW IT at Phase 6**: MANDATORY for Full Mode.
8. **Stop and ask when blocked**: Don't guess on ambiguity.

## Artifact System

The workflow produces two artifacts in `.gw/{branch-name}/`:

| Artifact        | File             | Created       | Purpose                                          |
| --------------- | ---------------- | ------------- | ------------------------------------------------ |
| **Plan**        | `plan.md`        | Phase 2 (end) | Implementation strategy, decisions, progress log |
| **Walkthrough** | `walkthrough.md` | Phase 6       | Final summary for PR delivery                    |

Files are gitignored and grouped by branch for easy browsing.

**All timestamps** in artifact frontmatter MUST use full ISO 8601 with time: `YYYY-MM-DDTHH:MM:SSZ` (e.g. `2026-03-07T14:30:00Z`).

## Workflow Flow

```
Phase 0: Validation <- MANDATORY
    | (user confirms)
Phase 1: Planning (prepare content IN CONVERSATION, no files yet)
    | (plan validated)
Phase 2: Worktree Setup <- MANDATORY
    | Full Mode: CREATE & POPULATE plan.md INSIDE worktree
    | (worktree created, plan.md populated)
Phase 3: Implementation
    | Verify after editing. Update Progress Log at milestones.
    | (code complete)
Phase 4: Testing <- iterate until passing
    | (all tests pass)
Phase 5: Documentation
    | (docs complete)
Phase 6: PR Creation
    | Full Mode: CREATE walkthrough.md + SHOW to user
    | (draft PR delivered)
Phase 7: Cleanup (optional)
```

## Smart Worktree Detection

Before creating a new worktree, the workflow checks if the current context matches the task:

| Scenario                            | Action                                |
| ----------------------------------- | ------------------------------------- |
| On main/master                      | Always create new worktree            |
| Worktree name matches task keywords | Prompt user to continue or create new |
| No keyword match                    | Create new worktree                   |

## Fast Iteration Loop (Phase 4)

Based on the Ralph Wiggum pattern:

```
while not all_tests_pass:
    1. Run tests
    2. If pass: done
    3. If fail: analyze -> fix -> commit -> continue
    4. Safety: warn at 10 iterations, stop at 20
```

## Troubleshooting Quick Reference

| Issue                  | Check                      | Recovery                                                              |
| ---------------------- | -------------------------- | --------------------------------------------------------------------- |
| Wrong worktree         | `gw list`, `pwd`           | `gw cd <correct-branch>`                                              |
| gw command not found   | `which gw`                 | `npm install -g @gw-tools/gw`                                         |
| Secrets missing        | `cat .gw/config.json`      | `gw sync <branch> .env`                                               |
| Tests keep failing     | plan.md Progress Log       | Focus on ONE failure, escalate at 7+                                  |
| Agent hallucinated cmd | Error message              | See [error-recovery](./rules/error-recovery.md#hallucinated-commands) |
| plan.md empty          | `cat .gw/{branch}/plan.md` | STOP, populate plan.md before proceeding                              |
| walkthrough.md missing | `ls .gw/{branch}/`         | Create before announcing completion                                   |

## Related Skills

- [git-worktree-workflows](../git-worktree-workflows/) - Worktree fundamentals
- [gw-config-management](../gw-config-management/) - Configure auto-copy and hooks

## References

Detailed examples and scenarios (loaded on-demand):

- [Complete Workflow Example](./references/autonomous-workflow-complete.md)
- [Error Recovery Scenarios](./references/error-recovery-scenarios.md)
- [Iterative Refinement Example](./references/iterative-refinement.md)

## Research Sources

- [Google Antigravity Artifacts](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/) - Artifact pattern
- [Ralph Wiggum AI Coding Loops](https://ralph-wiggum.ai) - Iteration pattern
- [Addy Osmani's LLM Workflow](https://addyosmani.com/blog/ai-coding-workflow/) - Fast feedback loops
- [Claude Code Worktree Support](https://code.claude.com/docs/en/common-workflows) - Best practices
