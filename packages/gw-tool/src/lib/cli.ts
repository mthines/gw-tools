/**
 * CLI argument parsing and help text
 */

import { parseArgs as denoParseArgs } from "$std/cli/parse-args";
import type { CopyOptions, GlobalArgs, UpdateOptions } from "./types.ts";
import { VERSION } from "./version.ts";

/**
 * Parse global CLI arguments to extract command and help flag
 */
export function parseGlobalArgs(args: string[]): GlobalArgs {
  // Simple manual parsing for command extraction
  const [firstArg, ...restArgs] = args;

  // Check for global version flag
  if (firstArg === "--version" || firstArg === "-v") {
    return {
      command: undefined,
      args: restArgs,
      help: false,
      version: true,
    };
  }

  // Check for global help flag
  if (firstArg === "--help" || firstArg === "-h" || !firstArg) {
    return {
      command: firstArg ? undefined : undefined,
      args: restArgs,
      help: true,
      version: false,
    };
  }

  return {
    command: firstArg,
    args: restArgs,
    help: false,
    version: false,
  };
}

/**
 * Display version information
 */
export function showVersion(): void {
  console.log(`gw version ${VERSION}`);
}

/**
 * Display version information
 */
export function showLogo(): void {
  console.log(`  ██████   ██      ██
 ██        ██      ██
 ██   ███  ██  ██  ██
 ██    ██   ██ ██ ██
  ██████     ██  ██
 _____ ___   ___  _
|_   _/ _ \\ / _ \\| |
  | || (_) | (_) | |__
  |_| \\___/ \\___/|____|    `);
}

/**
 * Display global help text
 */
export function showGlobalHelp(): void {
  console.log(`
gw - Git Worktree Tools (v${VERSION})

Usage:
  gw <command> [options] [arguments]
  gw --help

Commands:
  add              Create a new worktree with optional auto-copy
  cd               Navigate to a worktree directory
  checkout, co     Smart git checkout for worktree workflows
  update           Update current worktree with latest changes from default branch
  sync             Sync files/directories between worktrees
  init             Initialize gw configuration for a repository
  show-init        Generate a 'gw init' command from current configuration
  install-shell    Install shell integration for gw cd (auto-runs on npm install)
  root             Get the root directory of the current git repository
  clean            Remove stale worktrees older than configured threshold

Git Worktree Proxy Commands:
  list, ls         List all worktrees in the repository
  remove, rm       Remove a worktree from the repository
  move, mv         Move a worktree to a new location
  prune            Clean up worktree data; --clean removes all clean worktrees
  lock             Lock a worktree to prevent removal
  unlock           Unlock a worktree to allow removal
  repair           Repair worktree administrative files

Options:
  -h, --help       Show this help message
  -v, --version    Show version information

Examples:
  gw add feat-branch
  gw add feat-branch -b my-branch
  gw cd feat-branch
  gw checkout main
  gw co feature-x
  gw sync feat-branch .env components/agents/.env
  gw list
  gw remove feat-branch
  gw init --root /path/to/repo.git --auto-copy-files .env,secrets/
  gw clean --dry-run

For command-specific help:
  gw <command> --help
`);
}

/**
 * Parse arguments for the copy command
 */
export function parseCopyArgs(args: string[]): CopyOptions {
  const parsed = denoParseArgs(args, {
    boolean: ["help", "dry-run"],
    string: ["from"],
    alias: {
      h: "help",
      n: "dry-run",
    },
    "--": true,
  });

  const positionalArgs = parsed._ as string[];
  const [target, ...files] = positionalArgs;

  return {
    help: parsed.help as boolean,
    from: parsed.from as string | undefined,
    target: target as string,
    files: files as string[],
    dryRun: parsed["dry-run"] as boolean | undefined,
  };
}

/**
 * Display help text for the sync command
 */
