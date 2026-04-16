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

### Step 2: Announce Mode Selection

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
| [phase-1-planning](./rules/phase-1-planning.md)                 | **HIGH** - Deep codebase analysis, planning, confidence gate               |
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
| [artifacts-overview](./rules/artifacts-overview.md)             | **HIGH** - Two-artifact pattern, file locations, skill invocations         |

## Companion Skills

These skills handle artifact generation and quality gates. They are invoked by the workflow at the right phases.

| Skill | Purpose | Invoked at |
| --- | --- | --- |
| [confidence](../confidence/SKILL.md) | Quality gate — validates plan, code, or bug analysis | Phase 1 (plan gate), Phase 6 (optional code gate) |
| [create-plan](../create-plan/SKILL.md) | Generates `plan.md` from conversation context | After Phase 2 worktree setup |
| [create-walkthrough](../create-walkthrough/SKILL.md) | Generates `walkthrough.md` from plan + git results | Phase 6 before PR creation |

## Templates

| Template                                                         | Purpose                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| [agent.template.md](./templates/agent.template.md)               | Agent file (copy to `~/.claude/agents/`)     |
| [routing-rule.template.md](./templates/routing-rule.template.md) | Auto-trigger rule (copy to `.claude/rules/`) |

## Auto-Trigger Setup (Recommended)

Install the agent and routing rule so Claude auto-triggers on phrases like _"independently"_, _"in isolation"_.

**Option A: Global** (personal use — works in all projects)

```bash
npx skills add https://github.com/mthines/gw-tools \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
  --global --yes && \
  mkdir -p ~/.claude/agents && \
  ln -sf ~/.agents/skills/autonomous-workflow/templates/agent.template.md \
     ~/.claude/agents/autonomous-workflow.md
```

Installs all skills to `~/.agents/skills/` and links the agent definition into `~/.claude/agents/` so it's available in every project.

**Option B: Per-project** (team use — committable to git)

```bash
npx skills add https://github.com/mthines/gw-tools \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
  --yes && \
  mkdir -p .claude/agents .claude/rules && \
  ln -sf .agents/skills/autonomous-workflow/templates/agent.template.md \
     .claude/agents/autonomous-workflow.md && \
  ln -sf .agents/skills/autonomous-workflow/templates/routing-rule.template.md \
     .claude/rules/autonomous-workflow-routing.md
```

Installs all skills to `.agents/skills/` in your project and links the agent + routing rule into `.claude/`. All paths are relative, so the setup can be committed and shared with your team.

To customize the agent for a specific project, copy instead of symlink and edit directly. See [routing-rule.template.md](./templates/routing-rule.template.md) and [agent.template.md](./templates/agent.template.md) for details.

## Quick Reference

### Full Mode (4+ files, complex changes)

| Phase             | Command/Action                                                               |
| ----------------- | ---------------------------------------------------------------------------- |
| 0. Validation     | Ask clarifying questions, get user confirmation, detect mode                 |
| 1. Planning       | Analyze codebase, design approach, then `Skill("confidence", "plan")` gate   |
| 2. Worktree       | `gw add feat/feature-name`, then `Skill("create-plan")` inside worktree     |
| 3. Implementation | Code in worktree, verify after editing, update Progress Log at milestones    |
| 4. Testing        | `npm test`, iterate until passing, log results in Progress Log               |
| 5. Documentation  | Update README, CHANGELOG                                                     |
| 6. PR Creation    | `Skill("create-walkthrough")`, `gh pr create --draft`, SHOW walkthrough      |
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

The workflow produces two artifacts in `.gw/{branch-name}/`, each generated by a dedicated skill:

| Artifact        | File             | Generated by                    | When          |
| --------------- | ---------------- | ------------------------------- | ------------- |
| **Plan**        | `plan.md`        | `Skill("create-plan")`          | After Phase 2 |
| **Walkthrough** | `walkthrough.md` | `Skill("create-walkthrough")`   | Phase 6       |

Files are gitignored and grouped by branch for easy browsing.

**Quality gate**: Before plan creation, `Skill("confidence", "plan")` must reach 90%+.

## Workflow Flow

```
Phase 0: Validation <- MANDATORY
    | (user confirms)
Phase 1: Planning (deep analysis, design approach)
    | Skill("confidence", "plan") <- quality gate (90%+)
    | (plan validated)
Phase 2: Worktree Setup <- MANDATORY
    | Skill("create-plan") <- generates plan.md inside worktree
    | (worktree created, plan.md written)
Phase 3: Implementation
    | Read plan.md -> execute Implementation Order
    | Verify after editing. Update Progress Log at milestones.
    | (code complete)
Phase 4: Testing <- iterate until passing
    | (all tests pass)
Phase 5: Documentation
    | (docs complete)
Phase 6: PR Creation
    | Skill("create-walkthrough") <- generates walkthrough.md
    | gh pr create --draft, SHOW walkthrough to user
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
| plan.md empty          | `cat .gw/{branch}/plan.md` | Re-run `Skill("create-plan")`                                         |
| walkthrough.md missing | `ls .gw/{branch}/`         | Run `Skill("create-walkthrough")` before announcing completion        |

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
