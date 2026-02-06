# Autonomous Workflow

> Execute complete feature development cycles autonomously using isolated worktrees

## 🎯 What This Skill Does

This skill enables AI agents to autonomously execute complete feature development workflows from requirements to tested PR delivery. It provides comprehensive procedures for:

- **Phase 0: Validation & Questions** - ALWAYS ask clarifying questions first
- **Phase 1: Task Intake & Planning** - Deep analysis and implementation planning
- **Phase 2: Worktree Setup** - Create isolated environment with validation
- **Phase 3: Implementation** - Code with continuous self-review and iteration
- **Phase 4: Testing & Iteration** - Aggressive iteration until all tests pass
- **Phase 5: Documentation** - Generate clear, validated documentation
- **Phase 6: PR Creation & Delivery** - Create comprehensive draft PR
- **Phase 7: Cleanup** - Safe worktree removal (optional)

## 📦 Installation

```bash
npx skills add mthines/gw-tools/autonomous-workflow
```

## 📋 Prerequisites

- `gw` CLI tool installed
- Git worktree support
- Testing framework available in project
- GitHub CLI (`gh`) for PR creation

## 📚 What's Included

### Main Documentation

- **[SKILL.md](./SKILL.md)** - Complete autonomous workflow procedures (12 sections)

### Examples

- **[Complete Workflow](./examples/autonomous-workflow-complete.md)** - Full end-to-end execution trace
- **[Error Recovery](./examples/error-recovery-scenarios.md)** - Common errors and recovery procedures
- **[Iterative Refinement](./examples/iterative-refinement.md)** - Progressive improvement examples

## 🚀 Quick Start

After installing this skill, trigger autonomous execution with requests like:

```
"Implement dark mode toggle autonomously"

"Add user authentication feature end-to-end"

"Autonomous feature development: email notifications with tests and docs"

"Create a new API endpoint for user profiles with full test coverage"
```

## 🎯 When to Use This Skill

Use this skill when you need:

- ✅ Complete feature implementation from requirements to PR
- ✅ Autonomous task execution with minimal human intervention
- ✅ Validated, tested, documented deliverables
- ✅ Isolated worktree-based development
- ✅ Self-validating implementation with continuous iteration
- ✅ Production-ready code with comprehensive tests

**Do NOT use this skill for:**
- ❌ Interactive coding sessions (use conversational mode instead)
- ❌ Exploratory research tasks (use explore agent)
- ❌ Simple one-file changes (no need for full workflow)

## 🔄 Workflow Overview

```
User Request
    ↓
Phase 0: Validation (MANDATORY)
├─ Ask clarifying questions
├─ Validate understanding
└─ Get explicit confirmation
    ↓
Phase 1: Planning
├─ Deep codebase analysis
├─ Implementation strategy
└─ Self-validation
    ↓
Phase 2: Worktree Setup
├─ Generate branch name
├─ Create worktree
├─ Install dependencies
└─ Validate environment
    ↓
Phase 3: Implementation
├─ Follow existing patterns
├─ Implement incrementally
├─ Self-review continuously
└─ Commit logically
    ↓
Phase 4: Testing
├─ Run tests
├─ Iterate aggressively
├─ Fix all failures
└─ Validate coverage
    ↓
Phase 5: Documentation
├─ Update README
├─ Update CHANGELOG
├─ Validate clarity
└─ Commit docs
    ↓
Phase 6: PR Creation
├─ Pre-flight checks
├─ Push to remote
├─ Generate description
└─ Create draft PR
    ↓
Phase 7: Cleanup (Optional)
└─ Remove worktree after merge
```

## 🔑 Key Principles

1. **🔴 Phase 0 is MANDATORY** - Never skip validation questions
2. **♻️ Continuous iteration** - Self-validate and refine at every step
3. **📊 No hard limits** - Iterate until correct, not until exhausted
4. **✅ Quality gates** - Don't proceed until phase validated
5. **🛑 Stop and ask** - When encountering fundamental blockers

## 🔗 Related Skills

- [git-worktree-workflows](../git-worktree-workflows/) - Learn worktree basics first
- [config-management](../config-management/) - Configure gw for your project

## 💡 Key Features

### Upfront Validation
- Asks clarifying questions before any coding
- Validates understanding with user
- Confirms scope and acceptance criteria

### Autonomous Execution
- Executes all phases with minimal intervention
- Self-validates at every checkpoint
- Iterates until tests pass (no hard limits)

### Comprehensive Deliverables
- All tests passing (existing + new)
- Documentation updated
- Clean commit history
- Draft PR ready for review

### Error Recovery
- Procedures for all failure scenarios
- Aggressive iteration on test failures
- Merge conflict resolution
- Build error recovery

## 🆘 Need Help?

- Check the [examples](./examples/) for detailed scenarios
- Read [SKILL.md](./SKILL.md) for complete procedures
- Ask your AI agent with this skill loaded
- Open an issue in the [main repository](https://github.com/mthines/gw-tools/issues)

---

*Part of the [gw-tools skills collection](../)*
