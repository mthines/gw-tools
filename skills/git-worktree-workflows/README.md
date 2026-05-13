# Git Worktree Workflows

> Master Git worktrees and optimize your development workflow with gw-tools

## 🎯 What You'll Learn

This skill teaches you how to leverage Git worktrees effectively with the `gw` CLI tool. You'll learn:

- **Git worktree fundamentals** - What they are, when to use them, and how they compare to branch switching
- **Creating and managing worktrees** - Using `gw add` with auto-copy functionality
- **Quick navigation** - Mastering `gw cd` for seamless context switching
- **Common workflow patterns** - Feature development, hotfixes, code reviews, and testing
- **Maintenance and cleanup** - Keeping your worktrees organized and your disk space manageable
- **Troubleshooting** - Solving common worktree issues and recovering from errors

## 📦 Installation

```bash
npx skills add https://github.com/mthines/gw-tools --skill
```

Select `git-worktree-workflows` from the interactive menu.

## 📋 Prerequisites

- Basic Git knowledge (commits, branches, remotes)
- `gw` CLI tool installed ([installation guide](../../packages/gw-tool/README.md#installation))
- A Git repository to work with

## 📚 What's Included

### Main Documentation

- **[SKILL.md](./SKILL.md)** - Comprehensive guide covering all aspects of Git worktree workflows

### References (Lazy-loaded)

- **[Getting Started](./references/getting-started.md)** - Complete walkthrough for first-time worktree users
- **[Parallel Development](./references/parallel-development.md)** - Working on multiple features simultaneously
- **[Testing Multiple Versions](./references/testing-multiple-versions.md)** - Compatibility testing across versions
- **[Troubleshooting](./references/troubleshooting-worktrees.md)** - Common problems and solutions

## 🚀 Quick Start

After installing this skill, try asking your AI agent:

```
"Help me create my first Git worktree for a feature branch"

"I'm working on two features at once, how should I set up worktrees?"

"My worktree is locked, how do I fix it?"

"Show me the best workflow for handling hotfixes while working on a feature"
```

## 🎓 Learning Path

1. **Beginners** - Start with [Getting Started](./references/getting-started.md)
2. **Intermediate** - Read the full [SKILL.md](./SKILL.md) guide
3. **Advanced** - Explore [Parallel Development](./references/parallel-development.md) and [Testing Multiple Versions](./references/testing-multiple-versions.md)

## 🔗 Related Skills

- [gw-config-management](../gw-config-management/) - Configure auto-copy behavior for your project type
- [autonomous-workflow](https://github.com/mthines/agent-skills#autonomous-workflow) - Autonomous feature development workflow (lives in `mthines/agent-skills`)

## 💬 Example Use Cases

This skill helps with:

- ✅ Creating feature branch worktrees without losing your current work
- ✅ Running hotfixes in parallel with feature development
- ✅ Setting up code review environments quickly
- ✅ Testing changes across multiple Node.js or framework versions
- ✅ Managing long-running experimental branches
- ✅ Cleaning up old worktrees and managing disk space
- ✅ Recovering from worktree errors and corruption

## 🆘 Need Help?

- Check the [Troubleshooting Guide](./references/troubleshooting-worktrees.md)
- Ask your AI agent with this skill loaded
- Open an issue in the [main repository](../../issues)

---

_Part of the [gw-tools skills collection](../)_
