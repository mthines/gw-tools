# Claude Development Guide for gw-tool

This guide documents how to develop, test, and contribute to the `gw-tool` package, including code conventions and patterns used throughout the codebase.

## Documentation Requirements

**IMPORTANT:** When adding new features or making significant changes, you MUST update the documentation:

1. **README.md** (user-facing documentation):
   - Add/update command documentation with usage examples
   - Update configuration options if config schema changes
   - Add new sections for new commands or major features
   - Update the Table of Contents if adding new sections

2. **This file (.claude/README.md)** (developer documentation):
   - Update Project Structure if adding new files
   - Add new types/interfaces to the Type Definitions section
   - Add usage patterns to Common Patterns section
   - Document any new conventions or patterns introduced

3. **In-code help text**:
   - Update `showXxxHelp()` functions in command files
   - Include examples and all available options

### Checklist for New Features

- [ ] Feature implementation complete
- [ ] `deno check src/main.ts` passes
- [ ] `deno lint` passes
- [ ] `deno fmt` applied
- [ ] README.md updated with user documentation
- [ ] .claude/README.md updated with developer documentation
- [ ] In-code help text updated
- [ ] Types documented in types.ts with JSDoc comments

## Quick Reference

```bash
# Run the tool in development (with live reload)
nx run gw-tool:dev -- <args>

# Run once
nx run gw-tool:run -- <args>

# Type check
nx run gw-tool:check

# Lint
nx run gw-tool:lint

# Format code
nx run gw-tool:fmt

# Run tests
nx run gw-tool:test

# Compile to binary (current platform)
nx run gw-tool:compile
```

## Project Structure

```
packages/gw-tool/
├── src/
│   ├── main.ts              # CLI entry point and command dispatcher
│   ├── index.ts             # Public API exports
│   ├── commands/            # Command implementations
│   │   ├── add.ts           # Custom command (create worktree + auto-copy)
│   │   ├── sync.ts          # Custom command (sync files between worktrees)
│   │   ├── cd.ts            # Custom command (navigate to worktree)
│   │   ├── init.ts          # Custom command (initialize config)
│   │   ├── root.ts          # Custom command (get repo root)
│   │   ├── install-shell.ts # Custom command (shell integration)
│   │   ├── list.ts          # Proxy command (git worktree list)
│   │   ├── remove.ts        # Proxy command (git worktree remove)
│   │   └── ...              # Other proxy commands
│   └── lib/                 # Shared utilities
│       ├── types.ts         # TypeScript type definitions
│       ├── config.ts        # Configuration management
│       ├── cli.ts           # CLI argument parsing & help text
│       ├── file-ops.ts      # File/directory operations
│       ├── hooks.ts         # Hook execution utilities
│       ├── path-resolver.ts # Path resolution utilities
│       ├── output.ts        # Colored output formatting
│       ├── git-proxy.ts     # Git command proxy utilities
│       └── version.ts       # Version constant
├── npm/                     # npm package files
├── scripts/                 # Build/release scripts
├── deno.json                # Deno configuration
└── project.json             # Nx project configuration
```

## Local Development & Testing

### Method 1: Shell Alias (Recommended for Active Development)

```bash
# Add to ~/.zshrc or ~/.bashrc
GW_TOOL_PATH=/Users/mthines/Workspace/gw-tools.git/main
alias gw-dev='deno run --allow-all "$GW_TOOL_PATH/packages/gw-tool/src/main.ts"'

# ----

# Usage
gw-dev add feat-branch

# Or if you're testing a specific worktree of the gw tool
GW_TOOL_PATH=/Users/mthines/Workspace/gw-tools.git/feat/sync-command && gw-dev sync feat-branch
```

### Method 2: Symlink to Compiled Binary

```bash
# Compile
nx run gw-tool:compile

# Create symlink
sudo ln -sf ~/path/to/gw-tools/dist/packages/gw-tool/gw /usr/local/bin/gw

# When you make changes, recompile
nx run gw-tool:compile
```

### Method 3: Watch Mode

```bash
# Terminal 1: Run with watch mode
nx run gw-tool:dev

# Terminal 2: Test in another directory
~/path/to/gw-tools/dist/packages/gw-tool/gw sync feat-branch .env
```

## Code Conventions

### File Organization

- **Commands**: One file per command in `src/commands/`
- **Utilities**: Shared code in `src/lib/`
- **Types**: All interfaces/types in `src/lib/types.ts`
- **Entry point**: `src/main.ts` dispatches to commands

### File Naming

Use **kebab-case** for all files:

- `install-shell.ts` (not `installShell.ts`)
- `file-ops.ts` (not `fileOps.ts`)
- `git-proxy.ts` (not `gitProxy.ts`)

### Module Header Comments

Every file starts with a JSDoc block describing the module:

```typescript
/**
 * Add command implementation
 * Creates a new worktree and optionally copies files
 */
```

### Import Style

