# Multi-Worktree Development

> Advanced patterns for developing across multiple worktrees simultaneously

## 🎯 What You'll Learn

This skill teaches advanced techniques for parallel development workflows. You'll learn:

- **Parallel development workflows** - Managing multiple features simultaneously
- **Dependency management** - Sharing or isolating node_modules across worktrees
- **File synchronization** - Keeping configurations in sync with `gw sync`
- **Database management** - Isolating or sharing databases between worktrees
- **Service orchestration** - Running multiple services across worktrees
- **Testing workflows** - Parallel testing and CI/CD integration
- **Performance optimization** - Disk space and resource management

## 📦 Installation

```bash
npx skills add mthines/gw-tools/multi-worktree-dev
```

## 📋 Prerequisites

- `gw` CLI tool installed
- Familiarity with Git worktrees ([git-worktree-workflows skill](../git-worktree-workflows/))
- gw configured for your project ([config-management skill](../config-management/))

## 📚 What's Included

### Main Documentation

- **[SKILL.md](./SKILL.md)** - Comprehensive guide to multi-worktree development

### Examples

- **[Sharing Dependencies](./examples/sharing-dependencies.md)** - node_modules strategies
- **[Parallel Testing](./examples/parallel-testing.md)** - Testing across worktrees
- **[Database Management](./examples/database-management.md)** - DB isolation patterns
- **[Service Orchestration](./examples/service-orchestration.md)** - Running multiple services

## 🚀 Quick Start

After installing this skill, try asking your AI agent:

```
"How can I share node_modules between worktrees to save disk space?"

"Set up parallel testing across Node 18 and Node 20"

"How should I handle database migrations when working in multiple worktrees?"

"Help me run my API and frontend in separate worktrees simultaneously"
```

## 🎓 When to Use This Skill

Use this skill when you need to:

- ✅ Work on multiple features in parallel without context switching
- ✅ Test changes across different environments simultaneously
- ✅ Run isolated services for each feature branch
- ✅ Optimize disk space when using many worktrees
- ✅ Coordinate database changes across worktrees
- ✅ Set up CI/CD pipelines that leverage worktrees

## 🔗 Related Skills

- [git-worktree-workflows](../git-worktree-workflows/) - Start here for worktree basics
- [config-management](../config-management/) - Configure gw for your project

## 💡 Key Concepts

### Isolation vs Sharing

| Resource | Isolate | Share |
|----------|---------|-------|
| node_modules | Testing different versions | Save disk space |
| Database | Feature-specific data | Consistent test data |
| Build cache | Clean builds | Faster builds |
| .env files | Different configs | Same secrets |

### Resource Management

Each worktree is independent, which means:
- Separate `node_modules` (unless symlinked)
- Separate build outputs
- Separate running processes
- Shared Git history and objects

## 🆘 Need Help?

- Check the [examples](./examples/) for specific scenarios
- Ask your AI agent with this skill loaded
- Open an issue in the [main repository](../../../issues)

---

*Part of the [gw-tools skills collection](../)*
