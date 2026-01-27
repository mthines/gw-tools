# gw - Git Worktree Tools

A command-line tool for managing git worktrees, built with Deno.

## Table of Contents

- [gw - Git Worktree Tools](#gw---git-worktree-tools)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
  - [Features](#features)
  - [Installation](#installation)
    - [Via npm (Recommended)](#via-npm-recommended)
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
    - [cd](#cd)
      - [Arguments](#arguments-1)
      - [Examples](#examples-1)
      - [How It Works](#how-it-works)
    - [install-shell](#install-shell)
      - [Options](#options-1)
      - [Examples](#examples-2)
    - [root](#root)
      - [Examples](#examples-3)
      - [How It Works](#how-it-works-1)
    - [init](#init)
      - [Options](#options-2)
      - [Examples](#examples-4)
      - [When to Use](#when-to-use)
    - [sync](#sync)
      - [Arguments](#arguments-2)
      - [Options](#options-3)
      - [Examples](#examples-5)
    - [clean](#clean)
      - [Options](#options-4)
      - [Examples](#examples-6)
      - [How It Works](#how-it-works-2)
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
      - [Method 1: Shell Alias (Recommended for Active Development)](#method-1-shell-alias-recommended-for-active-development)
      - [Method 2: Symlink to Compiled Binary (Faster Execution)](#method-2-symlink-to-compiled-binary-faster-execution)
      - [Method 3: Development Wrapper Script (Best of Both Worlds)](#method-3-development-wrapper-script-best-of-both-worlds)
      - [Method 4: npm link (For Testing Installation)](#method-4-npm-link-for-testing-installation)
      - [Watch Mode for Active Development](#watch-mode-for-active-development)
    - [Available Scripts](#available-scripts)
    - [Publishing](#publishing)
      - [Automated Release (Recommended)](#automated-release-recommended)
      - [Manual Publishing](#manual-publishing)
      - [Publishing to JSR (Optional)](#publishing-to-jsr-optional)
      - [Version Management](#version-management)
    - [Project Structure](#project-structure)
    - [Adding New Commands](#adding-new-commands)
  - [License](#license)

## Quick Start

```bash
# Install
npm install -g @gw-tools/gw

# Create a new worktree and copy files
gw add feat-new-feature .env secrets/

# Navigate to your new worktree
gw cd feat-new-feature
```

**Or with auto-copy (one-time setup):**

```bash
# Configure auto-copy files once per repository
gw init --root $(gw root) --auto-copy-files .env,secrets/

# Now just create worktrees - files are copied automatically
gw add feat-another-feature
gw cd feat-another-feature
```

## Features

- **Quick navigation**: Navigate to worktrees instantly with smart partial matching (`gw cd feat` finds `feat-branch`)
- **Copy files between worktrees**: Easily copy secrets, environment files, and configurations from one worktree to another
- **Automatic shell integration**: Shell function installs automatically on npm install for seamless `gw cd` navigation
- **Multi-command architecture**: Extensible framework for adding new worktree management commands
- **Auto-configured per repository**: Each repository gets its own local config file, automatically created on first use
- **Dry-run mode**: Preview what would be copied without making changes
- **Standalone binary**: Compiles to a single executable with no runtime dependencies

## Installation

### Via npm (Recommended)

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
  "autoCopyFiles": [
    ".env",
    "components/agents/.env",
    "components/ui/.vercel/"
  ],
  "hooks": {
    "add": {
      "pre": ["echo 'Creating worktree: {worktree}'"],
      "post": ["pnpm install", "echo 'Setup complete!'"]
    }
  },
  "cleanThreshold": 7
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

## Commands

### add

Create a new git worktree with optional automatic file copying.

```bash
gw add <worktree-name> [files...]
```

This command wraps `git worktree add` and optionally copies files to the new worktree. If `autoCopyFiles` is configured, those files are automatically copied. You can override this by specifying files as arguments.

#### Arguments

- `<worktree-name>`: Name or path for the new worktree
- `[files...]`: Optional files to copy (overrides `autoCopyFiles` config)

#### Options

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
gw add feat/new-feature

# Create worktree with new branch
gw add feat/new-feature -b my-branch

# Create worktree and copy specific files (overrides config)
gw add feat/new-feature .env secrets/

# Force create even if branch exists elsewhere
gw add feat/bugfix -f
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

### install-shell

Install or remove shell integration for the `gw cd` command. This is automatically run during `npm install`, but can be run manually if needed.

```bash
gw install-shell [options]
```

#### Options

- `--remove`: Remove shell integration
- `--quiet, -q`: Suppress output messages
- `-h, --help`: Show help message

#### Examples

```bash
# Install shell integration (usually not needed - auto-installed)
gw install-shell

# Remove shell integration
gw install-shell --remove

# Install quietly (for automation)
gw install-shell --quiet
```

**Supported Shells:**
- **Zsh** (~/.zshrc)
- **Bash** (~/.bashrc)
- **Fish** (~/.config/fish/functions/gw.fish)

The command is idempotent - running it multiple times won't create duplicate entries.

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

Initialize gw configuration for a git repository. This command creates or updates the `.gw/config.json` file with your settings.

```bash
gw init [options]
```

#### Options

- `--root <path>`: Specify the git repository root path (optional, auto-detects if not provided)
- `--default-source <name>`: Set the default source worktree (default: "main")
- `--auto-copy-files <files>`: Comma-separated list of files to auto-copy when creating worktrees with `gw add`
- `--pre-add <command>`: Command to run before `gw add` creates a worktree (can be specified multiple times)
- `--post-add <command>`: Command to run after `gw add` creates a worktree (can be specified multiple times)
- `--clean-threshold <days>`: Number of days before worktrees are considered stale for `gw clean` (default: 7)
- `-h, --help`: Show help message

#### Examples

```bash
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

# Full configuration example
gw init --auto-copy-files .env,secrets/ --post-add "pnpm install" --clean-threshold 14

# Show help
gw init --help
```

#### Hook Variables

Hooks support variable substitution:
- `{worktree}` - The worktree name (e.g., "feat/new-feature")
- `{worktreePath}` - Full absolute path to the worktree
- `{gitRoot}` - The git repository root path
- `{branch}` - The branch name

#### When to Use

Use `gw init` to:
- Configure auto-copy files for automatic file copying on worktree creation
- Set up pre-add and post-add hooks for automation
- Configure the clean threshold for worktree age management
- Override the auto-detected repository root (rare)
- Change the default source worktree from "main" to something else

The config file is created at `.gw/config.json` at the git root, so it's shared across all worktrees.

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

Remove stale worktrees that are older than a configured threshold. By default, only removes worktrees with no uncommitted changes and no unpushed commits.

```bash
gw clean [options]
```

#### Options

- `-f, --force`: Skip safety checks (uncommitted changes, unpushed commits). WARNING: This may result in data loss
- `-n, --dry-run`: Preview what would be removed without actually removing
- `-h, --help`: Show help message

#### Examples

```bash
# Preview stale worktrees (safe to run)
gw clean --dry-run

# Remove stale worktrees with safety checks
gw clean

# Force remove without safety checks (dangerous!)
gw clean --force

# Configure threshold during init
gw init --clean-threshold 14
```

#### How It Works

The clean command:
1. Checks for worktrees older than the configured threshold (default: 7 days)
2. Verifies they have no uncommitted changes (unless `--force`)
3. Verifies they have no unpushed commits (unless `--force`)
4. Prompts for confirmation before deleting (unless `--dry-run`)
5. Never removes bare/main repository worktrees

**Safety Features:**
- By default, only removes worktrees with NO uncommitted changes
- By default, only removes worktrees with NO unpushed commits
- Always prompts for confirmation before deletion
- Main/bare repository worktrees are never removed
- Use `--force` to bypass safety checks (use with caution)

**Configuration:**

The age threshold is stored in `.gw/config.json` and can be set during initialization:

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

Clean up worktree information for deleted worktrees.

```bash
gw prune
```

**Examples:**
```bash
gw prune                # Clean up stale worktree information
gw prune --dry-run      # Preview what would be pruned
gw prune --verbose      # Show detailed output
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

```bash
# One-time setup: Configure auto-copy files
gw init --root $(gw root) --auto-copy-files .env,components/agents/.env,components/ui/.vercel/

# From within any worktree of your repository
# Create a new worktree with auto-copy
gw add feat-new-feature

# Navigate to your new worktree
gw cd feat-new-feature

# Alternative: Create worktree and copy specific files
gw add feat-bugfix .env custom-config.json

# Alternative: Use the manual sync command
git worktree add feat-manual
gw sync feat-manual .env
gw cd feat-manual
```

## Development

### Local Development & Testing

When developing the tool, you can test changes locally without publishing by creating a global symlink. This allows you to use the `gw` command with live code updates.

#### Method 1: Shell Alias (Recommended for Active Development)

Create a shell alias that runs the Deno version directly with watch mode:

```bash
# Add to your ~/.zshrc or ~/.bashrc
alias gw-dev='deno run --allow-all ~/path/to/gw-tools/packages/gw-tool/src/main.ts'

# Reload your shell
source ~/.zshrc  # or ~/.bashrc

# Now you can use it anywhere
cd ~/some-project
gw-dev copy feat-branch .env
```

This gives you instant feedback - just edit the TypeScript files and run the command again.

#### Method 2: Symlink to Compiled Binary (Faster Execution)

Create a symlink to the compiled binary and recompile when needed:

```bash
# From the workspace root
nx run gw-tool:compile

# Create global symlink (one-time setup)
sudo ln -sf ~/path/to/gw-tools/dist/packages/gw-tool/gw /usr/local/bin/gw

# Now you can use `gw` globally
cd ~/some-project
gw sync feat-branch .env

# When you make changes, recompile
nx run gw-tool:compile
# The symlink automatically points to the new binary
```

#### Method 3: Development Wrapper Script (Best of Both Worlds)

Create a wrapper script that provides both speed and live updates:

```bash
# Create ~/bin/gw (make sure ~/bin is in your PATH)
cat > ~/bin/gw << 'EOF'
#!/bin/bash
# Check if we're in development mode (set GW_DEV=1 to use source)
if [ "$GW_DEV" = "1" ]; then
  exec deno run --allow-all ~/path/to/gw-tools/packages/gw-tool/src/main.ts "$@"
else
  exec ~/path/to/gw-tools/dist/packages/gw-tool/gw "$@"
fi
EOF

chmod +x ~/bin/gw

# Use compiled version (fast)
gw sync feat-branch .env

# Use development version with live updates
GW_DEV=1 gw sync feat-branch .env

# Or set it for your entire session
export GW_DEV=1
gw sync feat-branch .env
```

#### Method 4: npm link (For Testing Installation)

Test the npm package installation flow locally:

```bash
# Compile binaries
nx run gw-tool:compile-all

# Prepare npm package
nx run gw-tool:npm-pack

# Link the package globally
cd dist/packages/gw-tool/npm
npm link

# Now `gw` is available globally via npm
gw sync feat-branch .env

# When you make changes
cd ~/path/to/gw-tools
nx run gw-tool:compile-all
nx run gw-tool:npm-pack
# The link automatically uses the updated binaries

# To unlink when done
npm unlink -g @gw-tools/gw
```

#### Watch Mode for Active Development

Use the watch mode to automatically restart when files change:

```bash
# Terminal 1: Run in watch mode
nx run gw-tool:dev

# Terminal 2: Test in another project
cd ~/some-project
~/path/to/gw-tools/dist/packages/gw-tool/gw sync feat-branch .env
```

**Pro tip**: Combine Method 3 (wrapper script) with watch mode by setting `GW_DEV=1` in your development shell.

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
     if (args.includes("--help") || args.includes("-h")) {
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
   import { executeList } from "./commands/list.ts";

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
       showProxyHelp(
         'list',
         'list',
         'List all worktrees in the repository',
         ['gw list', 'gw list --porcelain', 'gw list -v'],
       );
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
