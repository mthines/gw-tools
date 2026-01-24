/**
 * Init command implementation
 * Initializes the gw configuration for a repository
 */

import { resolve } from '$std/path';
import { saveConfig } from '../lib/config.ts';
import { validatePathExists } from '../lib/path-resolver.ts';
import type { Config } from '../lib/types.ts';

/**
 * Parse init command arguments
 */
function parseInitArgs(args: string[]): {
  help: boolean;
  root?: string;
  defaultSource?: string;
} {
  const result: {
    help: boolean;
    root?: string;
    defaultSource?: string;
  } = {
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--root' && i + 1 < args.length) {
      result.root = args[++i];
    } else if (arg === '--default-source' && i + 1 < args.length) {
      result.defaultSource = args[++i];
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

Creates a .gw/config.json file in the current directory with the repository
root and other settings. This is useful when auto-detection fails or when
you want to manually specify the repository root.

Options:
  --root <path>              Specify the git repository root path (required)
  --default-source <name>    Set the default source worktree (default: "main")
  -h, --help                 Show this help message

Examples:
  # Initialize with repository root
  gw init --root /Users/username/Workspace/repo.git

  # Initialize with custom default source
  gw init --root /Users/username/Workspace/repo.git --default-source master

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

  // Validate arguments
  if (!parsed.root) {
    console.error('Error: --root option is required\n');
    showInitHelp();
    Deno.exit(1);
  }

  // Resolve and validate root path
  const rootPath = resolve(parsed.root);

  try {
    await validatePathExists(rootPath, 'directory');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    Deno.exit(1);
  }

  // Create config
  const config: Config = {
    root: rootPath,
    defaultSource: parsed.defaultSource || 'main',
  };

  // Save config in current directory
  const currentDir = Deno.cwd();

  try {
    await saveConfig(currentDir, config);
    console.log(`Created config at ${currentDir}/.gw/config.json`);
    console.log(`Repository root: ${rootPath}`);
    console.log(`Default source worktree: ${config.defaultSource}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: Failed to create config - ${message}`);
    Deno.exit(1);
  }
}
