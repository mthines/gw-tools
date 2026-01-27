/**
 * Remove command implementation
 * Removes a worktree from the repository
 */

import { resolve } from "$std/path";
import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';
import { loadConfig } from '../lib/config.ts';
import { resolveWorktreePath } from '../lib/path-resolver.ts';
import * as output from '../lib/output.ts';

/**
 * Check if a path is inside or equal to another path
 */
function isPathInside(childPath: string, parentPath: string): boolean {
  const child = resolve(childPath);
  const parent = resolve(parentPath);
  return child === parent || child.startsWith(parent + "/");
}

/**
 * Execute the remove command
 *
 * @param args Command-line arguments for the remove command
 */
export async function executeRemove(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`gw remove - Remove a worktree from the repository

Usage:
  gw remove [options] <worktree>

This command wraps 'git worktree remove' and forwards all arguments.

If you remove the worktree you're currently in, the command will show a
helpful message with instructions to navigate back to the git root.

Options:
  All 'git worktree remove' options are supported
  --force, -f   Force removal even if worktree is dirty or locked
  -h, --help    Show this help message

Examples:
  gw remove feat-branch
  gw remove --force feat-branch
  gw rm feat-branch  # Short alias

For full git worktree remove documentation:
  git worktree remove --help
`);
    Deno.exit(0);
  }

  // Extract worktree name/path from args (first non-flag argument)
  let worktreeName: string | undefined;
  for (const arg of args) {
    if (!arg.startsWith('-')) {
      worktreeName = arg;
      break;
    }
  }

  // Check if we're currently inside the worktree being removed
  const cwd = Deno.cwd();
  let isRemovingCurrentWorktree = false;

  if (worktreeName) {
    try {
      const { gitRoot } = await loadConfig();

      // Resolve the worktree path
      // Handles absolute paths, relative paths, and worktree names
      const worktreePath = resolveWorktreePath(gitRoot, worktreeName);

      // Check if current directory is inside the worktree being removed
      isRemovingCurrentWorktree = isPathInside(cwd, worktreePath);
    } catch {
      // If we can't resolve the path, just continue with removal
    }
  }

  const successMessage = worktreeName
    ? `Worktree ${output.bold(`"${worktreeName}"`)} removed successfully`
    : 'Worktree removed successfully';

  await executeGitWorktree('remove', args, successMessage);

  // If we removed the current worktree, show a helpful message
  if (isRemovingCurrentWorktree) {
    console.log("");
    output.warning(
      "You removed the current worktree. Your shell is now in a non-existent directory."
    );
    console.log(`  Navigate to the git root by running: ${output.bold('cd "$(gw root)"')}`);
    console.log("");
  }
}