export function showCopyHelp(): void {
  console.log(`
gw sync - Sync files/directories between worktrees

Usage:
  gw sync [options] <target-worktree> [files...]

Arguments:
  <target-worktree>    Name or full path of the target worktree directory
                       Can be relative (e.g., feat-branch) or absolute path

  [files...]           One or more files or directories to sync
                       Paths are relative to the worktree root
                       If omitted, uses autoCopyFiles from .gw/config.json

Options:
  --from <source>      Source worktree name (default: from config or "main")
  -n, --dry-run        Show what would be synced without actually syncing
  -h, --help           Show this help message

Description:
  Sync files and directories from a source worktree to a target worktree,
  preserving the directory structure. Useful for syncing secrets and
  environment files when creating new git worktrees.

  The source and target worktrees must exist. Parent directories for synced
  files are created automatically if needed.

Examples:
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

  # Use absolute path as target (strips repo prefix if provided)
  gw sync /full/path/to/repo/feat-branch .env

Configuration:
  Configuration is stored at .gw/config.json (searched walking up from cwd)
  The config file is automatically created on first use with auto-detected settings.

  Example config:
  {
    "root": "/Users/username/Workspace/repo.git",
    "defaultBranch": "main",
    "autoCopyFiles": [".env", "apps/web/.env.local"]
  }

  If auto-detection fails, run 'gw init --root <path>' to specify manually.
`);
}

/**
 * Parse arguments for the update command
 */
export function parseUpdateArgs(args: string[]): UpdateOptions {
  const parsed = denoParseArgs(args, {
    boolean: ["help", "force", "dry-run", "merge", "rebase"],
    string: ["from", "remote"],
    alias: {
      h: "help",
      f: "force",
      n: "dry-run",
      m: "merge",
      r: "rebase",
    },
    "--": true,
  });

  return {
    help: parsed.help as boolean,
    force: parsed.force as boolean,
    dryRun: parsed["dry-run"] as boolean,
    branch: parsed.from as string | undefined,
    remote: (parsed.remote as string) || "origin",
    merge: parsed.merge as boolean | undefined,
    rebase: parsed.rebase as boolean | undefined,
  };
}

/**
 * Display help text for the update command
 */
export function showUpdateHelp(): void {
  console.log(`
gw update - Update current worktree with latest changes from default branch

Usage:
  gw update [options]

Options:
  --from <branch>      Update from specified branch instead of defaultBranch
  --remote <name>      Specify remote name (default: "origin")
  -m, --merge          Force merge strategy (overrides config)
  -r, --rebase         Force rebase strategy (overrides config)
  -f, --force          Skip uncommitted changes check (dangerous)
  -n, --dry-run        Show what would happen without executing
  -h, --help           Show this help message

Description:
  Fetches the latest version of the configured default branch (typically "main")
  from the remote and updates your current worktree's active branch using either
  merge or rebase strategy.

  This is useful when working in a worktree and you want to update your branch
  with the latest changes from main without having to switch worktrees or
  checkout the main branch.

  Update strategy:
  - Uses merge by default (creates merge commits if histories have diverged)
  - Can be configured to use rebase via updateStrategy in .gw/config.json
  - Can be overridden per-command with --merge or --rebase flags

  Safety checks:
  - Blocks if you have uncommitted changes (use --force to override)
  - Blocks if you're in a detached HEAD state
  - Handles merge/rebase conflicts gracefully

Examples:
  # Update with configured strategy (or merge if not configured)
  gw update

  # Force merge even if rebase is configured
  gw update --merge

  # Force rebase even if merge is configured
  gw update --rebase

  # Update from a specific branch
  gw update --from develop

  # Preview what would happen without executing
  gw update --dry-run

  # Force update even with uncommitted changes (not recommended)
  gw update --force

  # Use a different remote
  gw update --remote upstream

Configuration:
  The default branch and update strategy are configured in .gw/config.json:
  {
    "defaultBranch": "main",
    "updateStrategy": "merge"  // or "rebase"
  }

  If updateStrategy is not configured, defaults to "merge".
`);
}
