# gw - Git Worktree Tools

A command-line tool for managing git worktrees, built with Deno.

## Quick Start

```bash
# Install
npm install -g @gw-tools/gw

# Create a new worktree
git worktree add feat-new-feature

# Copy secrets from main to the new worktree
gw copy feat-new-feature .env

# Done! Your new worktree has all the secrets it needs
cd feat-new-feature
```

## Features

- **Copy files between worktrees**: Easily copy secrets, environment files, and configurations from one worktree to another
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

On first run, `gw` will automatically create a configuration file at `<git-root>/.gw/config.json` in your repository. The tool finds the git repository root by walking up the directory tree from your current location.

### Example Configuration

```json
{
  "defaultSource": "main"
}
```

### Configuration Options

- **defaultSource**: Default source worktree name (optional, defaults to "main")

## Commands

### copy

Copy files and directories between worktrees, preserving directory structure.

```bash
gw copy [options] <target-worktree> <files...>
```

#### Arguments

- `<target-worktree>`: Name or full path of the target worktree
- `<files...>`: One or more files or directories to copy (paths relative to worktree root)

#### Options

- `--from <source>`: Source worktree name (default: from config or "main")
- `-n, --dry-run`: Show what would be copied without actually copying
- `-h, --help`: Show help message

#### Examples

```bash
# Copy .env file from main to feat-branch
gw copy feat-branch .env

# Copy multiple files
gw copy feat-branch .env components/agents/.env components/agents/agents.yaml

# Copy entire directory
gw copy feat-branch components/ui/.vercel

# Use custom source worktree
gw copy --from develop feat-branch .env

# Dry run to preview changes
gw copy --dry-run feat-branch .env

# Use absolute path as target
gw copy /full/path/to/repo/feat-branch .env
```

## Development

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
│   │   └── copy.ts          # Copy command
│   └── lib/                 # Shared utilities
│       ├── types.ts         # TypeScript type definitions
│       ├── config.ts        # Configuration management
│       ├── cli.ts           # CLI argument parsing
│       ├── file-ops.ts      # File/directory operations
│       └── path-resolver.ts # Path resolution utilities
├── deno.json                # Deno configuration
├── project.json             # Nx project configuration
└── README.md                # This file
```

### Adding New Commands

To add a new command:

1. Create a new file in `src/commands/` (e.g., `init.ts`)
2. Implement your command function:
   ```typescript
   export async function executeInit(args: string[]): Promise<void> {
     // Command implementation
   }
   ```
3. Add the command to the `COMMANDS` object in `src/main.ts`:
   ```typescript
   const COMMANDS = {
     copy: executeCopy,
     init: executeInit, // Add your new command
   };
   ```

## Use Case

This tool was originally created to simplify the workflow of copying secrets and environment files when creating new git worktrees. When you create a new worktree for a feature branch, you often need to copy `.env` files, credentials, and other configuration files from your main worktree to the new one. This tool automates that process.

The tool automatically detects which git repository you're working in by finding the `.git` directory, and creates a local config file (`.gw/config.json`) at the repository root on first use. This means each repository has its own configuration, and you can customize the default source worktree per repository.

### Typical Workflow

```bash
# From within any worktree of your repository
# Create a new worktree
git worktree add feat-new-feature

# Copy secrets from main worktree to the new one
# gw automatically detects your repository and uses its config
gw copy feat-new-feature .env components/agents/.env components/ui/.vercel

# Start working in the new worktree
cd feat-new-feature
```

## License

See the workspace root for license information.
