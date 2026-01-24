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
nx run gw:compile

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
nx run gw:run -- <args>

# Watch mode for development
nx run gw:dev

# Type check
nx run gw:check

# Lint
nx run gw:lint

# Format code
nx run gw:fmt

# Compile to binary (current platform only)
nx run gw:compile

# Compile binaries for all platforms
nx run gw:compile-all

# Prepare npm package
nx run gw:npm-pack

# Run tests
nx run gw:test
```

### Publishing

This tool can be published to multiple package registries for different audiences:

#### Publishing to npm

The primary distribution method for end users.

1. **Compile binaries for all platforms:**
   ```bash
   nx run gw:compile-all
   ```

2. **Create a GitHub release:**
   - Tag the release with version (e.g., `v1.0.0`)
   - Create a new release on GitHub with this tag
   - Upload all binaries from `dist/packages/gw-tool/binaries/` to the release
   - Binaries must be named exactly:
     - `gw-macos-x64`
     - `gw-macos-arm64`
     - `gw-linux-x64`
     - `gw-linux-arm64`
     - `gw-windows-x64.exe`

3. **Prepare and publish the npm package:**
   ```bash
   # Update version in npm/package.json to match the GitHub release
   cd packages/gw-tool/npm
   npm version 1.0.0  # Use exact version, not patch/minor/major

   # Publish to npm
   npm publish --access public
   ```

The npm package will automatically download the correct binary from GitHub releases when users install it.

**Installation (users):**
```bash
npm install -g @gw-tools/gw
```

#### Publishing to JSR (JavaScript Registry)

For users who prefer Deno's native package manager.

1. **Add JSR configuration to `deno.json`:**
   ```json
   {
     "name": "@your-scope/gw",
     "version": "1.0.0",
     "exports": "./src/main.ts"
   }
   ```

2. **Publish to JSR:**
   ```bash
   cd packages/gw-tool
   deno publish --allow-dirty
   ```

**Installation (users):**
```bash
# With Deno
deno install -g -n gw jsr:@your-scope/gw

# With npm (via JSR)
npx jsr:@your-scope/gw copy feat-branch .env
```

#### Publishing to Deno Land

For listing on deno.land/x (optional).

1. **Import via GitHub:**
   - Deno Land automatically tracks GitHub releases
   - Tag your release on GitHub (e.g., `v1.0.0`)
   - Register at https://deno.land/x

2. **Add webhook** (done once):
   - Go to repository settings → Webhooks
   - Add Deno Land webhook URL

**Installation (users):**
```bash
deno install -g -n gw https://deno.land/x/gw@v1.0.0/src/main.ts
```

#### Version Management

**Important:** Keep versions synchronized across all platforms:
- GitHub release tag: `v1.0.0`
- npm package.json: `"version": "1.0.0"`
- JSR deno.json: `"version": "1.0.0"`

**Recommended workflow:**
1. Decide on version number (e.g., 1.0.0)
2. Update `packages/gw-tool/npm/package.json` version
3. Update `packages/gw-tool/deno.json` version (if using JSR)
4. Commit changes
5. Create GitHub release with tag `v1.0.0` and upload binaries
6. Publish to npm
7. Publish to JSR (if using)

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