```typescript
// Standard library imports use $std/ aliases (defined in deno.json)
import { join, resolve } from '$std/path';
import { parseArgs } from '$std/cli/parse-args';

// Type-only imports use `import type`
import type { Config, CopyOptions } from './types.ts';

// Namespace import for output utilities
import * as output from '../lib/output.ts';

// Named imports for everything else (always include .ts extension)
import { loadConfig, saveConfig } from '../lib/config.ts';
import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';
```

### Naming Conventions

| Type             | Convention       | Example                            |
| ---------------- | ---------------- | ---------------------------------- |
| Functions        | camelCase        | `parseAddArgs`, `executeList`      |
| Types/Interfaces | PascalCase       | `Config`, `CopyOptions`            |
| Module constants | UPPER_SNAKE_CASE | `COMMANDS`, `CONFIG_DIR_NAME`      |
| Local constants  | camelCase        | `configPath`, `gitRoot`            |
| Files            | kebab-case       | `install-shell.ts`, `git-proxy.ts` |

### Command Structure

Each command follows this pattern:

```typescript
/**
 * <CommandName> command implementation
 * <Brief description>
 */

import * as output from "../lib/output.ts";
// ... other imports

/**
 * Parse <command> command arguments
 */
function parse<CommandName>Args(args: string[]): {
  help: boolean;
  // ... other parsed options
} {
  // Implementation
}

/**
 * Show help for the <command> command
 */
function show<CommandName>Help(): void {
  console.log(`Usage: gw <command> [options] [arguments]

<Description>

Arguments:
  <arg>    Description

Options:
  -h, --help    Show this help message

Examples:
  gw <command> example1
  gw <command> example2
`);
}

/**
 * Execute the <command> command
 *
 * @param args Command-line arguments for the <command> command
 */
export async function execute<CommandName>(args: string[]): Promise<void> {
  const parsed = parse<CommandName>Args(args);

  // Show help if requested
  if (parsed.help) {
    show<CommandName>Help();
    Deno.exit(0);
  }

  // Validate arguments
  if (!parsed.requiredArg) {
    output.error("Required argument is missing");
    show<CommandName>Help();
    Deno.exit(1);
  }

  // Command implementation...
}
```

### Proxy Command Structure (for git worktree wrappers)

For commands that simply wrap `git worktree` subcommands:

```typescript
/**
 * <CommandName> command implementation
 * <Description>
 */

import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';

/**
 * Execute the <command> command
 *
 * @param args Command-line arguments for the <command> command
 */
export async function execute<CommandName>(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showProxyHelp(
      '<command>', // gw command name
      '<git-subcommand>', // git worktree subcommand
      '<description>', // Brief description
      ['gw <command>', 'gw <command> --option']
    );
    Deno.exit(0);
  }

  await executeGitWorktree('<git-subcommand>', args);
}
```

### Function Documentation

Use JSDoc for exported functions and complex internal functions:

```typescript
/**
 * Load configuration
 * 1. Look for .gw/config.json walking up from cwd
 * 2. If found and has root, use it
 * 3. If not found, try auto-detection with findGitRoot()
 *
 * @returns Config and git root path
 */
export async function loadConfig(): Promise<{
  config: Config;
  gitRoot: string;
}> {
  // Implementation
}

/**
 * Copy files from source to target worktree
 *
 * @param sourcePath Absolute path to source worktree
 * @param targetPath Absolute path to target worktree
 * @param files List of file/directory paths relative to worktree root
 * @param dryRun If true, only show what would be copied
 * @returns Array of copy results
 */
export async function copyFiles(
  sourcePath: string,
  targetPath: string,
  files: string[],
  dryRun: boolean
): Promise<CopyResult[]> {
  // Implementation
}
```

### Type Definitions

Define interfaces in `src/lib/types.ts`:

```typescript
/**
 * Type definitions for the gw CLI tool
 */

/**
 * Hook configuration for a command
 */
export interface CommandHooks {
  /** Commands to run before the main command executes */
  pre?: string[];
  /** Commands to run after the main command completes successfully */
  post?: string[];
}

/**
 * Hooks configuration for various gw commands
 */
export interface HooksConfig {
  /** Hooks for the add command */
  add?: CommandHooks;
}

/**
 * Per-repository configuration stored at .gw/config.json
 */
export interface Config {
  /** Absolute path to the git repository root */
  root?: string;
  /** Default source worktree name (e.g., "main", "master") */
  defaultBranch?: string;
  /** Files to automatically copy when creating new worktrees */
  autoCopyFiles?: string[];
  /** Command hooks configuration */
  hooks?: HooksConfig;
}
```

### Error Handling

```typescript
try {
  // Operation that might fail
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  output.error(message);
  Deno.exit(1);
}
```

For non-fatal errors or warnings:

```typescript
try {
  // Operation
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  output.warning(`Failed to copy files - ${message}`);
  console.log('Worktree was created successfully, but file copying failed.\n');
}
```

### Output Formatting

Use the `output` module for consistent CLI messages:

