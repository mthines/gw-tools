/**
 * CLI argument parsing and help text
 */

import { parseArgs as denoParseArgs } from "$std/cli/parse-args";
import type { CopyOptions, GlobalArgs } from "./types.ts";

/**
 * Parse global CLI arguments to extract command and help flag
 */
export function parseGlobalArgs(args: string[]): GlobalArgs {
  // Simple manual parsing for command extraction
  const [firstArg, ...restArgs] = args;

  // Check for global help flag
  if (firstArg === "--help" || firstArg === "-h" || !firstArg) {
    return {
      command: firstArg ? undefined : undefined,
      args: restArgs,
      help: true,
    };
  }

  return {
    command: firstArg,
    args: restArgs,
    help: false,
  };
}

/**
 * Display global help text
 */
export function showGlobalHelp(): void {
  console.log(`
gw - Git Worktree Tools

Usage:
  gw <command> [options] [arguments]
  gw --help

Commands:
  copy     Copy files/directories between worktrees

Options:
  -h, --help    Show this help message

Examples:
  gw copy feat-branch .env components/agents/.env
  gw copy --from main feat-123 .env
  gw copy --help

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
 * Display help text for the copy command
 */
export function showCopyHelp(): void {
  console.log(`
gw copy - Copy files/directories between worktrees

Usage:
  gw copy [options] <target-worktree> <files...>

Arguments:
  <target-worktree>    Name or full path of the target worktree directory
                       Can be relative (e.g., feat-branch) or absolute path

  <files...>           One or more files or directories to copy
                       Paths are relative to the worktree root

Options:
  --from <source>      Source worktree name (default: from config or "main")
  -n, --dry-run        Show what would be copied without actually copying
  -h, --help           Show this help message

Description:
  Copy files and directories from a source worktree to a target worktree,
  preserving the directory structure. Useful for copying secrets and
  environment files when creating new git worktrees.

  The source and target worktrees must exist. Parent directories for copied
  files are created automatically if needed.

Examples:
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

  # Use absolute path as target (strips repo prefix if provided)
  gw copy /full/path/to/repo/feat-branch .env

Configuration:
  Configuration is stored at <git-root>/.gw/config.json
  The config file is automatically created on first use with sensible defaults.

  Example config:
  {
    "defaultSource": "main"
  }
`);
}
