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
 * Get remote URL from git config
 */
async function getRemoteUrl(gitRoot?: string): Promise<string | null> {
  try {
    const args = gitRoot
      ? ['-C', gitRoot, 'config', '--get', 'remote.origin.url']
      : ['config', '--get', 'remote.origin.url'];

    const cmd = new Deno.Command('git', {
      args,
      stdout: 'piped',
      stderr: 'piped',
    });

    const { code, stdout } = await cmd.output();

    if (code === 0) {
      return new TextDecoder().decode(stdout).trim();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a gw init command from a config object
 */
function generateInitCommand(
  config: {
    root?: string;
    defaultBranch?: string;
    autoCopyFiles?: string[];
    hooks?: {
      add?: {
        pre?: string[];
        post?: string[];
      };
    };
    cleanThreshold?: number;
    autoClean?: boolean;
  },
  remoteUrl?: string | null
): string {
  const parts: string[] = ["gw init"];

  // Add remote URL if available (takes precedence over --root)
  if (remoteUrl) {
    parts.push(escapeShellArg(remoteUrl));
  } else if (config.root) {
    // Add root if specified and no remote URL
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

  // Add pre-add hooks
  if (config.hooks?.add?.pre && config.hooks.add.pre.length > 0) {
    for (const hook of config.hooks.add.pre) {
      parts.push(`--pre-add ${escapeShellArg(hook)}`);
    }
  }

  // Add post-add hooks
  if (config.hooks?.add?.post && config.hooks.add.post.length > 0) {
    for (const hook of config.hooks.add.post) {
      parts.push(`--post-add ${escapeShellArg(hook)}`);
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
    const { config, gitRoot } = await loadConfig();

    // Fetch remote URL from git
    const remoteUrl = await getRemoteUrl(gitRoot);

    // Generate the init command with URL
    const initCommand = generateInitCommand(config, remoteUrl);

    // Output the command
    console.log(initCommand);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.error(`Failed to generate init command - ${message}`);
    Deno.exit(1);
  }
}
