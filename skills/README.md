# gw-tools Skills

> Enhance your Git worktree workflows with Claude Code skills

## 🎯 What are Skills?

Skills are reusable capabilities for AI agents that provide procedural knowledge about specific tools and workflows. These gw-tools skills help you master Git worktrees and the `gw` CLI tool for improved development workflows.

## 📚 Available Skills

### 1. [Git Worktree Workflows](./git-worktree-workflows/)

Master Git worktrees and optimize development workflows with gw-tools.

```bash
npx skills add mthines/gw-tools/git-worktree-workflows
```

**Learn:**
- Git worktree fundamentals and best practices
- Creating and managing worktrees with `gw`
- Quick navigation with `gw cd`
- Common workflow patterns (feature development, hotfixes, code reviews)
- Troubleshooting and maintenance

**Best for:** Developers new to Git worktrees, teams adopting worktree-based workflows

---

### 2. [Configuration Management](./config-management/)

Configure and optimize gw-tools for different project types and team needs.

```bash
npx skills add mthines/gw-tools/config-management
```

**Learn:**
- Understanding `.gw/config.json` structure
- Auto-copy strategies for different project types
- Configuration templates for Next.js, Node.js APIs, monorepos, and more
- Team configuration management
- Troubleshooting configuration issues

**Best for:** Setting up gw for the first time, configuring team-wide patterns, optimizing auto-copy behavior

---

### 3. [Autonomous Workflow](./multi-worktree-dev/)

Execute complete feature development cycles autonomously using isolated worktrees.

```bash
npx skills add mthines/gw-tools/autonomous-workflow
```

**Capabilities:**
- Autonomous feature implementation from requirements to PR
- Worktree creation and environment setup
- Continuous testing and iteration
- Documentation generation
- Draft PR creation with comprehensive descriptions

**Best for:** AI agents executing end-to-end feature development, autonomous task completion, production-ready deliverables

---

## 🚀 Quick Start

### Prerequisites

- [gw CLI tool](../README.md) installed (`npm install -g @gw-tools/gw-tool`)
- Basic Git knowledge
- Claude Code or another compatible AI agent

### Installation

Install individual skills based on your needs:

```bash
# For beginners - start here
npx skills add mthines/gw-tools/git-worktree-workflows

# When setting up gw for a project
npx skills add mthines/gw-tools/config-management

# For autonomous feature development
npx skills add mthines/gw-tools/autonomous-workflow
```

Or install all skills at once:

```bash
npx skills add mthines/gw-tools
```

### Using Skills

Once installed, your AI agent will have access to the skill knowledge. Simply ask questions like:

- "Help me set up a worktree workflow for parallel feature development"
- "Configure gw for a Next.js project with Vercel"
- "Implement dark mode toggle autonomously"

---

## 📖 Skill Content Overview

Each skill includes:

- **README.md** - Overview, installation, and quick links
- **SKILL.md** - Comprehensive procedural knowledge organized by topic
- **examples/** - Real-world scenarios with step-by-step solutions
- **templates/** - Configuration files and scripts (config-management only)

---

## 🎓 Learning Path

We recommend following this learning path:

1. **Start with git-worktree-workflows** - Build a solid foundation in Git worktrees and basic gw usage
2. **Add config-management** - Optimize gw for your specific project type and team
3. **Use autonomous-workflow** - Enable autonomous end-to-end feature development

---

## 🤝 Contributing

We welcome contributions! If you have:

- **Improvements to existing skills** - Submit a PR with corrections or enhancements
- **New examples** - Share your real-world workflows and solutions
- **New configuration templates** - Add templates for additional project types
- **New skills** - Propose additional skills in the gw-tools ecosystem

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📊 Skill Compatibility

These skills are designed for:

- **Claude Code** ✅
- **GitHub Copilot** ✅
- **Cline** ✅
- **Cursor** ✅
- **Windsurf** ✅
- **Other AI agents** - Most agents supporting the skills.sh ecosystem

---

## 🔗 Links

- [gw CLI Tool Repository](../)
- [gw Documentation](../packages/gw-tool/README.md)
- [skills.sh](https://skills.sh/) - Skill ecosystem directory
- [Report Issues](../issues)

---

## 📝 License

These skills are licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

## 💡 Questions or Feedback?

- Open an [issue](../issues) for bugs or feature requests
- Start a [discussion](../discussions) for questions or ideas
- Share your success stories and workflows!

---

*Made with ❤️ for the Git worktree community*
