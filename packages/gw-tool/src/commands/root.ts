/**
 * Root command implementation
 * Returns the git repository root directory path
 */

import { loadConfig } from "../lib/config.ts";

/**
 * Execute the root command
 *
 * @param args Command-line arguments for the root command
 */
export async function executeRoot(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: gw root

Get the root directory of the current git repository.

This is useful when working with git worktrees to find the main
repository directory that contains all worktrees.

Examples:
  gw root                    # Print repository root path
  cd "$(gw root)"            # Navigate to repository root
  ls "$(gw root)"            # List files in repository root

Options:
  -h, --help                 Show this help message
`);
    Deno.exit(0);
  }

  try {
    // Load config (this will auto-detect and create config on first run)
    const { gitRoot } = await loadConfig();
    console.log(gitRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    Deno.exit(1);
  }
}
