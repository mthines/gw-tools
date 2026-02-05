/**
 * Show-init command implementation
 * Reads the current .gw/config.json and generates an equivalent gw init command
 */

import { loadConfig } from "../lib/config.ts";
import * as output from "../lib/output.ts";

/**
 * Show help for the show-init command
 */
function showShowInitHelp(): void {
  console.log(`Usage: gw show-init [options]

Generate a 'gw init' command that matches the current configuration.

This command reads your existing .gw/config.json and outputs the equivalent
'gw init' command with all options. Useful for documentation or recreating
the same configuration in another repository.

Options:
  -h, --help                      Show this help message

Examples:
  # Show the init command for current config
  gw show-init

  # Copy the command to clipboard (macOS)
  gw show-init | pbcopy

  # Save to a file
  gw show-init > init-command.txt
`);
}

/**
 * Escape a string for safe use in shell commands
 * Adds quotes if the string contains spaces or special characters
 */
function escapeShellArg(arg: string): string {
  // If the string contains spaces, quotes, or special characters, wrap in quotes
  if (/[\s'"$`\\!*?[\](){};<>|&]/.test(arg)) {
    // Escape any existing single quotes and wrap in single quotes
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return arg;
}

/**
 * Generate a gw init command from a config object
 */
function generateInitCommand(config: {
  root?: string;
  defaultBranch?: string;
  autoCopyFiles?: string[];
  hooks?: {
    checkout?: {
      pre?: string[];
      post?: string[];
    };
    add?: {
      pre?: string[];
      post?: string[];
    };
  };
  cleanThreshold?: number;
  autoClean?: boolean;
}): string {
  const parts: string[] = ["gw init"];

  // Add root if specified (though typically not needed for docs)
  if (config.root) {
    parts.push(`--root ${escapeShellArg(config.root)}`);
  }

  // Add default branch if not "main"
  if (config.defaultBranch && config.defaultBranch !== "main") {
    parts.push(`--default-source ${escapeShellArg(config.defaultBranch)}`);
  }

  // Add auto-copy files
  if (config.autoCopyFiles && config.autoCopyFiles.length > 0) {
    const filesArg = config.autoCopyFiles.join(",");
    parts.push(`--auto-copy-files ${escapeShellArg(filesArg)}`);
  }

  // Get hooks config (prefer checkout, fall back to add for backwards compat)
  const hooksConfig = config.hooks?.checkout ?? config.hooks?.add;

  // Add pre-checkout hooks
  if (hooksConfig?.pre && hooksConfig.pre.length > 0) {
    for (const hook of hooksConfig.pre) {
      parts.push(`--pre-checkout ${escapeShellArg(hook)}`);
    }
  }

  // Add post-checkout hooks
  if (hooksConfig?.post && hooksConfig.post.length > 0) {
    for (const hook of hooksConfig.post) {
      parts.push(`--post-checkout ${escapeShellArg(hook)}`);
    }
  }

  // Add clean threshold if not default (7)
  if (config.cleanThreshold !== undefined && config.cleanThreshold !== 7) {
    parts.push(`--clean-threshold ${config.cleanThreshold}`);
  }

  // Add auto-clean if enabled
  if (config.autoClean) {
    parts.push("--auto-clean");
  }

  return parts.join(" ");
}

/**
 * Execute the show-init command
 *
 * @param args Command-line arguments for the show-init command
 */
export async function executeShowInit(args: string[]): Promise<void> {
  // Check for help
  if (args.includes("--help") || args.includes("-h")) {
    showShowInitHelp();
    Deno.exit(0);
  }

  try {
    // Load current config
    const { config } = await loadConfig();

    // Generate the init command
    const initCommand = generateInitCommand(config);

    // Output the command
    console.log(initCommand);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.error(`Failed to generate init command - ${message}`);
    Deno.exit(1);
  }
}
