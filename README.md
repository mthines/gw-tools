# gw-tools

Git Worktree Tools - A CLI for managing Git worktrees with automatic file syncing.

## 🛠️ gw CLI Tool

**gw** simplifies Git worktree management with features like:

- Create worktrees with automatic file copying (`.env`, secrets, configs)
- Quick navigation with `gw cd` and smart partial matching
- Proxy commands for `git worktree` operations with enhanced output

### Installation

```bash
npm install -g @gw-tools/gw-tool
```

### Quick Start

```bash
# Create a new worktree (auto-creates branch if needed, auto-copies files)
gw add feature-auth

# Navigate to worktree
gw cd feature-auth

# Sync files between worktrees
gw sync feature-auth .env secrets/

# List all worktrees
gw list

# Remove when done
gw remove feature-auth
```

📖 **Full documentation:** [packages/gw-tool/README.md](packages/gw-tool/README.md)

---

## 🎓 AI Skills (for Claude Code, Copilot, Cursor, etc.)

Enhance your AI agent with gw-tools knowledge using [skills.sh](https://skills.sh):

```bash
npx skills add https://github.com/mthines/gw-tools --skill git-worktree-workflows config-management multi-worktree-dev # installs all skills
```

```bash
# Master Git worktrees and gw workflows
npx skills add https://github.com/mthines/gw-tools --skill git-worktree-workflows

# Configure gw for your project type (Next.js, monorepos, etc.)
npx skills add https://github.com/mthines/gw-tools --skill config-management

# Advanced parallel development patterns
npx skills add https://github.com/mthines/gw-tools --skill multi-worktree-dev
```

Once installed, your AI agent can:

- Create worktrees for bug fixes and features automatically
- Configure gw for your specific project type
- Navigate between worktrees and manage files
- Create PRs from isolated worktrees

📖 **Skill documentation:** [skills/README.md](skills/README.md)

---

## 📦 Other Packages

This monorepo also includes utility libraries:

- `@gw-tools/strings` - String manipulation utilities
- `@gw-tools/async` - Async utility functions with retry logic
- `@gw-tools/colors` - Color conversion and manipulation utilities
- `@gw-tools/utils` - Shared utilities (internal)

---

## 🏗️ Nx Monorepo

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

This repository uses [Nx](https://nx.dev) for monorepo management.

## 🚀 Development Quick Start

```bash
# Clone the repository
git clone <your-fork-url>
cd typescript-template

# Install dependencies
pnpm install

# Build all packages
npx nx run-many -t build

# Run tests
npx nx run-many -t test

# Lint all projects
npx nx run-many -t lint

# Run everything in parallel
npx nx run-many -t lint test build --parallel=3

# Visualize the project graph
npx nx graph
```

## ⭐ Featured Nx Capabilities

This repository showcases several powerful Nx features:

### 1. 🔒 Module Boundaries

Enforces architectural constraints using tags. Each package has specific dependencies it can use:

- `scope:shared` (utils) - Can be used by all packages
- `scope:strings` - Can only depend on shared utilities
- `scope:async` - Can only depend on shared utilities
- `scope:colors` - Can only depend on shared utilities

**Try it out:**

```bash
# See the current project graph and boundaries
npx nx graph

# View a specific project's details
npx nx show project strings --web
```

[Learn more about module boundaries →](https://nx.dev/features/enforce-module-boundaries)

### 2. 🛠️ Custom Run Commands

Packages can define custom commands beyond standard build/test/lint:

```bash
# Run the custom build-base command for strings package
npx nx run strings:build-base

# See all available targets for a project
npx nx show project strings
```

[Learn more about custom run commands →](https://nx.dev/concepts/executors-and-configurations)

### 3. 🔧 Self-Healing CI

The CI pipeline includes `nx fix-ci` which automatically identifies and suggests fixes for common issues. To test it, you can make a change to `async-retry.spec.ts` so that it fails, and create a PR.

```bash
# Run tests and see the failure
npx nx test async

# In CI, this command provides automated fixes
npx nx fix-ci
```

[Learn more about self-healing CI →](https://nx.dev/ci/features/self-healing-ci)

### 4. 📦 Package Publishing

Manage releases and publishing with Nx Release:

```bash
# Dry run to see what would be published
npx nx release --dry-run

# Version and release packages
npx nx release

# Publish only specific packages
npx nx release publish --projects=strings,colors
```

[Learn more about Nx Release →](https://nx.dev/features/manage-releases)

## 📁 Project Structure

```
├── packages/
│   ├── strings/     [scope:strings] - String utilities (publishable)
│   ├── async/       [scope:async]   - Async utilities (publishable)
│   ├── colors/      [scope:colors]  - Color utilities (publishable)
│   └── utils/       [scope:shared]  - Shared utilities (private)
├── nx.json          - Nx configuration
├── tsconfig.json    - TypeScript configuration
└── eslint.config.mjs - ESLint with module boundary rules
```

## 🏷️ Understanding Tags

This repository uses tags to enforce module boundaries:

| Package             | Tag             | Can Import From        |
| ------------------- | --------------- | ---------------------- |
| `@gw-tools/utils`   | `scope:shared`  | Nothing (base library) |
| `@gw-tools/strings` | `scope:strings` | `scope:shared`         |
| `@gw-tools/async`   | `scope:async`   | `scope:shared`         |
| `@gw-tools/colors`  | `scope:colors`  | `scope:shared`         |

The ESLint configuration enforces these boundaries, preventing circular dependencies and maintaining clean architecture.

## 🧪 Testing Module Boundaries

To see module boundary enforcement in action:

1. Try importing `@gw-tools/colors` into `@gw-tools/strings`
2. Run `npx nx lint strings`
3. You'll see an error about violating module boundaries

## 📚 Useful Commands

```bash
# Project exploration
npx nx graph                                    # Interactive dependency graph
npx nx list                                     # List installed plugins
npx nx show project strings --web              # View project details

# Development
npx nx build strings                           # Build a specific package
npx nx test async                              # Test a specific package
npx nx lint colors                             # Lint a specific package

# Running multiple tasks
npx nx run-many -t build                       # Build all projects
npx nx run-many -t test --parallel=3          # Test in parallel
npx nx run-many -t lint test build            # Run multiple targets

# Affected commands (great for CI)
npx nx affected -t build                       # Build only affected projects
npx nx affected -t test                        # Test only affected projects

# Release management
npx nx release --dry-run                       # Preview release changes
npx nx release                                 # Create a new release
```

## Nx Cloud

Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## 🔗 Learn More

- [Nx Documentation](https://nx.dev)
- [Module Boundaries](https://nx.dev/features/enforce-module-boundaries)
- [Custom Commands](https://nx.dev/concepts/executors-and-configurations)
- [Self-Healing CI](https://nx.dev/ci/features/self-healing-ci)
- [Releasing Packages](https://nx.dev/features/manage-releases)
- [Nx Cloud](https://nx.dev/ci/intro/why-nx-cloud)

## 💬 Community

Join the Nx community:

- [Discord](https://go.nx.dev/community)
- [X (Twitter)](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl)
- [YouTube](https://www.youtube.com/@nxdevtools)
- [Blog](https://nx.dev/blog)