```typescript
import * as output from '../lib/output.ts';

// Status messages (include badges and newlines)
output.error('Something went wrong'); // Red ERROR badge
output.success('Operation completed'); // Green SUCCESS badge
output.warning('Proceed with caution'); // Yellow WARNING badge
output.info('FYI: something happened'); // Blue INFO badge

// Inline formatting (no badges/newlines)
console.log(`Created: ${output.path('/path/to/file')}`); // Cyan path
console.log(`Branch: ${output.bold('main')}`); // Bold text
console.log(`Details: ${output.dim('optional info')}`); // Dim text
console.log(`  ${output.checkmark()} Copied file`); // Green checkmark
console.log(`  ${output.warningSymbol()} Skipped`); // Yellow warning
```

### Formatting Rules (from deno.json)

| Rule            | Value               |
| --------------- | ------------------- |
| Indentation     | 2 spaces (no tabs)  |
| Line width      | 80 characters       |
| Semicolons      | Required            |
| Quotes          | Double quotes (`"`) |
| Trailing commas | Yes (Deno default)  |

Run `nx run gw-tool:fmt` to auto-format code.

### Help Text Format

```
gw <command> - <Brief description>

Usage:
  gw <command> [options] [arguments]

Arguments:
  <required-arg>    Description of required argument
  [optional-arg]    Description of optional argument

Options:
  --option <value>  Description with default value (default: "value")
  -n, --dry-run     Boolean flag description
  -h, --help        Show this help message

Description:
  Longer description if needed. Explains what the command does
  and when to use it.

Examples:
  # Comment explaining the example
  gw <command> example-args

  # Another example
  gw <command> --option value

Configuration:
  Optional section about config file if relevant.
```

## Adding New Commands

### Custom Command

1. Create `src/commands/<command-name>.ts` following the command structure above
2. Import and register in `src/main.ts`:

```typescript
import { executeNewCommand } from './commands/new-command.ts';

const COMMANDS = {
  // ... existing commands
  'new-command': executeNewCommand,
};
```

3. Update help text in `src/lib/cli.ts`:

```typescript
export function showGlobalHelp(): void {
  console.log(`
Commands:
  ...existing commands...
  new-command      Brief description
`);
}
```

### Proxy Command (git worktree wrapper)

1. Create `src/commands/<command-name>.ts` using the proxy pattern
2. Register in `src/main.ts` (same as above)
3. Update help in `src/lib/cli.ts`

## Testing

```bash
# Run all tests
nx run gw-tool:test

# Test files should be named *.test.ts or *.spec.ts
```

## Publishing

Use the automated release process:

```bash
nx run gw-tool:release
```

This handles versioning (via conventional commits), building, GitHub release, and npm publish.

## Common Patterns

### Loading Config

```typescript
import { loadConfig } from '../lib/config.ts';

const { config, gitRoot } = await loadConfig();
```

### Resolving Worktree Paths

```typescript
import { resolveWorktreePath } from '../lib/path-resolver.ts';

const worktreePath = resolveWorktreePath(gitRoot, worktreeName);
```

### Running Git Commands

```typescript
const gitProcess = new Deno.Command('git', {
  args: ['worktree', 'add', worktreeName],
  stdout: 'inherit',
  stderr: 'inherit',
});

const { code } = await gitProcess.output();

if (code !== 0) {
  output.error('Failed to create worktree');
  Deno.exit(code);
}
```

### Parsing Arguments with Options

```typescript
import { parseArgs } from '$std/cli/parse-args';

const parsed = parseArgs(args, {
  boolean: ['help', 'dry-run'],
  string: ['from'],
  alias: {
    h: 'help',
    n: 'dry-run',
  },
});
```

### Validating Required Arguments

```typescript
if (!parsed.requiredArg) {
  output.error('Required argument is missing');
  showHelp();
  Deno.exit(1);
}
```

### Executing Hooks

Use the `hooks.ts` module for running pre/post command hooks:

```typescript
import { executeHooks, type HookVariables } from '../lib/hooks.ts';

// Prepare hook variables for substitution
const hookVariables: HookVariables = {
  worktree: 'feat/new-feature',
  worktreePath: '/path/to/repo/feat/new-feature',
  gitRoot: '/path/to/repo',
  branch: 'feat/new-feature',
};

// Execute pre-hooks (abort on failure)
if (config.hooks?.add?.pre && config.hooks.add.pre.length > 0) {
  const { allSuccessful } = await executeHooks(
    config.hooks.add.pre,
    gitRoot, // working directory
    hookVariables,
    'pre-add', // hook type for logging
    true // abort on failure
  );

  if (!allSuccessful) {
    output.error('Pre-add hook failed. Aborting.');
    Deno.exit(1);
  }
}

// Execute post-hooks (warn but continue on failure)
if (config.hooks?.add?.post && config.hooks.add.post.length > 0) {
  const { allSuccessful } = await executeHooks(
    config.hooks.add.post,
    worktreePath, // working directory (new worktree)
    hookVariables,
    'post-add', // hook type for logging
    false // don't abort on failure
  );

  if (!allSuccessful) {
    output.warning('One or more post-add hooks failed');
  }
}
```

Hook variables support substitution in commands:

- `{worktree}` - The worktree name
- `{worktreePath}` - Full absolute path to the worktree
- `{gitRoot}` - The git repository root path
- `{branch}` - The branch name
