# gw - Git Worktree Tools

A command-line tool for managing git worktrees, built with Deno.

## Table of Contents

- [gw - Git Worktree Tools](#gw---git-worktree-tools)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
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
    - [add](#add)
      - [Arguments](#arguments)
      - [Options](#options)
      - [Examples](#examples)
      - [Auto-Copy Configuration](#auto-copy-configuration)
      - [Hooks](#hooks)
    - [cd](#cd)
      - [Arguments](#arguments-1)
      - [Examples](#examples-1)
      - [How It Works](#how-it-works)
    - [checkout](#checkout)
      - [Arguments](#arguments-2)
      - [Examples](#examples-2)
      - [How It Works](#how-it-works-1)
    - [update](#update)
      - [Options](#options-1)
      - [Examples](#examples-3)
      - [How It Works](#how-it-works-2)
    - [install-shell](#install-shell)
      - [Options](#options-2)
      - [Examples](#examples-4)
    - [root](#root)
      - [Examples](#examples-5)
      - [How It Works](#how-it-works-3)
    - [init](#init)
      - [Options](#options-3)
      - [Examples](#examples-6)
      - [Hook Variables](#hook-variables)
      - [Auto-Cleanup Configuration](#auto-cleanup-configuration)
      - [When to Use](#when-to-use)
    - [show-init](#show-init)
      - [Options](#options-4)
      - [Examples](#examples-7)
      - [Output Example](#output-example)
      - [When to Use](#when-to-use-1)
    - [sync](#sync)
      - [Arguments](#arguments-3)
      - [Options](#options-5)
      - [Examples](#examples-8)
    - [clean](#clean)
      - [Options](#options-6)
      - [Examples](#examples-9)
      - [How It Works](#how-it-works-4)
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
      - [Automated Release (Recommended)](#automated-release-recommended)
      - [Manual Publishing](#manual-publishing)
      - [Publishing to JSR (Optional)](#publishing-to-jsr-optional)
      - [Version Management](#version-management)
    - [Project Structure](#project-structure)
    - [Adding New Commands](#adding-new-commands)
      - [Custom Commands (like `add`, `copy`)](#custom-commands-like-add-copy)
      - [Git Proxy Commands (like `list`, `remove`)](#git-proxy-commands-like-list-remove)
  - [License](#license)

## Quick Start

```bash
# Install (Homebrew on macOS)
brew install mthines/gw-tools/gw && gw install-shell

# Or install via npm
npm install -g @gw-tools/gw && gw install-shell

# Or install via Linux package manager
yay -S gw-tools && gw install-shell

# Create a new worktree and copy files
gw add feat-new-feature .env secrets/

# Navigate to your new worktree
gw cd feat-new-feature

# Or checkout an existing branch (navigates if already checked out elsewhere)
gw checkout main
```

**Or with auto-copy (one-time setup):**

```bash
# Configure auto-copy files once per repository
gw init --root $(gw root) --auto-copy-files .env,secrets/

# Now just create worktrees - files are copied automatically
gw add feat-another-feature
gw cd feat-another-feature
```

## Initial Setup: Secrets in the Default Branch

**Important:** Before using `gw add` with auto-copy, ensure your secrets and environment files exist in your `defaultBranch` worktree (typically `main`). This worktree is the **source** from which files are copied to new worktrees.

### First-Time Setup Flow

```bash
# 1. Set up your bare repository structure
git clone --bare https://github.com/user/repo.git repo.git
cd repo.git

# 2. Create the main worktree (your defaultBranch)
git worktree add main main

# 3. Set up secrets in the main worktree FIRST
cd main
cp .env.example .env           # Create your environment file
# Edit .env with your actual secrets, API keys, etc.
mkdir -p secrets/
# Add any other secret files your project needs

# 4. Initialize gw with auto-copy configuration
gw init --auto-copy-files .env,secrets/

# 5. Now create feature worktrees - files are copied automatically from main
cd ..
gw add feat-new-feature
# .env and secrets/ are automatically copied from main to feat-new-feature
```

### Why This Matters

- **`gw add`** copies files **from** your `defaultBranch` worktree **to** the new worktree
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

- **Quick navigation**: Navigate to worktrees instantly with smart partial matching (`gw cd feat` finds `feat-branch`)
- **Smart checkout**: `gw checkout` handles worktree-specific scenarios, navigating to branches checked out elsewhere instead of showing errors
- **Copy files between worktrees**: Easily copy secrets, environment files, and configurations from one worktree to another
- **Automatic shell integration**: Shell function installs automatically on npm install for seamless `gw cd` navigation
- **Multi-command architecture**: Extensible framework for adding new worktree management commands
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

### Auto-Detection

The tool automatically:

1. **Searches for existing config**: Walks up from your current directory looking for `.gw/config.json`
2. **Auto-detects git root**: If no config is found, detects the repository root automatically
3. **Creates config**: Saves the detected root and default settings to `.gw/config.json`

If auto-detection fails (rare edge cases), you can manually initialize:

```bash
gw init --root /path/to/your/repo.git
```

### Example Configuration

```json
{
  "root": "/Users/username/Workspace/my-project.git",
  "defaultBranch": "main",
  "autoCopyFiles": [".env", "components/agents/.env", "components/ui/.vercel/"],
  "hooks": {
    "add": {
      "pre": ["echo 'Creating worktree: {worktree}'"],
      "post": ["pnpm install", "echo 'Setup complete!'"]
    }
  },
  "cleanThreshold": 7,
  "autoClean": true,
  "updateStrategy": "merge",
  "lastAutoCleanTime": 1706371200000
}
```

**More Examples**: See the [examples/](./examples/) directory for configuration templates for various project types (Next.js, Node.js API, monorepos, CI/CD, etc.).

### Configuration Options

- **root**: Absolute path to the git repository root (automatically detected or manually set with `gw init`)
- **defaultBranch**: Default source worktree name (optional, defaults to "main")
- **autoCopyFiles**: Array of file/directory paths to automatically copy when creating worktrees with `gw add` (optional, only set via `gw init --auto-copy-files`)
- **hooks**: Command hooks configuration (optional, set via `gw init --pre-add` and `--post-add`)
  - **hooks.add.pre**: Array of commands to run before creating a worktree
  - **hooks.add.post**: Array of commands to run after creating a worktree
- **cleanThreshold**: Number of days before worktrees are considered stale for `gw clean` (optional, defaults to 7, set via `gw init --clean-threshold`)
- **autoClean**: Prompt to remove stale worktrees when running `gw add` or `gw list` (optional, defaults to false, set via `gw init --auto-clean`)
- **updateStrategy**: Default strategy for `gw update` command: "merge" or "rebase" (optional, defaults to "merge", set via `gw init --update-strategy`)
- **lastAutoCleanTime**: Internal timestamp tracking last auto-cleanup run (managed automatically, do not edit manually)

## Commands

### add

Create a new git worktree with optional automatic file copying.

```bash
gw add <worktree-name> [files...]
```

This command wraps `git worktree add` and optionally copies files to the new worktree. If `autoCopyFiles` is configured, those files are automatically copied. You can override this by specifying files as arguments.

**Branch Creation Behavior:**
When creating a new worktree without specifying an existing branch, `gw add` automatically fetches the latest version of your default branch (e.g., `main`) from the remote (e.g., `origin/main`) to ensure your new branch is based on the most recent code. You can override this with the `--from <branch>` option to create a branch from a different source branch instead.

**Remote-First Fetch Approach:**

The `gw add` command follows a remote-first approach when creating new branches:

1. **What happens**: When you create a new branch (e.g., `gw add feat/new-feature`), the command:
   - Fetches the latest version of the source branch from the remote (e.g., `origin/main`)
   - Creates your new branch from the fresh remote ref (e.g., `origin/main`)
   - Sets up tracking to `origin/feat/new-feature` for easy pushing

2. **Why it matters**: This ensures your new branch starts from the latest remote code, not from a potentially outdated local branch. This prevents:
   - Merge conflicts from missing recent changes
   - Building features on old code
   - Divergent histories that are hard to reconcile

3. **Network failure handling**:
   - **With `--from <branch>`**: Requires successful remote fetch. If the fetch fails (network issues, branch doesn't exist on remote, authentication problems), the command exits with a detailed error message and troubleshooting steps. This ensures you're working with fresh code when you explicitly specify a source.
   - **Without `--from` (default branch)**: Warns about fetch failures but allows creation using the local branch as a fallback. This supports offline development or when no remote is configured.

4. **Offline development**: When working offline or when remote fetch fails for the default branch, the command falls back to using the local branch with a clear warning. This allows you to continue working without network access while being aware that your start point may not be current.

**Network Failure Handling:**

- When using `--from` with an explicit branch, the command requires a successful fetch from the remote to ensure you're working with the latest code. If the fetch fails (network issues, branch doesn't exist on remote, authentication problems), the command will exit with a detailed error message and suggestions for resolution.
- When no `--from` is specified (using default branch) or when no remote is configured, the command will warn about fetch failures but allow creation using the local branch.

**Upstream Tracking:**
When `gw add` creates a new branch, it automatically configures the branch to track `origin/<branch-name>` (e.g., `origin/feat/my-feature`). This means `git push` will push to the correct remote branch without needing to specify `-u origin <branch>` on first push.

**Git Ref Conflict Detection:**
The command automatically detects and prevents Git ref naming conflicts. For example, you cannot have both a branch named `test` and `test/foo` because Git stores branches as files in `.git/refs/heads/`, and `test` cannot be both a file and a directory. If a conflict is detected, you'll receive a helpful error message with suggestions for resolving it.

**Automatic Navigation:**
After successfully creating a new worktree, the command automatically navigates to the new worktree directory. This requires shell integration to be installed (see [install-shell](#install-shell)). Use the `--no-cd` flag to skip automatic navigation.

**Existing Worktree Navigation:**
If you try to add a worktree that already exists, the command will prompt you to navigate to it instead. Press Enter (default: Yes) to navigate, or type 'n' to cancel. This requires shell integration to be installed (see [install-shell](#install-shell)).

#### Arguments

- `<worktree-name>`: Name or path for the new worktree
- `[files...]`: Optional files to copy (overrides `autoCopyFiles` config)

#### Options

- `--no-cd`: Don't navigate to the new worktree after creation
- `--from <branch>`: Create new branch from specified branch instead of `defaultBranch`

All `git worktree add` options are supported:

- `-b <branch>`: Create a new branch
- `-B <branch>`: Create or reset a branch
- `--detach`: Detach HEAD in new worktree
- `--force, -f`: Force checkout even if already checked out
- `--track`: Track branch from remote
- `-h, --help`: Show help message

#### Examples

```bash
# Create worktree (auto-copies files if autoCopyFiles is configured)
# Automatically navigates to new worktree
gw add feat/new-feature

# Create worktree without navigating to it
gw add feat/new-feature --no-cd

# Create worktree from a different branch instead of defaultBranch
gw add feat/new-feature --from develop

# Create child feature branch from parent feature branch
gw add feat/child-feature --from feat/parent-feature

# Create worktree with new branch
gw add feat/new-feature -b my-branch

# Create worktree and copy specific files (overrides config)
gw add feat/new-feature .env secrets/

# Force create even if branch exists elsewhere
gw add feat/bugfix -f

# If worktree already exists, prompts to navigate to it
gw add feat/existing-branch
# Output: Worktree feat/existing-branch already exists at:
#   /path/to/repo/feat/existing-branch
#
# Navigate to it? [Y/n]:
# (Press Enter to navigate, or 'n' to cancel)
```

#### Auto-Copy Configuration

To enable automatic file copying, configure `autoCopyFiles` using `gw init`:

```bash
gw init --auto-copy-files .env,secrets/,components/ui/.vercel/
```

This creates:

```json
{
  "root": "/path/to/repo.git",
  "defaultBranch": "main",
  "autoCopyFiles": [".env", "secrets/", "components/ui/.vercel/"]
}
```

Now every time you run `gw add`, these files will be automatically copied from your default source worktree (usually `main`) to the new worktree.

#### Hooks

You can configure pre-add and post-add hooks to run commands before and after worktree creation. This is useful for:

- **Pre-add hooks**: Running validation scripts, checking prerequisites
- **Post-add hooks**: Installing dependencies, setting up the environment

```bash
# Configure a post-add hook to install dependencies
gw init --post-add "pnpm install"

# Configure multiple hooks
gw init --pre-add "echo 'Creating: {worktree}'" --post-add "pnpm install" --post-add "echo 'Done!'"
```

**Hook Variables:**

Hooks support variable substitution:

- `{worktree}` - The worktree name (e.g., "feat/new-feature")
- `{worktreePath}` - Full absolute path to the worktree
- `{gitRoot}` - The git repository root path
- `{branch}` - The branch name

**Hook Behavior:**

- **Pre-add hooks** run before the worktree is created (in the git root directory). If any pre-add hook fails, the worktree creation is aborted.
- **Post-add hooks** run after the worktree is created and files are copied (in the new worktree directory). If a post-add hook fails, a warning is shown but the worktree creation is considered successful.

**Example: Auto-install dependencies**

```bash
# One-time setup
gw init --auto-copy-files .env --post-add "pnpm install"

# Now when you create a worktree:
gw add feat/new-feature
# 1. Creates the worktree
# 2. Copies .env file
# 3. Runs pnpm install in the new worktree
```

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

# Navigate using partial match (finds "feat-new-feature")
gw cd feat

# If multiple matches found, shows list with helpful error:
gw cd api
# Output: Multiple worktrees match "api":
#   api-refactor -> /path/to/repo/api-refactor
#   graphql-api -> /path/to/repo/graphql-api
```

#### How It Works

The `cd` command integrates with your shell through an automatically installed function (see [install-shell](#install-shell)). When you run `gw cd <worktree>`:

1. The command finds the matching worktree path
2. The shell function intercepts the call and navigates you there
3. All other `gw` commands pass through normally

**Note**: Shell integration is automatically installed when you install via npm. If needed, you can manually install or remove it using `gw install-shell`.

### checkout

Smart git checkout wrapper that provides an intuitive experience for working with worktrees. The command automatically handles scenarios that would normally cause errors with standard `git checkout`.

```bash
gw checkout <branch>
# or use the alias
gw co <branch>
```

When you're working with worktrees, you cannot checkout the same branch in multiple worktrees. The `gw checkout` command solves this by detecting when a branch is already checked out elsewhere and navigating you to that worktree instead of showing an error.

#### Arguments

- `<branch>`: Branch name to checkout

#### Examples

```bash
# Checkout a local branch (if not checked out elsewhere)
gw checkout feature-x
gw co feature-x  # Using alias

# Navigate to worktree where main is already checked out
gw checkout main
# Output: Branch main is checked out in another worktree:
#   /path/to/repo/main
#
# Navigating there...

# Create worktree for remote branch (prompts)
gw checkout remote-feature
# Output: Branch remote-feature exists on remote but not locally.
#
# Create a new worktree for it? [Y/n]:
# (If yes, runs: gw add remote-feature)

# Already on the branch
gw checkout current-branch
# Output: Already on 'current-branch'
```

#### How It Works

The `checkout` command intelligently handles four scenarios:

1. **Branch exists locally and isn't checked out anywhere:**
   - Performs standard `git checkout <branch>` in the current worktree

2. **Branch is already checked out in another worktree:**
   - Automatically navigates to that worktree (like `gw cd`)
   - Shows you where the branch is located

3. **Branch exists on remote but not locally:**
   - Prompts you to create a new worktree for it
   - If you confirm, runs `gw add <branch>` which:
     - Creates the worktree
     - Copies auto-copy files
     - Navigates to the new worktree

4. **Branch doesn't exist anywhere:**
   - Shows a helpful error message
   - Suggests using `gw add <branch>` to create a new branch

**Why use this instead of `git checkout`?**

- **No more confusing errors:** Instead of "fatal: 'main' is already checked out at '/path/to/main'", it just takes you there
- **Reduces mental overhead:** You don't need to remember which branches are where
- **Teaches worktree workflows:** The messages guide you toward the right action
- **Educational:** Prompts explain what's happening and suggest alternatives

**Use case:** When updating your feature branch with latest changes, you might instinctively try `git checkout main && git pull`. With worktrees, this fails because main is checked out elsewhere. Instead, use `gw update` to update your current branch with main, or use `gw checkout main` to navigate to the main worktree.

### update

Update your current worktree with the latest changes from the default branch (or specified branch) using either merge or rebase strategy. This is useful when you want to update your feature branch with the latest changes from main without having to switch worktrees.

```bash
gw update [options]
```

When working in a worktree, you cannot easily checkout main to pull the latest changes because main is typically checked out in another worktree. The `gw update` command solves this by fetching the latest version of the default branch and updating your current branch using your configured strategy (merge or rebase).

**Alternative:** If you need to work on the main branch directly, use `gw checkout main` to navigate to the main worktree instead of trying to check it out in your current worktree.

#### Options

- `--from <branch>`: Update from specified branch instead of defaultBranch (e.g., `--from develop`)
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

# Preview what would happen
gw update --dry-run

# Force update even with uncommitted changes (not recommended)
gw update --force

# Use a different remote
gw update --remote upstream
```

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

Install or remove shell integration for the `gw cd` command and enable real-time streaming output. This is automatically run during `npm install`, but can be run manually if needed.

The installation creates an integration script in `~/.gw/shell/` and adds a single line to your shell configuration to source it, keeping your shell config clean and minimal.

Shell integration provides:

- **Navigation support**: `gw cd <worktree>` navigates directly to worktrees
- **Real-time streaming**: Command output streams as it's generated (no buffering)
- **Auto-navigation**: Automatically navigate after `gw add` and `gw remove` operations
- **Multi-alias support**: Install for different command names (e.g., `gw-dev` for development)

```bash
gw install-shell [options]
```

#### Options

- `--name, -n NAME`: Install under a different command name (default: `gw`)
- `--command, -c CMD`: Actual command to run (use with `--name` for aliases/dev)
- `--remove`: Remove shell integration
- `--quiet, -q`: Suppress output messages
- `-h, --help`: Show help message

#### Examples

```bash
# Install shell integration (usually not needed - auto-installed)
gw install-shell

# Install for development (with Deno)
# Note: Remove any 'alias gw-dev=...' from .zshrc first!
gw install-shell --name gw-dev \
  --command "deno run --allow-all ~/path/to/gw-tools/packages/gw-tool/src/main.ts"

# Remove shell integration for 'gw-dev'
gw install-shell --name gw-dev --remove

# Install quietly (for automation)
gw install-shell --quiet
```

**Supported Shells:**

- **Zsh** (~/.zshrc sources ~/.gw/shell/integration[-NAME].zsh)
- **Bash** (~/.bashrc sources ~/.gw/shell/integration[-NAME].bash)
- **Fish** (~/.config/fish/functions/[NAME].fish)

The command is idempotent - running it multiple times won't create duplicate entries. It will also automatically migrate old inline installations to the new format.

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

Initialize gw configuration for a git repository. This command can:

1. **Clone mode**: Clone a repository and set it up with gw configuration
2. **Existing repo mode**: Initialize gw in an existing repository

```bash
gw init [repository-url] [directory] [options]
```

#### Options

- `-i, --interactive`: Interactively prompt for configuration options
- `--root <path>`: Specify the git repository root path (optional, auto-detects if not provided)
- `--default-source <name>`: Set the default source worktree (default: "main")
- `--auto-copy-files <files>`: Comma-separated list of files to auto-copy when creating worktrees with `gw add`
- `--pre-add <command>`: Command to run before `gw add` creates a worktree (can be specified multiple times)
- `--post-add <command>`: Command to run after `gw add` creates a worktree (can be specified multiple times)
- `--clean-threshold <days>`: Number of days before worktrees are considered stale for `gw clean` (default: 7)
- `--auto-clean`: Enable automatic cleanup of stale worktrees (runs on `gw add` and `gw list` with 24-hour cooldown)
- `--update-strategy <strategy>`: Set default update strategy: 'merge' or 'rebase' (default: merge)
- `-h, --help`: Show help message

#### Clone Examples

Clone a repository and automatically set up gw configuration:

```bash
# Clone and initialize (auto-derive directory name from repository)
gw init git@github.com:user/repo.git

# Clone into specific directory
gw init git@github.com:user/repo.git my-project

# Clone with HTTPS URL
gw init https://github.com/user/repo.git

# Clone and configure interactively
gw init git@github.com:user/repo.git --interactive

# Clone with auto-copy files configured
gw init git@github.com:user/repo.git --auto-copy-files .env,secrets/
```

When cloning, `gw init` will:

1. Clone the repository with `--no-checkout`
2. Create a `gw_root` branch
3. Auto-detect the default branch from the remote
4. Create gw configuration
5. Create the default branch worktree
6. Automatically navigate to the repository directory (requires shell integration)

**Notes**:

- Cloned repositories use the `.git` suffix (e.g., `repo.git`) following bare repository conventions
- After cloning, you'll be automatically navigated to the repository root where you can run gw commands
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
gw init --post-add "pnpm install"

# Initialize with pre-add validation hook
gw init --pre-add "echo 'Creating worktree: {worktree}'"

# Initialize with multiple hooks
gw init --pre-add "echo 'Starting...'" --post-add "pnpm install" --post-add "echo 'Done!'"

# Initialize with custom default source
gw init --default-source master

# Initialize with explicit repository root
gw init --root /Users/username/Workspace/my-project.git

# Initialize with custom clean threshold (14 days instead of default 7)
gw init --clean-threshold 14

# Initialize with update strategy
gw init --update-strategy rebase

# Full configuration example
gw init --auto-copy-files .env,secrets/ --post-add "pnpm install" --clean-threshold 14 --update-strategy merge

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
gw init --auto-clean --auto-copy-files .env --post-add "pnpm install"
```

**How it works:**

- Prompts after `gw add` and `gw list` commands when stale worktrees are detected
- Only prompts once per 24 hours (cooldown)
- **Never removes the `defaultBranch` worktree** - it's protected as the source for file syncing
- Checks for worktrees older than `cleanThreshold` with:
  - No uncommitted changes
  - No staged files
  - No unpushed commits
- Shows interactive prompt when stale worktrees are found:
  ```
  🧹 Found 2 stale worktrees (7+ days old). Clean them up? [Y/n]:
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
  "root": "/Users/username/Workspace/repo.git",
  "defaultBranch": "main",
  "autoCopyFiles": [".env", "secrets/"],
  "hooks": {
    "add": {
      "post": ["pnpm install"]
    }
  },
  "cleanThreshold": 7,
  "updateStrategy": "rebase"
}
```

Then `gw show-init` will output:

```bash
gw init --root /Users/username/Workspace/repo.git --auto-copy-files .env,secrets/ --post-add 'pnpm install' --update-strategy rebase
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
gw sync [options] <target-worktree> [files...]
```

#### Arguments

- `<target-worktree>`: Name or full path of the target worktree
- `[files...]`: One or more files or directories to sync (paths relative to worktree root). If omitted, uses `autoCopyFiles` from `.gw/config.json`

#### Options

- `--from <source>`: Source worktree name (default: from config or "main")
- `-n, --dry-run`: Show what would be synced without actually syncing
- `-h, --help`: Show help message

#### Examples

```bash
# Sync autoCopyFiles from config (if configured)
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

**Automatic Pruning:** The clean command automatically runs `git worktree prune` before listing worktrees, ensuring only worktrees that actually exist on disk are shown. This prevents "phantom" worktrees (manually deleted directories) from appearing in the list.

**Note:** For automatic cleanup, see `gw init --auto-clean`. The `clean` command provides interactive, manual cleanup with detailed output and confirmation prompts.

```bash
gw clean [options]
```

#### Options

- `--use-autoclean-threshold`: Only remove worktrees older than configured threshold (default: 7 days)
- `-f, --force`: Skip safety checks (uncommitted changes, unpushed commits). WARNING: This may result in data loss
- `-n, --dry-run`: Preview what would be removed without actually removing
- `-h, --help`: Show help message

#### Examples

```bash
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
```

#### How It Works

The clean command:

1. **Default mode:** Finds ALL safe worktrees (no age check)
   - **With `--use-autoclean-threshold`:** Only finds worktrees older than configured threshold (default: 7 days)
2. Verifies they have no uncommitted changes (unless `--force`)
3. Verifies they have no unpushed commits (unless `--force`)
4. Prompts for confirmation before deleting (unless `--dry-run`)
5. Never removes bare/main repository worktrees

**Behavior Modes:**

| Command                              | Age Check          | Safety Checks        | Use Case                            |
| ------------------------------------ | ------------------ | -------------------- | ----------------------------------- |
| `gw clean`                           | No (all worktrees) | Yes (unless --force) | Clean up all finished work          |
| `gw clean --use-autoclean-threshold` | Yes (7+ days)      | Yes (unless --force) | Clean up old, stale worktrees       |
| `gw clean --force`                   | No (all worktrees) | No                   | Force removal of all worktrees      |
| `gw prune --clean`                   | No (all worktrees) | No                   | Git's native cleanup (no gw safety) |

**Safety Features:**

- By default, only removes worktrees with NO uncommitted changes
- By default, only removes worktrees with NO unpushed commits
- Always prompts for confirmation before deletion
- Main/bare repository worktrees are never removed
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

List all worktrees in the repository.

```bash
gw list
# or
gw ls
```

**Examples:**

```bash
gw list                  # List all worktrees
gw list --porcelain      # Machine-readable output
gw list -v               # Verbose output
```

#### remove (rm)

Remove a worktree from the repository.

```bash
gw remove <worktree>
# or
gw rm <worktree>
```

**Examples:**

```bash
gw remove feat-branch           # Remove a worktree
gw remove --force feat-branch   # Force remove even if dirty
gw rm feat-branch               # Using alias
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

Clean up worktree administrative data and optionally remove clean worktrees.

**Standard Mode** (without `--clean`):
Wraps `git worktree prune` to clean up administrative files for deleted worktrees.

**Clean Mode** (with `--clean`):
First runs `git worktree prune`, then removes ALL worktrees that have no uncommitted changes, no staged files, and no unpushed commits. This is similar to default `gw clean` behavior but with additional protections for the default branch.

```bash
gw prune [options]
```

**Options:**

- `--clean` - Enable clean mode (remove clean worktrees)
- `-n, --dry-run` - Preview what would be removed
- `-f, --force` - Skip confirmation prompt
- `-v, --verbose` - Show detailed output
- `-h, --help` - Show help

**Safety Features** (in clean mode):

- Default branch is protected (configured in `.gw/config.json`)
- Current worktree cannot be removed
- Bare repository is never removed
- Confirmation prompt before removal (defaults to yes, just press Enter to confirm)

**Examples:**

```bash
# Standard prune (cleanup administrative data)
gw prune
gw prune --verbose

# Clean mode (remove clean worktrees)
gw prune --clean              # Remove all clean worktrees (with prompt)
gw prune --clean --dry-run    # Preview what would be removed
gw prune --clean --force      # Remove without confirmation
gw prune --clean --verbose    # Show detailed output
```

**Comparison with `gw clean`:**
| Feature | `gw clean` | `gw clean --use-autoclean-threshold` | `gw prune --clean` |
|---------|-----------|-------------------------------------|-------------------|
| Age-based | No (all worktrees) | Yes (configurable threshold) | No (removes all clean) |
| Safety checks | Yes | Yes | Yes |
| Protects default branch | No | No | Yes |
| Runs `git worktree prune` | No | No | Yes |
| Use case | Clean up finished work | Regular maintenance | Aggressive cleanup |

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

```bash
# One-time setup: Configure auto-copy files
gw init --root $(gw root) --auto-copy-files .env,components/agents/.env,components/ui/.vercel/

# From within any worktree of your repository
# Create a new worktree with auto-copy
gw add feat-new-feature

# Navigate to your new worktree
gw cd feat-new-feature

# Keep your feature branch updated with latest changes from main
gw update

# Navigate to main worktree (if you need to work on it)
gw checkout main  # or gw co main

# Alternative: Create worktree and copy specific files
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

# Format code
nx run gw-tool:fmt

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

This tool uses **automated semantic versioning** based on conventional commits. The version is automatically determined from your commit messages.

#### Automated Release (Recommended)

The simplest way to publish is using the automated release process:

```bash
# Make sure you're on main/master branch with all changes pushed
nx run gw-tool:release
```

This single command will:

1. Analyze your commits since the last release
2. Automatically determine version bump (major/minor/patch)
3. Update npm/package.json with the new version
4. Create a git commit and tag
5. Push to GitHub
6. Build binaries for all platforms
7. Create a GitHub release with binaries attached
8. Publish to npm

**Conventional Commit Format:**

Use these commit prefixes to control versioning:

- `feat:` - New feature (bumps **MINOR** version: 1.0.0 → 1.1.0)
- `fix:` - Bug fix (bumps **PATCH** version: 1.0.0 → 1.0.1)
- `BREAKING CHANGE:` or `feat!:` or `fix!:` - Breaking change (bumps **MAJOR** version: 1.0.0 → 2.0.0)
- `chore:`, `docs:`, `style:`, `refactor:`, `test:` - No version bump

**Examples:**

```bash
git commit -m "feat: add dry-run mode"           # 1.0.0 → 1.1.0
git commit -m "fix: correct path resolution"     # 1.0.0 → 1.0.1
git commit -m "feat!: redesign config structure" # 1.0.0 → 2.0.0
git commit -m "docs: update README"              # no version bump
```

#### Manual Publishing

If you prefer manual control or need to debug the release process:

```bash
# 1. Update version
cd packages/gw-tool/npm
npm version 1.0.0
cd ../../..

# 2. Commit and push
git add packages/gw-tool/npm/package.json
git commit -m "chore: bump version to 1.0.0"
git push

# 3. Build binaries
nx run gw-tool:compile-all
nx run gw-tool:npm-pack

# 4. Create GitHub release
gh release create "v1.0.0" \
  --title "v1.0.0" \
  --notes "Release notes" \
  dist/packages/gw-tool/binaries/*

# 5. Publish to npm
cd dist/packages/gw-tool/npm
npm publish --access public
```

#### Publishing to JSR (Optional)

For users who prefer Deno's native package manager.

1. **Add JSR configuration to `deno.json`:**

   ```json
   {
     "name": "@your-scope/gw",
     "version": "1.0.0",
     "exports": "./src/main.ts"
   }
   ```

2. **Publish:**
   ```bash
   nx run gw-tool:publish-jsr
   ```

#### Version Management

**Automated Approach (Recommended):**

Use conventional commits and let the system determine the version:

```bash
# Make changes
git add .
git commit -m "feat: add new awesome feature"

# When ready to release
nx run gw-tool:release
```

The version is automatically determined from your commits:

- `feat:` → minor version bump (1.0.0 → 1.1.0)
- `fix:` → patch version bump (1.0.0 → 1.0.1)
- `feat!:` or `BREAKING CHANGE:` → major version bump (1.0.0 → 2.0.0)

**Manual Approach:**

If you prefer manual control:

1. Update `packages/gw-tool/npm/package.json` version
2. Update `packages/gw-tool/deno.json` version (if using JSR)
3. Commit and push changes
4. Build, create release, and publish manually

### Project Structure

```
packages/gw-tool/
├── src/
│   ├── main.ts              # CLI entry point and command dispatcher
│   ├── index.ts             # Public API exports
│   ├── commands/            # Command implementations
│   │   ├── add.ts           # Add command (create worktree with auto-copy)
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

#### Custom Commands (like `add`, `copy`)

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
