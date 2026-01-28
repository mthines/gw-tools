/**
 * Init command implementation
 * Initializes the gw configuration for a repository
 */

import { resolve } from "$std/path";
import { saveConfig } from "../lib/config.ts";
import { findGitRoot, validatePathExists } from "../lib/path-resolver.ts";
import type { Config } from "../lib/types.ts";
import * as output from "../lib/output.ts";

/**
 * Parse init command arguments
 */
function parseInitArgs(args: string[]): {
  help: boolean;
  root?: string;
  defaultBranch?: string;
  autoCopyFiles?: string[];
  preAddHooks?: string[];
  postAddHooks?: string[];
  cleanThreshold?: number;
  autoClean?: boolean;
} {
  const result: {
    help: boolean;
    root?: string;
    defaultBranch?: string;
    autoCopyFiles?: string[];
    preAddHooks?: string[];
    postAddHooks?: string[];
    cleanThreshold?: number;
    autoClean?: boolean;
  } = {
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--root" && i + 1 < args.length) {
      result.root = args[++i];
    } else if (arg === "--default-source" && i + 1 < args.length) {
      result.defaultBranch = args[++i];
    } else if (arg === "--auto-copy-files" && i + 1 < args.length) {
      // Split comma-separated list
      const filesArg = args[++i];
      result.autoCopyFiles = filesArg.split(",").map((f) => f.trim());
    } else if (arg === "--pre-add" && i + 1 < args.length) {
      // Add to pre-add hooks array (can be specified multiple times)
      if (!result.preAddHooks) result.preAddHooks = [];
      result.preAddHooks.push(args[++i]);
    } else if (arg === "--post-add" && i + 1 < args.length) {
      // Add to post-add hooks array (can be specified multiple times)
      if (!result.postAddHooks) result.postAddHooks = [];
      result.postAddHooks.push(args[++i]);
    } else if (arg === "--clean-threshold" && i + 1 < args.length) {
      const value = parseInt(args[++i], 10);
      if (!isNaN(value) && value >= 0) {
        result.cleanThreshold = value;
      } else {
        throw new Error("--clean-threshold must be a non-negative number");
      }
    } else if (arg === "--auto-clean") {
      result.autoClean = true;
    }
  }

  return result;
}

/**
 * Show help for the init command
 */
function showInitHelp(): void {
  console.log(`Usage: gw init [options]

Initialize gw configuration for a git repository.

Creates a .gw/config.json file with the repository root and other settings.
If --root is not provided, attempts to auto-detect the git repository root.

Options:
  --root <path>                   Specify the git repository root path (optional, auto-detects if not provided)
  --default-source <name>         Set the default source worktree (default: "main")
  --auto-copy-files <files>       Comma-separated list of files to auto-copy
                                  when creating new worktrees with 'gw add'
  --pre-add <command>             Command to run before 'gw add' creates a worktree
                                  (can be specified multiple times for multiple hooks)
  --post-add <command>            Command to run after 'gw add' creates a worktree
                                  (can be specified multiple times for multiple hooks)
  --clean-threshold <days>        Number of days before worktrees are considered
                                  stale for 'gw clean' (default: 7)
  --auto-clean                    Enable automatic cleanup of stale worktrees
                                  (runs on 'gw add' and 'gw list' with 24h cooldown)
  -h, --help                      Show this help message

Hook Variables:
  Hooks support variable substitution:
    {worktree}      - The worktree name (e.g., "feat/new-feature")
    {worktreePath}  - Full absolute path to the worktree
    {gitRoot}       - The git repository root path
    {branch}        - The branch name

Examples:
  # Initialize with auto-detected root and auto-copy files
  gw init --auto-copy-files .env,secrets/

  # Initialize with custom default source (auto-detects root)
  gw init --default-source master

  # Initialize with post-add hook to install dependencies
  gw init --post-add "cd {worktreePath} && pnpm install"

  # Initialize with pre-add validation hook
  gw init --pre-add "echo 'Creating worktree: {worktree}'"

  # Initialize with multiple hooks
  gw init --pre-add "echo 'Starting...'" --post-add "cd {worktreePath} && pnpm install" --post-add "echo 'Done!'"

  # Initialize with explicit repository root
  gw init --root /Users/username/Workspace/repo.git

  # Initialize with all options
  gw init --root /Users/username/Workspace/repo.git --default-source master --auto-copy-files .env,secrets/ --post-add "cd {worktreePath} && pnpm install"

  # Show help
  gw init --help
`);
}

