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
  interactive: boolean;
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
    interactive: boolean;
    root?: string;
    defaultBranch?: string;
    autoCopyFiles?: string[];
    preAddHooks?: string[];
    postAddHooks?: string[];
    cleanThreshold?: number;
    autoClean?: boolean;
  } = {
    help: false,
    interactive: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--interactive" || arg === "-i") {
      result.interactive = true;
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
 * Prompt for configuration in interactive mode
 */
function promptForConfig(): {
  defaultBranch?: string;
  autoCopyFiles?: string[];
  preAddHooks?: string[];
  postAddHooks?: string[];
  cleanThreshold?: number;
  autoClean?: boolean;
} {
  console.log("\n" + output.bold("Interactive Configuration") + "\n");
  console.log(
    output.dim(
      "Press Enter to accept defaults. Leave blank to skip optional settings.\n",
    ),
  );

  const config: {
    defaultBranch?: string;
    autoCopyFiles?: string[];
    preAddHooks?: string[];
    postAddHooks?: string[];
    cleanThreshold?: number;
    autoClean?: boolean;
  } = {};

  // Default branch
  const defaultBranchInput = prompt(
    `Default source worktree name [${output.dim("main")}]: `,
  );
  if (defaultBranchInput && defaultBranchInput.trim()) {
    config.defaultBranch = defaultBranchInput.trim();
  }

  // Auto-copy files
  console.log();
  const wantAutoCopy = prompt(
    `Do you want to auto-copy files when creating worktrees? (y/n) [${
      output.dim("n")
    }]: `,
  );
  if (wantAutoCopy?.toLowerCase() === "y" || wantAutoCopy?.toLowerCase() === "yes") {
    console.log(
      output.dim("  Enter comma-separated file/directory paths (e.g., .env,secrets/)"),
    );
    const autoCopyInput = prompt("  Files to auto-copy: ");
    if (autoCopyInput && autoCopyInput.trim()) {
      config.autoCopyFiles = autoCopyInput.split(",").map((f) => f.trim()).filter((f) => f);
    }
  }

  // Pre-add hooks
  console.log();
  const wantPreHooks = prompt(
    `Do you want to add pre-add hooks? (y/n) [${output.dim("n")}]: `,
  );
  if (wantPreHooks?.toLowerCase() === "y" || wantPreHooks?.toLowerCase() === "yes") {
    console.log(
      output.dim("  Enter commands to run before creating worktrees"),
    );
    console.log(
      output.dim(
        "  Variables: {worktree}, {worktreePath}, {gitRoot}, {branch}",
      ),
    );
    const preHooks: string[] = [];
    let hookNum = 1;
    while (true) {
      const hookInput = prompt(`  Pre-add hook ${hookNum} (leave blank to finish): `);
      if (!hookInput || !hookInput.trim()) break;
      preHooks.push(hookInput.trim());
      hookNum++;
    }
    if (preHooks.length > 0) {
      config.preAddHooks = preHooks;
    }
  }

  // Post-add hooks
  console.log();
  const wantPostHooks = prompt(
    `Do you want to add post-add hooks? (y/n) [${output.dim("n")}]: `,
  );
  if (wantPostHooks?.toLowerCase() === "y" || wantPostHooks?.toLowerCase() === "yes") {
    console.log(
      output.dim("  Enter commands to run after creating worktrees"),
    );
    console.log(
      output.dim(
        "  Variables: {worktree}, {worktreePath}, {gitRoot}, {branch}",
      ),
    );
    const postHooks: string[] = [];
    let hookNum = 1;
    while (true) {
      const hookInput = prompt(`  Post-add hook ${hookNum} (leave blank to finish): `);
      if (!hookInput || !hookInput.trim()) break;
      postHooks.push(hookInput.trim());
      hookNum++;
    }
    if (postHooks.length > 0) {
      config.postAddHooks = postHooks;
    }
  }

  // Clean threshold
  console.log();
  const cleanThresholdInput = prompt(
    `Days before worktrees are considered stale [${output.dim("7")}]:`,
  );
  if (cleanThresholdInput && cleanThresholdInput.trim()) {
    const value = parseInt(cleanThresholdInput.trim(), 10);
    if (!isNaN(value) && value >= 0) {
      config.cleanThreshold = value;
    } else {
      console.log(
        output.warning("  Invalid value, using default (7 days)"),
      );
    }
  }

  // Auto-clean
  console.log();
  const autoCleanInput = prompt(
    `Enable automatic cleanup of stale worktrees? (y/n) [${output.dim("n")}]:`,
  );
  if (autoCleanInput?.toLowerCase() === "y" || autoCleanInput?.toLowerCase() === "yes") {
    config.autoClean = true;
  }

  console.log();
  return config;
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
  -i, --interactive               Interactively prompt for configuration options
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
  # Interactive mode - prompts for all configuration options
  gw init --interactive

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

  # Interactive mode with explicit root
  gw init --interactive --root /Users/username/Workspace/repo.git

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

  // If interactive mode, prompt for configuration
  if (parsed.interactive) {
    const interactiveConfig = promptForConfig();

    // Merge interactive config with parsed args (parsed args take precedence)
    if (interactiveConfig.defaultBranch && !parsed.defaultBranch) {
      parsed.defaultBranch = interactiveConfig.defaultBranch;
    }
    if (interactiveConfig.autoCopyFiles && !parsed.autoCopyFiles) {
      parsed.autoCopyFiles = interactiveConfig.autoCopyFiles;
    }
    if (interactiveConfig.preAddHooks && !parsed.preAddHooks) {
      parsed.preAddHooks = interactiveConfig.preAddHooks;
    }
    if (interactiveConfig.postAddHooks && !parsed.postAddHooks) {
      parsed.postAddHooks = interactiveConfig.postAddHooks;
    }
    if (interactiveConfig.cleanThreshold !== undefined && parsed.cleanThreshold === undefined) {
      parsed.cleanThreshold = interactiveConfig.cleanThreshold;
    }
    if (interactiveConfig.autoClean !== undefined && parsed.autoClean === undefined) {
      parsed.autoClean = interactiveConfig.autoClean;
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
