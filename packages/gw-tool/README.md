# gw - Git Worktree Tools

[![Homebrew](https://img.shields.io/github/downloads/mthines/gw-tools/total?label=Homebrew%20%2B%20Binary%20Downloads&logo=homebrew)](https://github.com/mthines/homebrew-gw-tools)
[![npm Downloads](https://img.shields.io/npm/dt/@gw-tools/gw?label=npm&logo=npm)](https://www.npmjs.com/package/@gw-tools/gw)

A command-line tool for managing git worktrees, built with Deno.

## Table of Contents

- [gw - Git Worktree Tools](#gw---git-worktree-tools)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
  - [🎓 AI Skills (for Claude Code, Copilot, Cursor, etc.)](#-ai-skills-for-claude-code-copilot-cursor-etc)
    - [🤖 Use as a Claude Code Agent](#-use-as-a-claude-code-agent)
  - [Initial Setup: Secrets in the Default Branch](#initial-setup-secrets-in-the-default-branch)
    - [First-Time Setup Flow](#first-time-setup-flow)
    - [Why This Matters](#why-this-matters)
    - [Keeping Secrets Updated](#keeping-secrets-updated)
  - [Features](#features)
  - [Installation](#installation)
    - [Via Homebrew (macOS)](#via-homebrew-macos)
    - [Via npm](#via-npm)
    - [Build from source](#build-from-source)
  - [Configuration](#configuration)
    - [Auto-Detection](#auto-detection)
    - [Example Configuration](#example-configuration)
    - [Configuration Options](#configuration-options)
  - [Commands](#commands)
    - [checkout](#checkout)
      - [Arguments](#arguments)
      - [Options](#options)
      - [Examples](#examples)
      - [Staged Files](#staged-files)
      - [Auto-Copy Configuration](#auto-copy-configuration)
      - [Hooks](#hooks)
    - [Machine-Readable Progress](#machine-readable-progress)
      - [Flag](#flag)
      - [Schema](#schema)
      - [Examples](#examples-progress)
      - [Inspect with jq](#inspect-with-jq)
      - [VS Code Extension](#vs-code-extension-progress)
    - [cd](#cd)
      - [Arguments](#arguments-1)
      - [Examples](#examples-1)
      - [How It Works](#how-it-works)
    - [pr](#pr)
      - [Arguments](#arguments-2)
      - [Options](#options-1)
      - [Examples](#examples-2)
      - [Requirements](#requirements)
      - [How It Works](#how-it-works-1)
    - [update](#update)
      - [Options](#options-2)
      - [Examples](#examples-3)
      - [How It Works](#how-it-works-2)
    - [install-shell](#install-shell)
      - [Options](#options-3)
      - [Examples](#examples-4)
      - [Migrating from File-Based Integration](#migrating-from-file-based-integration)
    - [root](#root)
      - [Examples](#examples-5)
      - [How It Works](#how-it-works-3)
    - [init](#init)
      - [Options](#options-4)
      - [Clone Examples](#clone-examples)
      - [Existing Repository Examples](#existing-repository-examples)
      - [Hook Variables](#hook-variables)
      - [Auto-Cleanup Configuration](#auto-cleanup-configuration)
      - [When to Use](#when-to-use)
    - [show-init](#show-init)
      - [Options](#options-5)
      - [Examples](#examples-6)
      - [Output Example](#output-example)
      - [When to Use](#when-to-use-1)
    - [sync](#sync)
      - [Arguments](#arguments-3)
      - [Options](#options-6)
      - [Examples](#examples-7)
    - [clean](#clean)
      - [Options](#options-7)
      - [Examples](#examples-8)
      - [How It Works](#how-it-works-4)
    - [protect](#protect)
      - [Examples](#examples-protect)
    - [unprotect](#unprotect)
      - [Examples](#examples-unprotect)
    - [Git Worktree Proxy Commands](#git-worktree-proxy-commands)
      - [list (ls)](#list-ls)
      - [remove (rm)](#remove-rm)
      - [move (mv)](#move-mv)
      - [prune](#prune)
      - [lock](#lock)
      - [unlock](#unlock)
      - [repair](#repair)
  - [Use Case](#use-case)
    - [Typical Workflow](#typical-workflow)
  - [Development](#development)
    - [Local Development \& Testing](#local-development--testing)
      - [Shell Alias Method (Recommended)](#shell-alias-method-recommended)
    - [Available Scripts](#available-scripts)
    - [Publishing](#publishing)
      - [How It Works](#how-it-works-5)
      - [Conventional Commits](#conventional-commits)
      - [Testing Releases](#testing-releases)
      - [Manual Publishing (Fallback)](#manual-publishing-fallback)
      - [Publishing to JSR (Optional)](#publishing-to-jsr-optional)
    - [Project Structure](#project-structure)
    - [Adding New Commands](#adding-new-commands)
      - [Custom Commands (like `checkout`, `sync`)](#custom-commands-like-checkout-sync)
      - [Git Proxy Commands (like `list`, `remove`)](#git-proxy-commands-like-list-remove)
  - [License](#license)

## Quick Start

**New Project Setup:**

```bash
# Install (Homebrew on macOS)
brew install mthines/gw-tools/gw

# Or install via npm
npm install -g @gw-tools/gw

# Or install via Linux package manager
yay -S gw-tools

# Clone a repository with gw setup (interactive prompts for configuration)
gw init git@github.com:user/repo.git --interactive
# Automatically navigates to the new repository

# Create worktrees and start working
gw add feat/new-feature
gw cd feat/new-feature
```

**Existing Repository Setup:**

```bash
# Configure gw in an existing repository
gw init --auto-copy-files .env,secrets/ --post-checkout "pnpm install"

# Create worktrees - files are copied automatically, dependencies installed
gw add feat/another-feature
gw cd feat/another-feature

# Checkout an existing branch (navigates if already checked out elsewhere)
gw checkout main
```

## 🎓 AI Skills (for Claude Code, Copilot, Cursor, etc.)

The `gw`-specific skills live in this repo. The autonomous workflow and its companions live in [**`mthines/agent-skills`**](https://github.com/mthines/agent-skills#autonomous-workflow).

**gw-specific skills** (this repo):

```bash
npx skills add https://github.com/mthines/gw-tools \
  --skill git-worktree-workflows gw-config-management \
  --agent claude-code \
  --yes
```

- **git-worktree-workflows** — Master Git worktrees and `gw` workflows
- **gw-config-management** — Configure `gw` for your project type (Next.js, monorepos, etc.)

📖 **gw skill documentation:** [skills/README.md](../../skills/README.md)

### 🤖 Use as a Claude Code Agent

Want Claude Code to autonomously implement features end-to-end? Install the autonomous workflow skill + companion agents from [`mthines/agent-skills`](https://github.com/mthines/agent-skills#autonomous-workflow):

**Global** (personal use — works in all projects):

```bash
npx skills add https://github.com/mthines/agent-skills \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
          code-quality holistic-analysis tdd ux update-claude \
          review-changes create-pr ci-auto-fix \
  --agent claude-code \
  --global --yes
bash ~/.claude/skills/autonomous-workflow/install.sh --global
```

**Per-project** (team use — committable to git):

```bash
npx skills add https://github.com/mthines/agent-skills \
  --skill autonomous-workflow create-plan create-walkthrough confidence \
          code-quality holistic-analysis tdd ux update-claude \
          review-changes create-pr ci-auto-fix \
  --agent claude-code \
  --yes
bash .claude/skills/autonomous-workflow/install.sh
```

The `install.sh` script links the planner + executor agent definitions and the auto-routing rule into `.claude/`. Then say _"implement X independently"_ and the agent takes over. It will:

- Create isolated worktrees for each task (uses `gw` if installed, native `git worktree` otherwise)
- Plan and implement incrementally
- Run tests and iterate until passing
- Create draft PRs with full context

📊 **Visualize progress in VS Code:** Install the [Agent Tasks extension](https://marketplace.visualstudio.com/items?itemName=mthines.agent-tasks) to see `plan.md`, `task.md`, and `walkthrough.md` artifacts live in the sidebar.

## Initial Setup: Secrets in the Default Branch

**Important:** Before using `gw checkout` with auto-copy, ensure your secrets and environment files exist in your `defaultBranch` worktree (typically `main`). This worktree is the **source** from which files are copied to new worktrees.

### First-Time Setup Flow

```bash
# 1. Clone and set up repository with gw (interactive mode)
gw init git@github.com:user/repo.git --interactive

# During interactive setup:
# - Configure auto-copy files: .env,secrets/
# - Set up post-add hooks if needed (e.g., pnpm install)
# - Configure other options as desired

# This automatically:
# - Clones the repository
# - Creates the gw_root branch
# - Creates the main worktree
# - Navigates you to the repository root

# 2. Set up secrets in the main worktree FIRST
cd main
cp .env.example .env           # Create your environment file
# Edit .env with your actual secrets, API keys, etc.
mkdir -p secrets/
# Add any other secret files your project needs

# 3. Now create feature worktrees - files are copied automatically from main
cd ..
gw add feat/new-feature
# .env and secrets/ are automatically copied from main to feat/new-feature
```

**Alternative: Non-Interactive Setup**

```bash
# Clone with configuration in one command
gw init git@github.com:user/repo.git \
  --auto-copy-files .env,secrets/ \
  --post-checkout "pnpm install"

# Then set up secrets in main worktree as shown above
cd repo.git/main
cp .env.example .env
# Edit .env with your secrets
```

### Why This Matters

- **`gw checkout`** copies files **from** your `defaultBranch` worktree **to** the new worktree
- **`gw sync`** also uses `defaultBranch` as the source (unless `--from` is specified)
- **Auto-clean** will **never** remove the `defaultBranch` worktree, ensuring your source files are always available
- If secrets don't exist in `defaultBranch`, they won't be copied to new worktrees

### Keeping Secrets Updated

When you update secrets in your `defaultBranch` worktree, sync them to existing worktrees:

```bash
# Sync all autoCopyFiles to an existing worktree
gw sync feat-existing-branch

# Or sync specific files
gw sync feat-existing-branch .env
```

## Features

- **Easy setup**: Clone and configure repositories in one command with `gw init <url> --interactive`
- **Quick navigation**: Navigate to worktrees instantly with smart partial matching (`gw cd feat` finds `feat-branch`)
- **Smart checkout**: `gw checkout` handles worktree-specific scenarios, navigating to branches checked out elsewhere instead of showing errors, and properly recreating local tracking branches from remote after `gw remove`
- **Auto-copy files**: Configure once, automatically copy `.env`, secrets, and config files to every new worktree
- **Hooks support**: Run commands before/after worktree creation (install dependencies, validate setup, etc.)
- **Copy files between worktrees**: Easily copy secrets, environment files, and configurations from one worktree to another
- **Automatic shell integration**: Eval-based shell integration keeps `gw cd` navigation always up-to-date
- **Auto-configured per repository**: Each repository gets its own local config file, automatically created on first use
- **Dry-run mode**: Preview what would be copied without making changes
- **Standalone binary**: Compiles to a single executable with no runtime dependencies

## Installation

### Via Homebrew (macOS)

For macOS users, the easiest way to install is via Homebrew:

```bash
brew install mthines/gw-tools/gw
```

### Via npm

Install globally using npm:

```bash
npm install -g @gw-tools/gw
```

This will download the appropriate binary for your platform (macOS, Linux, or Windows) and make the `gw` command available globally.

**Supported Platforms:**

- macOS (Intel & Apple Silicon)
- Linux (x64 & ARM64)
- Windows (x64)

### Build from source

If you prefer to build from source:

```bash
# Clone the repository
git clone https://github.com/mthines/gw-tools.git
cd gw-tools

# Build the project
nx run gw-tool:compile

# The binary will be created at dist/packages/gw-tool/gw
# You can copy it to a directory in your PATH for global access
cp dist/packages/gw-tool/gw /usr/local/bin/gw
```

## Configuration

On first run, `gw` will automatically detect your git repository root and create a configuration file at `.gw/config.json`. The tool finds the config by walking up the directory tree from your current location, so you can run `gw` commands from anywhere within your repository.

**The `.gw/config.json` file is safe to commit to your repository.** It contains only portable settings — no machine-specific paths or runtime state. The `root` field has been removed; gw auto-detects the repository root from the config file location. Runtime state like cleanup timestamps is managed internally and never written to the config file.

### Auto-Detection

The tool automatically:

1. **Searches for existing config**: Walks up from your current directory looking for `.gw/config.json`
2. **Auto-detects git root**: Derives the git root from the config file's location (or detects it if no config exists)
3. **Creates config**: Saves default settings to `.gw/config.json` in your worktree root

Config is created inside the current worktree so it can be committed to git and shared with your team. This means everyone gets the same `autoCopyFiles`, `hooks`, `defaultBranch`, etc. without each person having to configure it.

```bash
# Initialize and commit (one-time, from any worktree)
gw init --auto-copy-files .env --post-checkout "pnpm install"
git add .gw/config.json
git commit -m "chore: share gw config"
```

If auto-detection fails (rare edge cases), you can manually specify the root:

```bash
gw init --root /path/to/your/repo.git
```

### Example Configuration

```jsonc
{
  "defaultBranch": "main",
  // Auto-copy these files when creating new worktrees
  "autoCopyFiles": [".env", "components/agents/.env", "components/ui/.vercel/"],
  "hooks": {
    "checkout": {
      "pre": ["echo 'Creating worktree: {worktree}'"],
      "post": ["pnpm install", "echo 'Setup complete!'"],
    },
  },
  "cleanThreshold": 7,
  "autoClean": true,
  "updateStrategy": "merge",
}
```

**JSONC Support**: Configuration files support JSONC (JSON with Comments) with `//` single-line comments, `/* */` multi-line comments, and trailing commas. When you run `gw init`, it generates a comprehensive self-documenting template with inline documentation for all available options. Active features are shown uncommented while inactive features appear as commented examples with usage patterns.

**More Examples**: See the [examples/](./examples/) directory for configuration templates for various project types (Next.js, Node.js API, monorepos, CI/CD, etc.).

### Configuration Options

All fields are optional and safe to commit — no machine-specific paths or runtime state is stored.

- **defaultBranch**: Default source worktree name (defaults to "main")
- **autoCopyFiles**: Array of file/directory paths to automatically copy when creating worktrees with `gw checkout` (set via `gw init --auto-copy-files`)
- **hooks**: Command hooks configuration (set via `gw init --pre-checkout` and `--post-checkout`)
  - **hooks.checkout.pre**: Array of commands to run before creating a worktree
  - **hooks.checkout.post**: Array of commands to run after creating a worktree
- **cleanThreshold**: Number of days before worktrees are considered stale for `gw clean` (defaults to 7, set via `gw init --clean-threshold`)
- **autoClean**: Silently remove stale worktrees in the background when running `gw checkout` or `gw list` (defaults to false, set via `gw init --auto-clean`)
- **updateStrategy**: Default strategy for `gw update` command: "merge" or "rebase" (defaults to "merge", set via `gw init --update-strategy`)
- **protectedBranches**: Array of branch names protected from `gw clean` and auto-clean (managed with `gw protect` / `gw unprotect`)

### Local Overrides (`config.local.json`)

Create `.gw/config.local.json` to override any config value for your machine only. It's automatically gitignored by `.gw/.gitignore`.

```jsonc
// .gw/config.local.json — personal overrides, not committed
{
  "autoCopyFiles": [".env", ".env.local", "my-personal-config.json"],
}
```

Local config is merged on top of `config.json` (shallow merge, local wins). Useful for adding personal files to `autoCopyFiles` without modifying the team config.

## Commands

### checkout

Create a new git worktree, switch to an existing branch, or navigate to a worktree where a branch is checked out. This is the primary command for working with branches in a worktree workflow.

**Aliases:** `co`, `add` (for backwards compatibility)

```bash
gw checkout <branch-name> [files...]
# or use aliases
gw co <branch-name>
gw add <branch-name>  # backwards-compatible alias
```

This unified command handles all branch operations in a worktree workflow:

1. **Branch exists locally, not checked out:** Creates a worktree for it
2. **Branch is checked out in another worktree:** Navigates to that worktree
3. **Branch exists on remote only:** Prompts to create a worktree for it
4. **Branch doesn't exist:** Creates a new branch from the default branch and a worktree for it
5. **Already on the branch:** Shows "Already on branch" message

If `autoCopyFiles` is configured, those files are automatically copied when creating new worktrees. You can override this by specifying files as arguments.

**Branch Creation Behavior:**
When creating a new worktree without specifying an existing branch, `gw checkout` automatically fetches the latest version of your default branch (e.g., `main`) from the remote (e.g., `origin/main`) to ensure your new branch is based on the most recent code. You can override this with the `--from <branch>` option to create a branch from a different source branch instead.

**Branch Handling:**
`gw checkout` intelligently handles different branch scenarios:

1. **Local branches**: If the branch already exists locally, it's used directly. No network access required.

2. **Remote-only branches**: If the branch exists only on remote (e.g., `origin/feat/something`), `gw checkout` fetches it and creates a proper local tracking branch. This ensures `git push` and `git pull` work correctly.

3. **New branches**: If the branch doesn't exist anywhere, it's created from the source branch (defaultBranch or `--from` branch) after fetching the latest from remote.

**Remote Probe (catching teammates' pushes):**
When the requested branch isn't local, `gw checkout` queries the remote (`git ls-remote origin refs/heads/<branch>`) before deciding it's a brand-new branch. This catches branches a teammate just pushed that you haven't fetched yet — without it, `gw` would silently create a new branch with the same name from the default branch and you'd diverge. The probe uses a 3-second timeout and is silent on miss. Use `--no-fetch` to skip it (offline mode). The probe is also skipped automatically when you pass `-b`/`-B` or `--from`, since those signal you want a brand-new branch.

**Network Behavior:**

- **Branch not local**: Probes remote with `git ls-remote` (3s timeout, skipped with `--no-fetch`)
- **New branches without `--from`**: Fetches defaultBranch from remote, falls back to local if fetch fails (offline support)
- **New branches with `--from`**: Requires successful remote fetch, exits on failure (ensures fresh code)
- **Local branches**: Used directly without network access
- **Remote-only branches**: Fetches and creates local tracking branch, uses cached remote ref if fetch fails

**Network Failure Handling:**

- When using `--from` with an explicit branch, the command requires a successful fetch from the remote to ensure you're working with the latest code. If the fetch fails (network issues, branch doesn't exist on remote, authentication problems), the command will exit with a detailed error message and suggestions for resolution.
- For local branches, no network is required.
- For remote-only branches or new branches without `--from`, fetch failures trigger a warning but allow creation using local/cached refs.

**Upstream Tracking:**
When `gw checkout` creates a new branch, it automatically configures the branch to track `origin/<branch-name>` (e.g., `origin/feat/my-feature`). This means `git push` will push to the correct remote branch without needing to specify `-u origin <branch>` on first push.

**Git Ref Conflict Detection:**
The command automatically detects and prevents Git ref naming conflicts. For example, you cannot have both a branch named `test` and `test/foo` because Git stores branches as files in `.git/refs/heads/`, and `test` cannot be both a file and a directory. If a conflict is detected, you'll receive a helpful error message with suggestions for resolving it.

**Automatic Navigation:**
After successfully creating a new worktree, the command automatically navigates to the new worktree directory. This requires shell integration to be installed (see [install-shell](#install-shell)). Use the `--no-cd` flag to skip automatic navigation.

**Existing Worktree Navigation:**
If you try to add a worktree that already exists, the command will prompt you to navigate to it instead. Press Enter (default: Yes) to navigate, or type 'n' to cancel. This requires shell integration to be installed (see [install-shell](#install-shell)).

#### Arguments

- `<branch-name>`: Branch name to checkout or create
- `[files...]`: Optional files to copy (overrides `autoCopyFiles` config)

#### Options

- `--no-cd`: Don't navigate to the new worktree after creation
- `--no-fetch`: Skip the remote probe (offline mode); don't query origin for branches that aren't yet local
- `--no-hooks`: Skip pre- and post-checkout hooks for this run
- `--from <branch>`: Create new branch from specified branch instead of `defaultBranch`
- `--from-staged`: Copy staged files from current worktree to new worktree (see [Staged Files](#staged-files))

All `git worktree add` options are supported:

- `-b <branch>`: Create a new branch
- `-B <branch>`: Create or reset a branch
- `--detach`: Detach HEAD in new worktree
- `--force, -f`: Force checkout even if already checked out
- `--track`: Track branch from remote
- `-h, --help`: Show help message

#### Examples

```bash
# Create worktree for new branch (auto-copies files if autoCopyFiles is configured)
# Automatically navigates to new worktree
gw checkout feat/new-feature
gw co feat/new-feature  # Using alias

# Navigate to worktree where main is already checked out
gw checkout main
# Output: Branch main is checked out in another worktree:
#   /path/to/repo/main
#
# Navigating there...

# Create worktree without navigating to it
gw checkout feat/new-feature --no-cd

# Create worktree without running pre/post-checkout hooks
gw checkout feat/new-feature --no-hooks

# Create worktree from a different branch instead of defaultBranch
gw checkout feat/new-feature --from develop

# Create child feature branch from parent feature branch
gw checkout feat/child-feature --from feat/parent-feature

# Create worktree with new branch
gw checkout feat/new-feature -b my-branch

# Create worktree and copy specific files (overrides config)
gw checkout feat/new-feature .env secrets/

# Force create even if branch exists elsewhere
gw checkout feat/bugfix -f

# Create worktree for remote-only branch (auto-creates local tracking branch)
gw checkout remote-feature
# Output: Branch remote-feature exists on remote but not locally, creating from remote...
# Creates worktree with proper local tracking branch (git push/pull work automatically)

# Already on the branch
gw checkout current-branch
# Output: Already on 'current-branch'

# Extract staged files to a new worktree
gw checkout feat/extracted-work --from-staged
# Output: Copies all staged files from current worktree to new worktree

# Extract specific staged files
gw checkout feat/extracted-work --from-staged src/new-feature.ts tests/
# Output: Only copies the specified files (if they are staged)
```

#### Staged Files

The `--from-staged` flag allows you to extract staged changes from your current worktree into a new worktree. This is useful when you've started work that belongs in a different branch:

```bash
# 1. Stage the files you want to extract
git add src/new-feature.ts tests/new-feature.test.ts

# 2. Create new worktree with staged files
gw checkout feat/new-feature --from-staged

# 3. Your staged files are now in the new worktree
# The original worktree is unchanged (files remain staged)
```

**Behavior:**

- **All staged files**: `gw checkout <branch> --from-staged` copies all staged files
- **Specific files**: `gw checkout <branch> --from-staged file1 file2` only copies those files (must be staged)
- **autoCopyFiles still applies**: Config files like `.env` are still copied alongside staged files
- **Deleted files skipped**: Files staged for deletion are skipped (nothing to copy)
- **Atomic operation**: If any file fails to copy, the worktree is removed

**Use cases:**

- Started feature work but realized it should be a separate branch
- Need to split a large PR into smaller pieces
- Want to test changes in isolation without committing first

#### Auto-Copy Configuration

To enable automatic file copying, configure `autoCopyFiles` using `gw init`:

```bash
gw init --auto-copy-files .env,secrets/,components/ui/.vercel/
```

This creates:

```json
{
  "defaultBranch": "main",
  "autoCopyFiles": [".env", "secrets/", "components/ui/.vercel/"]
}
```

Now every time you run `gw checkout`, these files will be automatically copied from your default source worktree (usually `main`) to the new worktree.

#### Hooks

You can configure pre-checkout and post-checkout hooks to run commands before and after worktree creation. This is useful for:

- **Pre-checkout hooks**: Running validation scripts, checking prerequisites
- **Post-checkout hooks**: Installing dependencies, setting up the environment

```bash
# Configure a post-checkout hook to install dependencies
gw init --post-checkout "pnpm install"

# Configure multiple hooks
gw init --pre-checkout "echo 'Creating: {worktree}'" --post-checkout "pnpm install" --post-checkout "echo 'Done!'"
```

**Hook Variables:**

Hooks support variable substitution:

- `{worktree}` - The worktree name (e.g., "feat/new-feature")
- `{worktreePath}` - Full absolute path to the worktree
- `{gitRoot}` - The git repository root path
- `{branch}` - The branch name

**Hook Behavior:**

- **Pre-checkout hooks** run before the worktree is created (in the git root directory). If any pre-checkout hook fails, the worktree creation is aborted.
- **Post-checkout hooks** run after the worktree is created and files are copied (in the new worktree directory). If a post-checkout hook fails, a warning is shown but the worktree creation is considered successful.

**Example: Auto-install dependencies**

```bash
# One-time setup
gw init --auto-copy-files .env --post-checkout "pnpm install"

# Now when you create a worktree:
gw checkout feat/new-feature
# 1. Creates the worktree
# 2. Copies .env file
# 3. Runs pnpm install in the new worktree
```

### Machine-Readable Progress

When running `gw checkout` from a tooling integration (VS Code, CI scripts), you can stream structured progress events to stderr by passing `--progress=json`. Stdout is unaffected (remains clean for piping).

#### Flag

```
--progress=json    Emit NDJSON progress events to stderr.
                   Intended for tooling integrations (VS Code, CI).
```

This is a **global flag** — it can be placed anywhere in the command:

```bash
gw checkout feat/my-branch --progress=json
```

#### Schema

Every event is a JSON object followed by a newline (`\n`). Schema version is always `1`.

```typescript
interface ProgressEvent {
  version: 1; // always 1
  stage: ProgressStage;
  status: 'start' | 'end' | 'error';
  hook?: number; // 1-based index (hook stages only)
  of?: number; // total hook count (hook stages only)
  command?: string; // expanded hook command (hook stages only)
  durationMs?: number; // elapsed ms (end events only — absent on start)
  message?: string; // error detail (error events only)
  exitCode?: number; // process exit code (error events only)
}

type ProgressStage =
  | 'pre-checkout-hooks'
  | 'create-worktree'
  | 'copy-files'
  | 'copy-staged-files'
  | 'post-checkout-hooks';
```

Note: `durationMs` is **absent** on `start` events (sparse JSON, not `null`). This keeps jq consumers clean.

#### Examples

```jsonc
// Stage boundaries:
{"version":1,"stage":"create-worktree","status":"start"}
{"version":1,"stage":"create-worktree","status":"end","durationMs":1842}

// Per-hook events:
{"version":1,"stage":"post-checkout-hooks","status":"start","hook":1,"of":1,"command":"pnpm install"}
{"version":1,"stage":"post-checkout-hooks","status":"end","hook":1,"of":1,"durationMs":47210}

// Error events (emitted before non-zero exit):
{"version":1,"stage":"create-worktree","status":"error","message":"git worktree add failed with exit code 128","exitCode":128}
{"version":1,"stage":"post-checkout-hooks","status":"error","hook":1,"of":1,"message":"Hook failed with exit code 1","exitCode":1}
```

#### Inspect with jq

```bash
# Print all events (redirect stderr to stdout, suppress stdout)
gw checkout feat/my-branch --progress=json 2>&1 1>/dev/null | jq .

# Watch only stage names
gw checkout feat/my-branch --progress=json 2>&1 1>/dev/null | jq -r '"\(.status) \(.stage)"'

# Filter for errors
gw checkout feat/my-branch --progress=json 2>&1 1>/dev/null | jq 'select(.status == "error")'
```

#### VS Code Extension

The VS Code extension (`vscode-gw`) uses `--progress=json` automatically to update the progress notification subtitle during `gw checkout`. You will see labels like:

- `Creating worktree` — while git runs
- `Running post-checkout hook 1/1 — pnpm install` — while hooks execute
- `Copying config files` — while auto-copy files are copied

---

### cd

Navigate directly to a worktree by name or partial match. The command uses smart matching to find worktrees, searching both branch names and worktree paths.

```bash
gw cd <worktree>
```

#### Arguments

- `<worktree>`: Name or partial name of the worktree (matches branch name or path)

#### Examples

```bash
# Navigate to a worktree by exact name
gw cd feat-branch

# Navigate using partial match (finds "feat/new-feature")
gw cd feat

# If multiple matches found, shows list with helpful error:
gw cd api
# Output: Multiple worktrees match "api":
#   api-refactor -> /path/to/repo/api-refactor
#   graphql-api -> /path/to/repo/graphql-api
```

#### How It Works

The `cd` command integrates with your shell through an eval-based function (see [install-shell](#install-shell)). When you run `gw cd <worktree>`:

1. The command finds the matching worktree path
2. The shell function intercepts the call and navigates you there
3. All other `gw` commands pass through normally

**Note**: Shell integration is set up automatically when you install via npm. You can also add it manually by adding `eval "$(gw install-shell)"` to your shell config.

### pr

Check out a pull request into a new worktree. This command fetches a PR's branch and creates a worktree for it in one step, making it easy to review, test, or contribute to pull requests.

```bash
gw pr <pr-number|pr-url>
```

When you want to review or test a pull request, you typically need to:

1. Find the PR's branch name
2. Fetch the branch (especially for forks)
3. Create a worktree for it
4. Navigate to the worktree

The `gw pr` command does all of this in a single step.

#### Arguments

- `<pr-number|pr-url>`: PR number (e.g., 42) or GitHub PR URL

#### Options

- `--name <name>`: Custom name for the worktree directory (defaults to PR's branch name)
- `--no-cd`: Don't navigate to the new worktree after creation
- `--no-hooks`: Skip pre- and post-checkout hooks for this run
- `-h, --help`: Show help message

#### Examples

```bash
# Check out PR #42
gw pr 42

# Check out PR by URL
gw pr https://github.com/user/repo/pull/42

# Use custom worktree name
gw pr 42 --name review-feature

# Check out without auto-navigation
gw pr 42 --no-cd

# Check out a PR without running checkout hooks
gw pr 42 --no-hooks
```

#### Requirements

- **GitHub CLI (gh)** must be installed and authenticated
- Install from: https://cli.github.com/
- After installation, authenticate with: `gh auth login`

#### How It Works

1. **Resolves PR info**: Uses `gh pr view` to get the PR's branch name and fork information
2. **Validates URL** (if provided): Ensures the PR URL matches the current repository
3. **Checks for existing worktree**: If the branch is already checked out, offers to navigate there
4. **Fetches PR branch**: Uses `git fetch origin pull/<number>/head:<branch>` pattern which works for both same-repo and fork PRs
5. **Creates worktree**: Creates a new worktree with the PR's branch
6. **Copies files**: Auto-copies files from `autoCopyFiles` config (same as `gw checkout`)
7. **Runs hooks**: Executes pre-checkout and post-checkout hooks (same as `gw checkout`)
8. **Navigates**: Automatically navigates to the new worktree

**Fork Handling:**
The command automatically handles PRs from forks by using GitHub's `pull/<number>/head` ref pattern. This fetches the PR branch without needing to add the fork as a remote.

**Error Handling:**

- If `gh` is not installed, shows installation instructions
- If PR is not found, shows helpful error with authentication hint
- If PR URL is for a different repository, shows clear error message

### update

Update your current worktree with the latest changes from the default branch (or specified branch) using either merge or rebase strategy. This is useful when you want to update your feature branch with the latest changes from main without having to switch worktrees.

```bash
gw update [options]
```

When working in a worktree, you cannot easily checkout main to pull the latest changes because main is typically checked out in another worktree. The `gw update` command solves this by fetching the latest version of the default branch and updating your current branch using your configured strategy (merge or rebase).

**Alternative:** If you need to work on the main branch directly, use `gw checkout main` to navigate to the main worktree instead of trying to check it out in your current worktree.

#### Options

- `--from <branch>`: Update from specified branch instead of defaultBranch (e.g., `--from develop`)
- `--from-pr <n|url>`: Update from a pull request by number or GitHub PR URL (mutually exclusive with `--from`)
- `--remote <name>`: Specify remote name (default: "origin")
- `-m, --merge`: Force merge strategy (overrides configured strategy)
- `-r, --rebase`: Force rebase strategy (overrides configured strategy)
- `-f, --force`: Skip uncommitted changes check (not recommended)
- `-n, --dry-run`: Preview what would happen without executing
- `-h, --help`: Show help message

#### Examples

```bash
# Update with configured strategy (or merge if not configured)
gw update

# Force merge even if rebase is configured
gw update --merge

# Force rebase even if merge is configured
gw update --rebase

# Update from a specific branch
gw update --from develop

# Update from a pull request (by number)
gw update --from-pr 42

# Update from a pull request (by GitHub URL)
gw update --from-pr https://github.com/owner/repo/pull/42

# Rebase onto a PR head instead of merging
gw update --from-pr 42 --rebase

# Preview what would happen without executing
gw update --dry-run

# Preview merge from a PR without executing
gw update --from-pr 42 --dry-run

# Force update even with uncommitted changes (not recommended)
gw update --force

# Use a different remote
gw update --remote upstream
```

#### Updating from a Pull Request (`--from-pr`)

The `--from-pr` flag lets you merge or rebase the current branch onto a PR's
head commit without checking out the PR branch. This is useful when you want
to test how your feature branch integrates with a colleague's PR that is still
in review.

```bash
# Merge PR #42 into the current worktree branch
gw update --from-pr 42

# Rebase the current branch onto PR #42
gw update --from-pr 42 --rebase

# Works with full GitHub URLs too (trailing paths and fragments are stripped)
gw update --from-pr https://github.com/owner/repo/pull/42/files
```

How it works:

1. Resolves the PR number from the bare number or GitHub URL
2. Guards against non-GitHub remotes (`--from-pr` requires a GitHub remote)
3. Force-fetches `refs/pull/<n>/head` into `refs/remotes/<remote>/pr/<n>`
   (the `+` prefix ensures force-pushed PRs always overwrite stale cached refs)
4. Proceeds with the normal merge/rebase pipeline using the fetched ref
5. Optionally enriches the display label with the PR title via `gh` (silent if `gh` is absent or unauthenticated)

Requirements:

- A GitHub remote (the remote URL must contain `github.com`)
- Network access to fetch the PR ref
- `gh` CLI is **optional** — only used to show the PR title in output

#### How It Works

1. Fetches the latest version of the target branch from remote (e.g., `origin/main`)
2. Updates your current worktree's active branch using the configured strategy
3. With **merge**: Creates merge commit if histories have diverged
4. With **rebase**: Replays your commits on top of the latest changes

**Safety checks:**

- Blocks if you have uncommitted changes (use `--force` to override)
- Blocks if you're in a detached HEAD state
- Handles merge/rebase conflicts gracefully with clear guidance

**Network Failure Handling:**

- When using `--from` with an explicit branch, the command requires a successful fetch from the remote to ensure you're updating with the latest code. If the fetch fails (network issues, branch doesn't exist on remote, authentication problems), the command will exit with a detailed error message and suggestions for resolution.
- When no `--from` is specified (using default branch) or when no remote is configured, the command will warn about fetch failures but allow the update using the local branch.
- When using `--from-pr`, a successful fetch is always required. The command exits with a clear error message if the fetch fails.

**Update strategy:**

The strategy can be configured in `.gw/config.json` or overridden per-command:

- **merge** (default): Creates merge commits, preserves complete history
- **rebase**: Replays commits for linear history, cleaner but rewrites history

Strategy precedence: CLI flags (`--merge`/`--rebase`) > config (`updateStrategy`) > default (merge)

**Configuration:**

The default branch and update strategy are read from `.gw/config.json`:

```json
{
  "defaultBranch": "main",
  "updateStrategy": "merge"
}
```

If not configured, defaults to "main" branch and "merge" strategy.

### install-shell

Output shell integration code for the `gw cd` command, enable real-time streaming output, and register TAB completions. The shell code is always generated from the current binary, so updates happen automatically.

Shell integration provides:

- **Navigation support**: `gw cd <worktree>` navigates directly to worktrees
- **Real-time streaming**: Command output streams as it's generated (no buffering)
- **Auto-navigation**: Automatically navigate after `gw checkout` and `gw remove` operations
- **TAB completions**: Complete subcommands, branch names, worktree names, and flags
- **Multi-alias support**: Install for different command names (e.g., `gw-dev` for development)

```bash
# Add to ~/.zshrc or ~/.bashrc
eval "$(gw install-shell)"

# Add to ~/.config/fish/config.fish
gw install-shell | source
```

#### Options

- `--name, -n NAME`: Output for a different command name (default: `gw`)
- `--command, -c CMD`: Actual command to run (use with `--name` for aliases/dev)
- `--remove`: Remove shell integration from config files
- `--quiet, -q`: Suppress output messages (for `--remove`)
- `-h, --help`: Show help message

#### Examples

```bash
# Preview the shell function output
gw install-shell

# Add to your shell config (zsh/bash)
echo 'eval "$(gw install-shell)"' >> ~/.zshrc

# Add for development (with Deno)
echo 'eval "$(gw install-shell --name gw-dev --command \"deno run --allow-all ~/path/to/main.ts\")"' >> ~/.zshrc

# Remove shell integration (legacy files + eval lines)
gw install-shell --remove
```

**Supported Shells:**

- **Zsh**: `eval "$(gw install-shell)"` in `~/.zshrc`
- **Bash**: `eval "$(gw install-shell)"` in `~/.bashrc`
- **Fish**: `gw install-shell | source` in `~/.config/fish/config.fish`

The `--remove` flag cleans up both the new eval-based format and any legacy file-based installations.

#### Migrating from File-Based Integration

If you previously used `gw install-shell` (before v0.22), you had file-based integration:

- `~/.gw/shell/integration.zsh` (or `.bash`)
- A source line in your shell config

To migrate to the new eval-based approach:

1. Remove old integration:

   ```bash
   gw install-shell --remove
   ```

2. Add new integration to your shell config:

   ```bash
   # Zsh (~/.zshrc)
   eval "$(gw install-shell)"

   # Bash (~/.bashrc)
   eval "$(gw install-shell)"

   # Fish (~/.config/fish/config.fish)
   gw install-shell | source
   ```

3. Restart your terminal or source your config:
   ```bash
   source ~/.zshrc  # or ~/.bashrc
   ```

**Why the change?** The eval-based approach ensures shell integration stays up-to-date automatically when gw is updated, without requiring manual reinstallation.

### root

Get the root directory of the current git repository. For git worktrees, returns the parent directory containing all worktrees.

```bash
gw root
```

This command is useful when working with git worktrees to find the main repository directory that contains all worktrees, regardless of how deeply nested you are in the directory structure.

#### Examples

```bash
# Get repository root path
gw root
# Output: /Users/username/Workspace/my-project.git

# Navigate to repository root
cd "$(gw root)"

# List all worktrees
ls "$(gw root)"

# Use in scripts
REPO_ROOT=$(gw root)
echo "Repository is at: $REPO_ROOT"

# Works from any depth
cd /Users/username/Workspace/my-project.git/feat/deeply/nested/folder
gw root
# Output: /Users/username/Workspace/my-project.git
```

#### How It Works

- **In a worktree**: Returns the parent directory containing all worktrees (e.g., `/path/to/repo.git`)
- **In a regular repo**: Returns the directory containing the `.git` directory
- **From nested directories**: Walks up the directory tree to find the repository root

### init

Initialize gw configuration for a git repository. This is the recommended way to get started with gw.

**Two modes:**

1. **Clone mode**: Clone a repository and automatically set it up with gw (recommended for new projects)
2. **Existing repo mode**: Initialize gw in an existing repository

```bash
gw init [repository-url] [directory] [options]
```

#### Options

- `-i, --interactive`: Interactively prompt for configuration options
- `--root <path>`: Specify the git repository root path (optional, auto-detects if not provided)
- `--default-source <name>`: Set the default source worktree (default: "main")
- `--auto-copy-files <files>`: Comma-separated list of files to auto-copy when creating worktrees with `gw checkout`
- `--pre-checkout <command>`: Command to run before `gw checkout` creates a worktree (can be specified multiple times)
- `--post-checkout <command>`: Command to run after `gw checkout` creates a worktree (can be specified multiple times)
- `--clean-threshold <days>`: Number of days before worktrees are considered stale for `gw clean` (default: 7)
- `--auto-clean`: Enable silent background cleanup of stale worktrees (runs non-blocking on `gw checkout` and `gw list` with 24-hour cooldown)
- `--update-strategy <strategy>`: Set default update strategy: 'merge' or 'rebase' (default: merge)
- `-h, --help`: Show help message

#### Clone Examples

Clone a repository and automatically set it up with gw configuration. **This is the recommended way to start using gw with a new project.**

```bash
# Clone and configure interactively (RECOMMENDED - prompts for all options)
gw init git@github.com:user/repo.git --interactive
# Prompts for:
# - Auto-copy files (.env, secrets/, etc.)
# - Pre-checkout and post-checkout hooks (pnpm install, etc.)
# - Clean threshold
# - Update strategy
# Then automatically creates the main worktree and navigates to the repo

# Clone with configuration in one command (non-interactive)
gw init git@github.com:user/repo.git \
  --auto-copy-files .env,secrets/ \
  --post-checkout "pnpm install"

# Clone into specific directory
gw init git@github.com:user/repo.git my-project --interactive

# Clone with HTTPS URL
gw init https://github.com/user/repo.git --interactive

# Simple clone with defaults (no configuration yet)
gw init git@github.com:user/repo.git
```

**What happens when you clone with `gw init`:**

1. Clones the repository with `--no-checkout`
2. Creates a `gw_root` branch
3. Auto-detects the default branch from the remote
4. Creates gw configuration (`.gw/config.json`)
5. Creates the default branch worktree (e.g., `main`)
6. Automatically navigates to the repository directory (requires shell integration)

**Empty repositories** are handled automatically — if the remote has no branches or commits, `gw init` creates an initial commit on `gw_root` and sets up the default branch worktree from it.

**Benefits:**

- No need to manually run `git clone --bare` or `git worktree add`
- Configuration is set up immediately
- Ready to use `gw checkout` right away
- Works with both existing and empty repositories

**Notes:**

- Cloned repositories use the `.git` suffix (e.g., `repo.git`) following bare repository conventions
- After cloning, you're automatically in the repository root and can run `cd main` or `gw cd main`
- Shell integration must be installed (`gw install-shell`) for automatic navigation to work

#### Existing Repository Examples

Initialize gw in an existing repository:

```bash
# Interactive mode - prompts for all configuration options
# If not in a git repo, will first prompt for repository URL to clone
gw init --interactive

# Initialize with auto-detected root
gw init

# Initialize with auto-copy files
gw init --auto-copy-files .env,secrets/

# Initialize with post-add hook to install dependencies
gw init --post-checkout "pnpm install"

# Initialize with pre-add validation hook
gw init --pre-checkout "echo 'Creating worktree: {worktree}'"

# Initialize with multiple hooks
gw init --pre-checkout "echo 'Starting...'" --post-checkout "pnpm install" --post-checkout "echo 'Done!'"

# Initialize with custom default source
gw init --default-source master

# Initialize with explicit repository root
gw init --root /Users/username/Workspace/my-project.git

# Initialize with custom clean threshold (14 days instead of default 7)
gw init --clean-threshold 14

# Initialize with update strategy
gw init --update-strategy rebase

# Full configuration example
gw init --auto-copy-files .env,secrets/ --post-checkout "pnpm install" --clean-threshold 14 --update-strategy merge

# Show help
gw init --help
```

#### Hook Variables

Hooks support variable substitution:

- `{worktree}` - The worktree name (e.g., "feat/new-feature")
- `{worktreePath}` - Full absolute path to the worktree
- `{gitRoot}` - The git repository root path
- `{branch}` - The branch name

#### Auto-Cleanup Configuration

Enable interactive cleanup prompts for stale worktrees to keep your repository clean:

```bash
# Enable auto-cleanup with default 7-day threshold
gw init --auto-clean

# Enable with custom threshold (14 days)
gw init --auto-clean --clean-threshold 14

# Enable with other options
gw init --auto-clean --auto-copy-files .env --post-checkout "pnpm install"
```

**How it works:**

- Prompts after `gw checkout` and `gw list` commands when stale worktrees are detected
- Only prompts once per 24 hours (cooldown)
- **Never removes the `defaultBranch` or `gw_root` worktrees** - they're protected
- Checks for worktrees older than `cleanThreshold` with:
  - No uncommitted changes
  - No staged files
  - No unpushed commits
- Shows list of branches before prompting:

  ```
  🧹 Found stale worktrees to clean:

    ✗ feat/old-feature (10 days old)
    ✗ fix/bug-123 (8 days old)

  Clean 2 worktrees? [Y/n]:
  ```

- Press Enter or `y` to remove them, or `n` to skip
- Shows brief summary after cleanup: `✓ Removed 2 stale worktrees`
- Never interrupts or fails the main command

This is an opt-in feature. Use `gw clean` for manual, interactive cleanup with more control.

#### When to Use

Use `gw init` to:

- Configure auto-copy files for automatic file copying on worktree creation
- Set up pre-add and post-add hooks for automation
- Configure the clean threshold for worktree age management
- Override the auto-detected repository root (rare)
- Change the default source worktree from "main" to something else

The config file is created at `.gw/config.json` at the git root, so it's shared across all worktrees.

### show-init

Generate a `gw init` command that matches your current configuration. This is useful for documentation or recreating the same configuration in another repository.

```bash
gw show-init [options]
```

#### Options

- `-h, --help`: Show help message

#### Examples

```bash
# Show the init command for current config
gw show-init

# Copy the command to clipboard (macOS)
gw show-init | pbcopy

# Copy the command to clipboard (Linux with xclip)
gw show-init | xclip -selection clipboard

# Save to a file
gw show-init > init-command.txt

# Add to your documentation
echo "## Setup\n\n\`\`\`bash\n$(gw show-init)\n\`\`\`" >> README.md
```

#### Output Example

If your `.gw/config.json` contains:

```json
{
  "defaultBranch": "main",
  "autoCopyFiles": [".env", "secrets/"],
  "hooks": {
    "checkout": {
      "post": ["pnpm install"]
    }
  },
  "cleanThreshold": 7,
  "updateStrategy": "rebase"
}
```

Then `gw show-init` will output:

```bash
gw init --root /Users/username/Workspace/repo.git --auto-copy-files .env,secrets/ --post-checkout 'pnpm install' --update-strategy rebase
```

#### When to Use

Use `gw show-init` to:

- Document your setup in README files or team wikis
- Share configuration commands with team members
- Recreate the same configuration in another repository
- Verify your current configuration settings as a single command

### sync

Sync files and directories between worktrees, preserving directory structure.

```bash
gw sync [options] [target-worktree] [files...]
```

#### Arguments

- `[target-worktree]`: Name or full path of the target worktree. If omitted, defaults to the current worktree
- `[files...]`: One or more files or directories to sync (paths relative to worktree root). If omitted, uses `autoCopyFiles` from `.gw/config.json`

#### Options

- `--from <source>`: Source worktree name (default: from config or "main")
- `-n, --dry-run`: Show what would be synced without actually syncing
- `-h, --help`: Show help message

#### Examples

```bash
# Sync autoCopyFiles to current worktree (if inside a worktree)
gw sync

# Sync autoCopyFiles from config to a specific target
gw sync feat-branch

# Sync .env file from main to feat-branch
gw sync feat-branch .env

# Sync multiple files
gw sync feat-branch .env components/agents/.env components/agents/agents.yaml

# Sync entire directory
gw sync feat-branch components/ui/.vercel

# Use custom source worktree
gw sync --from develop feat-branch .env

# Dry run to preview changes
gw sync --dry-run feat-branch .env

# Use absolute path as target
gw sync /full/path/to/repo/feat-branch .env
```

### clean

Remove safe worktrees with no uncommitted changes and no unpushed commits. By default, removes **ALL** safe worktrees regardless of age. Use `--use-autoclean-threshold` to only remove worktrees older than the configured threshold.

**Automatic Pruning:** The clean command automatically runs `git worktree prune` before listing worktrees, ensuring only worktrees that actually exist on disk are shown. This prevents "phantom" worktrees (manually deleted directories) from appearing in the list. After removing worktrees, it also automatically prunes any orphan branches (branches with no associated worktree and no unpushed commits).

**Note:** For automatic cleanup, see `gw init --auto-clean`. The `clean` command provides interactive, manual cleanup with detailed output and confirmation prompts.

```bash
gw clean [options]
```

#### Options

- `-i, --interactive`: Interactive mode — select worktrees, branches, and orphan branches to remove using a multi-select checklist. Uses arrow keys to navigate, space to toggle, enter to confirm, Ctrl+C to cancel. **WARNING:** Uses force deletion for all selected items
- `--use-autoclean-threshold`: Only remove worktrees older than configured threshold (default: 7 days)
- `-f, --force`: Skip safety checks (uncommitted changes, unpushed commits). WARNING: This may result in data loss
- `-n, --dry-run`: Preview what would be removed without actually removing
- `--json`: Output results as JSON and exit (implies dry-run, no prompts)
- `-y, --yes`: Skip confirmation prompt
- `-h, --help`: Show help message

#### Examples

```bash
# Interactive mode: pick exactly what to remove
gw clean --interactive

# Preview all safe worktrees (default behavior)
gw clean --dry-run

# Remove all safe worktrees regardless of age
gw clean

# Only remove worktrees older than configured threshold
gw clean --use-autoclean-threshold

# Preview old worktrees with threshold check
gw clean --use-autoclean-threshold --dry-run

# Force remove all worktrees without safety checks (dangerous!)
gw clean --force

# Get JSON output for scripting (exits without prompting)
gw clean --json

# Skip confirmation prompt (auto-confirm removal)
gw clean --yes
```

#### How It Works

The clean command:

1. **Default mode:** Finds ALL safe worktrees (no age check)
   - **With `--use-autoclean-threshold`:** Only finds worktrees older than configured threshold (default: 7 days)
2. Verifies they have no uncommitted changes (unless `--force`)
3. Verifies they have no unpushed commits (unless `--force`)
4. Prompts for confirmation before deleting (unless `--dry-run`)
5. Never removes bare/main repository worktrees
6. After removal, automatically prunes orphan branches (no worktree, no unpushed commits)

**Behavior Modes:**

| Command                              | Age Check          | Safety Checks        | Use Case                            |
| ------------------------------------ | ------------------ | -------------------- | ----------------------------------- |
| `gw clean --interactive`             | N/A (user picks)   | No (force delete)    | Manually pick items to remove       |
| `gw clean`                           | No (all worktrees) | Yes (unless --force) | Clean up all finished work          |
| `gw clean --use-autoclean-threshold` | Yes (7+ days)      | Yes (unless --force) | Clean up old, stale worktrees       |
| `gw clean --force`                   | No (all worktrees) | No                   | Force removal of all worktrees      |
| `gw prune`                           | No (all worktrees) | Yes                  | Full cleanup (worktrees + branches) |
| `gw prune --stale-only`              | N/A                | N/A                  | Git passthrough (metadata only)     |

**Safety Features:**

- By default, only removes worktrees with NO uncommitted changes
- By default, only removes worktrees with NO unpushed commits
- Always prompts for confirmation before deletion
- Bare repository, the configured `defaultBranch`, and `gw_root` are never removed
- The canonical trunk names `main` and `master` are also always protected — even when one of them is not the currently configured `defaultBranch` (e.g. a repo with `defaultBranch: "master"` still protects a leftover local `main` branch, and vice versa)
- After removing worktrees, automatically prunes orphan branches (branches with no worktree and no unpushed commits)
- Use `--force` to bypass safety checks (use with caution)

**Configuration:**

The age threshold (used by `--use-autoclean-threshold`) is stored in `.gw/config.json`:

```bash
# Set clean threshold to 14 days
gw init --clean-threshold 14
```

This creates/updates the config:

```json
{
  "root": "/path/to/repo.git",
  "defaultBranch": "main",
  "cleanThreshold": 14
}
```

### Git Worktree Proxy Commands

These commands wrap native `git worktree` operations, providing consistent colored output and help messages. All git flags and options are passed through transparently.

#### list (ls)

List all worktrees in the repository. Protected branches (the default branch, `main`, `master`, `gw_root`, and any branches marked with `gw protect`) are annotated with a `[protected]` tag.

```bash
gw list
# or
gw ls
```

**Examples:**

```bash
gw list                  # List all worktrees (with [protected] annotations)
gw list --porcelain      # Machine-readable output (raw git proxy, no annotation)
gw list -v               # Verbose output (raw git proxy, no annotation)
```

> **Note:** `--porcelain`, `-z`, `--verbose`, and `-v` fall back to the raw `git worktree list` proxy so machine-readable and scripting use cases are never broken.

#### remove (rm)

Remove a worktree from the repository. By default, also deletes the local branch to prevent orphaned branches.

```bash
gw remove <worktree...>
# or
gw rm <worktree...>
```

**Multiple Worktrees & Glob Patterns:**

You can remove several worktrees at once, either by listing them or by using a glob pattern. When more than one worktree resolves, gw shows the list and asks for confirmation before anything is removed. **Confirmation prompts default to yes** — just press Enter to proceed, or type `n` / `no` to cancel. Use `--dry-run` (or `-n`) to preview what would be removed without making any changes.

With shell integration installed (`eval "$(gw install-shell)"`), you can use unquoted glob patterns: `gw rm fix/*`. The integration aliases `gw` with `noglob` for zsh so the shell doesn't try to expand the pattern against the current directory first. Without integration — or in bash with non-default options like `failglob` — quote the pattern: `gw rm 'fix/*'`.

Supported pattern syntax:

- `*` — in a bare-name pattern (no `/`), matches anything including `/`. In a path-aware pattern (contains `/`), matches anything except `/`.
- `**` — matches anything including `/` (recursive)
- `?` — matches a single character
- `[abc]` — matches one of the listed characters

The `/`-aware split is what most people mean intuitively:

- `fix*` — "anything starting with `fix`" → matches `fix/agent0-foo`, `fix-branch`, `fixture`
- `fix/*` — "direct children of `fix/`" → matches `fix/agent0-foo` but NOT `fix/sub/nested`
- `fix/**` — "everything under `fix/`" → matches both

In batch mode, dirty worktrees (uncommitted or unpushed) are skipped with a warning instead of being prompted one-by-one. Use `--force` to remove them anyway. Protected branches are silently filtered out of pattern matches.

**Branch Cleanup:**

By default, `gw remove` deletes the local branch after removing the worktree:

- Uses safe delete (`git branch -d`) which warns if branch has unmerged commits
- Use `--preserve-branch` to keep the local branch
- Use `--force` to force delete unmerged branches
- Protected branches (main, master, defaultBranch, gw_root) are never deleted
- Also automatically prunes any other orphan branches (no worktree, no unpushed commits)

**Protected Worktrees:**

The following worktrees are protected and cannot be removed:

- Default branch (configured in `.gw/config.json`, typically `main`)
- `gw_root` (bare repository root branch)
- Bare repository worktree

**Examples:**

```bash
gw remove feat-branch                    # Remove worktree AND delete local branch
gw remove feat-branch --preserve-branch  # Remove worktree but KEEP local branch
gw remove --force feat-branch            # Force remove worktree and force delete branch
gw rm feat-branch                        # Using alias
gw rm test/*                             # Remove all worktrees under test/ (with shell integration)
gw rm 'test/*'                           # Same — explicit quoting if you don't have shell integration
gw rm feat/* spike/* --yes               # Remove every feat/* and spike/* worktree
gw rm feat-a feat-b                      # Remove multiple worktrees by name
gw rm --dry-run feat/*                   # Preview what would be removed (no changes)
gw rm -n feat/*                          # Same as above using short flag
```

#### move (mv)

Move a worktree to a new location.

```bash
gw move <worktree> <new-path>
# or
gw mv <worktree> <new-path>
```

**Examples:**

```bash
gw move feat-branch ../new-location
gw mv feat-branch ../new-location
```

#### prune

Clean up worktrees and orphan branches. By default, performs full cleanup (removes clean worktrees AND deletes orphan branches).

**Default Mode (full cleanup):**
Removes worktrees that are safe to delete (no uncommitted changes, no unpushed commits) AND deletes orphan branches (branches without associated worktrees).

**Stale-Only Mode** (with `--stale-only`):
Git passthrough - only cleans up administrative files for deleted worktrees. Does not remove worktrees or branches.

```bash
gw prune [options]
```

**Options:**

- `--stale-only` - Git passthrough mode (only metadata cleanup)
- `--no-branches` - Skip orphan branch cleanup (worktrees only)
- `-n, --dry-run` - Preview what would be removed
- `-f, --force` - Skip confirmation prompt
- `-v, --verbose` - Show detailed output
- `-h, --help` - Show help

**Safety Features:**

- Default branch is protected (configured in `.gw/config.json`)
- gw_root branch is protected (bare repository root)
- Current worktree cannot be removed
- Bare repository is never removed
- Branches with unpushed commits are protected
- Confirmation prompt before removal (defaults to yes)

**Examples:**

```bash
# Full cleanup (default) - removes worktrees AND orphan branches
gw prune                     # Remove clean worktrees and orphan branches
gw prune --dry-run           # Preview what would be removed
gw prune --force             # Skip confirmation
gw prune --verbose           # Show detailed output

# Skip branch cleanup
gw prune --no-branches       # Only clean worktrees, keep branches

# Git passthrough (stale-only)
gw prune --stale-only        # Only clean git metadata (like git worktree prune)
```

**Comparison with `gw clean`:**

| Feature                   | `gw clean`             | `gw clean --use-autoclean-threshold` | `gw prune`             |
| ------------------------- | ---------------------- | ------------------------------------ | ---------------------- |
| Age-based                 | No (all worktrees)     | Yes (configurable threshold)         | No (removes all clean) |
| Safety checks             | Yes                    | Yes                                  | Yes                    |
| Protects default branch   | No                     | No                                   | Yes                    |
| Deletes orphan branches   | No                     | No                                   | Yes                    |
| Runs `git worktree prune` | No                     | No                                   | Yes                    |
| Use case                  | Clean up finished work | Regular maintenance                  | Full cleanup           |

### protect

Mark a branch as protected, preventing it from being removed by `gw clean` (both interactive and auto modes) and auto-clean.

```bash
gw protect [branch]
```

If no branch is given, the current branch is auto-detected from the working directory.

The protected branch list is stored in `protectedBranches` inside `.gw/config.json` and is safe to commit to your repository.

> **Note:** The `defaultBranch`, `main`, `master`, and `gw_root` are always system-protected regardless of this setting. Use `gw protect` only for additional branches you want to keep around long-term (e.g. `staging`, `release/*`).

<a name="examples-protect"></a>

**Examples:**

```bash
# Protect the current branch
gw protect

# Protect a specific branch
gw protect staging

# Protect a release branch
gw protect release/v2
```

### unprotect

Remove a branch from the `protectedBranches` list, allowing `gw clean` and auto-clean to remove it again.

```bash
gw unprotect [branch]
```

If no branch is given, the current branch is auto-detected from the working directory.

<a name="examples-unprotect"></a>

**Examples:**

```bash
# Unprotect the current branch
gw unprotect

# Unprotect a specific branch
gw unprotect staging
```

#### lock

Lock a worktree to prevent removal.

```bash
gw lock <worktree>
```

**Examples:**

```bash
gw lock feat-branch
gw lock --reason "Work in progress" feat-branch
```

#### unlock

Unlock a worktree to allow removal.

```bash
gw unlock <worktree>
```

**Examples:**

```bash
gw unlock feat-branch
```

#### repair

Repair worktree administrative files.

```bash
gw repair [<path>]
```

**Examples:**

```bash
gw repair                        # Repair all worktrees
gw repair /path/to/worktree      # Repair specific worktree
```

## Use Case

This tool was originally created to simplify the workflow of copying secrets and environment files when creating new git worktrees. When you create a new worktree for a feature branch, you often need to copy `.env` files, credentials, and other configuration files from your main worktree to the new one. This tool automates that process.

The tool automatically detects which git repository you're working in and creates a local config file (`.gw/config.json`) on first use. The config stores the repository root and other settings, so subsequent runs are fast and don't need to re-detect the repository structure. Each repository has its own configuration, and you can customize the default source worktree per repository.

### Typical Workflow

**Starting with a new repository:**

```bash
# Clone and set up with gw (one command!)
gw init git@github.com:user/repo.git --interactive
# Configure auto-copy files, hooks, etc. during the interactive prompts
# Automatically navigates to the repo and creates main worktree

# Set up secrets in main worktree
cd main
cp .env.example .env
# Edit .env with your secrets

# Create feature worktrees - files copied automatically
cd ..
gw add feat/new-feature
# Already in feat/new-feature worktree!

# Keep your feature branch updated with latest changes from main
gw update

# Navigate between worktrees easily
gw cd main
gw cd feat/new-feature
```

**Working with an existing repository:**

```bash
# One-time setup: Configure auto-copy files and hooks
gw init --auto-copy-files .env,components/agents/.env,components/ui/.vercel/ \
  --post-checkout "pnpm install"

# Commit the config so your team gets the same setup
git add .gw/config.json
git commit -m "chore: share gw config"

# From within any worktree of your repository
# Create a new worktree with auto-copy and hooks
gw add feat/new-feature
# Automatically: copies files, runs hooks, navigates to new worktree

# Navigate to main worktree (if you need to work on it)
gw checkout main  # or gw co main

# Keep your feature branch updated
gw update

# Alternative: Create worktree and copy specific files (overrides config)
gw add feat-bugfix .env custom-config.json

# Alternative: Use the manual sync command
git worktree add feat-manual
gw sync feat-manual .env
gw cd feat-manual
```

## Development

### Local Development & Testing

When developing the tool, you can test changes locally without publishing by using a shell alias. This allows you to use the `gw-dev` command with live code updates and full shell integration.

#### Shell Alias Method (Recommended)

Create a shell alias that runs the Deno version directly for instant feedback:

```bash
# Install shell integration for gw-dev
# IMPORTANT: Don't create an alias yourself - the install-shell command creates a function for you
# Make sure to use your actual path to gw-tools
deno run --allow-all ~/path/to/gw-tools/packages/gw-tool/src/main.ts install-shell \
  --name gw-dev \
  --command "deno run --allow-all ~/path/to/gw-tools/packages/gw-tool/src/main.ts"

# Reload your shell
source ~/.zshrc  # or ~/.bashrc

# Now you can use it anywhere with full shell integration
cd ~/some-project
gw-dev add feat-branch  # Output streams in real-time!
gw-dev cd feat-branch   # Navigates to the worktree
gw-dev copy feat-branch .env
```

This gives you instant feedback - just edit the TypeScript files and run the command again. The shell integration provides the same experience as the installed version:

- Real-time streaming output (no buffering)
- `gw-dev cd` navigation support
- Auto-navigation after `gw-dev add`
- Auto-navigation to repo root after `gw-dev remove`

### Available Scripts

```bash
# Run the tool in development mode
nx run gw-tool:run -- <args>

# Watch mode for development
nx run gw-tool:dev

# Type check
nx run gw-tool:check

# Lint
nx run gw-tool:lint

# Format code (Prettier; do NOT use `deno fmt`)
nx format:write

# Compile to binary (current platform only)
nx run gw-tool:compile

# Compile binaries for all platforms
nx run gw-tool:compile-all

# Prepare npm package
nx run gw-tool:npm-pack

# Automated release (version, build, GitHub release, npm publish)
nx run gw-tool:release

# Publish to JSR (optional, separate ecosystem)
nx run gw-tool:publish-jsr

# Run tests
nx run gw-tool:test
```

### Publishing

Releases are **fully automated** via CI. No manual release commands are needed.

#### How It Works

**Beta Releases (on Pull Requests):**

When you open a non-draft PR with changes to `packages/gw-tool/src/`:

1. CI runs tests
2. If tests pass, a beta version is automatically created (e.g., `0.29.0-beta.27.1`)
3. The beta is published to npm with the `beta` tag and Homebrew as `gw-beta`
4. A comment is added to the PR with installation instructions

```bash
# Install beta version
npm install @gw-tools/gw@beta
brew install mthines/gw-tools/gw-beta
```

**Stable Releases (on Merge to Main):**

When a PR is merged to `main` with changes to `packages/gw-tool/src/`:

1. CI automatically determines the version bump from conventional commits
2. Updates `package.json`, creates a git tag, and pushes
3. Builds binaries for all platforms
4. Creates a GitHub release with binaries attached
5. Publishes to npm and updates Homebrew tap

#### Conventional Commits

Use these commit prefixes to control versioning:

| Prefix                         | Version Bump          | Example                        |
| ------------------------------ | --------------------- | ------------------------------ |
| `feat:`                        | Minor (1.0.0 → 1.1.0) | `feat: add dry-run mode`       |
| `fix:`                         | Patch (1.0.0 → 1.0.1) | `fix: correct path resolution` |
| `feat!:` or `BREAKING CHANGE:` | Major (1.0.0 → 2.0.0) | `feat!: redesign config`       |
| `chore:`, `docs:`, `refactor:` | No bump               | `docs: update README`          |

#### Testing Releases

To test the release workflow without publishing:

```bash
# Trigger a dry-run release via GitHub Actions
gh workflow run ci.yml -f test_release=true -f version=0.0.0-test
```

#### Manual Publishing (Fallback)

If CI fails or you need manual control:

```bash
# 1. Build binaries
nx run gw-tool:compile-all
nx run gw-tool:npm-pack

# 2. Create GitHub release
gh release create "v1.0.0" \
  --title "v1.0.0" \
  --notes "Release notes" \
  dist/packages/gw-tool/binaries/*

# 3. Publish to npm
cd dist/packages/gw-tool/npm
npm publish --access public
```

#### Publishing to JSR (Optional)

For users who prefer Deno's native package manager:

```bash
nx run gw-tool:publish-jsr
```

### Project Structure

```
packages/gw-tool/
├── src/
│   ├── main.ts              # CLI entry point and command dispatcher
│   ├── index.ts             # Public API exports
│   ├── commands/            # Command implementations
│   │   ├── checkout.ts      # Checkout command (create worktree, switch branches, navigate)
│   │   ├── copy.ts          # Sync command (sync files between worktrees)
│   │   ├── init.ts          # Init command
│   │   ├── root.ts          # Root command
│   │   ├── list.ts          # List command (proxy)
│   │   ├── remove.ts        # Remove command (proxy)
│   │   ├── move.ts          # Move command (proxy)
│   │   ├── prune.ts         # Prune command (proxy)
│   │   ├── lock.ts          # Lock command (proxy)
│   │   ├── unlock.ts        # Unlock command (proxy)
│   │   └── repair.ts        # Repair command (proxy)
│   └── lib/                 # Shared utilities
│       ├── types.ts         # TypeScript type definitions
│       ├── config.ts        # Configuration management
│       ├── cli.ts           # CLI argument parsing & help
│       ├── file-ops.ts      # File/directory operations
│       ├── path-resolver.ts # Path resolution utilities
│       ├── output.ts        # Colored output formatting
│       └── git-proxy.ts     # Git command proxy utilities
├── npm/                     # npm package files
│   ├── package.json         # npm package metadata
│   ├── install.js           # Binary installation script
│   └── bin/
│       └── gw.js            # Binary wrapper
├── scripts/
│   └── release.sh           # Automated release script
├── deno.json                # Deno configuration
├── project.json             # Nx project configuration
└── README.md                # This file
```

### Adding New Commands

There are two types of commands you can add:

#### Custom Commands (like `checkout`, `sync`)

For commands with custom logic, follow the pattern used by existing commands:

1. **Create a new file** in `src/commands/` (e.g., `list.ts`):

   ```typescript
   // src/commands/list.ts
   export async function executeList(args: string[]): Promise<void> {
     // Check for help flag
     if (args.includes('--help') || args.includes('-h')) {
       console.log(`Usage: gw list
   
   List all git worktrees in the current repository.
   
   Options:
     -h, --help    Show this help message
   `);
       Deno.exit(0);
     }

     // Command implementation
     // ...
   }
   ```

2. **Import and register** the command in `src/main.ts`:

   ```typescript
   import { executeList } from './commands/list.ts';

   const COMMANDS = {
     add: executeAdd,
     sync: executeCopy,
     init: executeInit,
     root: executeRoot,
     list: executeList, // Add your new command
   };
   ```

3. **Update global help** in `src/lib/cli.ts`:
   ```typescript
   export function showGlobalHelp(): void {
     console.log(`
   Commands:
     add      Create a new worktree with optional auto-copy
     sync     Sync files/directories between worktrees
     init     Initialize gw configuration for a repository
     root     Get the root directory of the current git repository
     list     List all git worktrees in the repository
   `);
   }
   ```

#### Git Proxy Commands (like `list`, `remove`)

For simple pass-through commands that wrap git worktree operations, use the `git-proxy` utility:

1. **Create a new file** in `src/commands/` (e.g., `list.ts`):

   ```typescript
   // src/commands/list.ts
   import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';

   export async function executeList(args: string[]): Promise<void> {
     if (args.includes('--help') || args.includes('-h')) {
       showProxyHelp('list', 'list', 'List all worktrees in the repository', [
         'gw list',
         'gw list --porcelain',
         'gw list -v',
       ]);
       Deno.exit(0);
     }

     await executeGitWorktree('list', args);
   }
   ```

2. **Register** in `src/main.ts` (same as above)

3. **Update global help** in `src/lib/cli.ts` (same as above)

This approach requires minimal maintenance as it simply forwards all arguments to git.

**Tips**:

- Look at [src/commands/root.ts](src/commands/root.ts) for a simple custom command
- Look at [src/commands/copy.ts](src/commands/copy.ts) for a complex command with argument parsing
- Look at [src/commands/list.ts](src/commands/list.ts) for a simple proxy command

## License

See the workspace root for license information.