/**
 * Execute the init command
 *
 * @param args Command-line arguments for the init command
 */
export async function executeInit(args: string[]): Promise<void> {
  const parsed = parseInitArgs(args);

  // Show help if requested
  if (parsed.help) {
    showInitHelp();
    Deno.exit(0);
  }

  // Determine root path: use provided --root or try auto-detection
  let rootPath: string;

  if (parsed.root) {
    // User provided --root, use it
    rootPath = resolve(parsed.root);

    try {
      await validatePathExists(rootPath, "directory");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.error(message);
      Deno.exit(1);
    }
  } else {
    // Try auto-detection
    try {
      rootPath = await findGitRoot();
      output.info(`Auto-detected git root: ${output.path(rootPath)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.error(`Could not auto-detect git root - ${message}`);
      console.error("Please specify the repository root with --root option\n");
      showInitHelp();
      Deno.exit(1);
    }
  }

  // Create config
  const config: Config = {
    root: rootPath,
    defaultBranch: parsed.defaultBranch || "main",
    cleanThreshold: 7, // Default value
  };

  // Add autoCopyFiles if provided
  if (parsed.autoCopyFiles && parsed.autoCopyFiles.length > 0) {
    config.autoCopyFiles = parsed.autoCopyFiles;
  }

  // Add hooks if provided
  if (parsed.preAddHooks || parsed.postAddHooks) {
    config.hooks = {
      add: {},
    };
    if (parsed.preAddHooks && parsed.preAddHooks.length > 0) {
      config.hooks.add!.pre = parsed.preAddHooks;
    }
    if (parsed.postAddHooks && parsed.postAddHooks.length > 0) {
      config.hooks.add!.post = parsed.postAddHooks;
    }
  }

  // Add cleanThreshold if provided
  if (parsed.cleanThreshold !== undefined) {
    config.cleanThreshold = parsed.cleanThreshold;
  }

  // Add autoClean if provided
  if (parsed.autoClean !== undefined) {
    config.autoClean = parsed.autoClean;
  }

  // Save config at the git root (so it can be found by all worktrees)
  try {
    await saveConfig(rootPath, config);
    output.success("Configuration created successfully");
    console.log(`  Config file: ${output.path(`${rootPath}/.gw/config.json`)}`);
    console.log(`  Repository root: ${output.path(rootPath)}`);
    console.log(
      `  Default source worktree: ${
        output.bold(config.defaultBranch || "main")
      }`,
    );
    if (config.autoCopyFiles) {
      console.log(
        `  Auto-copy files: ${output.dim(config.autoCopyFiles.join(", "))}`,
      );
    }
    if (config.hooks?.add?.pre) {
      console.log(
        `  Pre-add hooks: ${
          output.dim(config.hooks.add.pre.length.toString())
        } command(s)`,
      );
    }
    if (config.hooks?.add?.post) {
      console.log(
        `  Post-add hooks: ${
          output.dim(config.hooks.add.post.length.toString())
        } command(s)`,
      );
    }
    if (config.cleanThreshold !== undefined) {
      console.log(
        `  Clean threshold: ${output.bold(config.cleanThreshold.toString())} days`,
      );
    }
    if (config.autoClean) {
      console.log(
        `  Auto-cleanup: ${output.bold("enabled")} ${output.dim("(24h cooldown)")}`,
      );
    }
    console.log();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.error(`Failed to create config - ${message}`);
    Deno.exit(1);
  }
}
