/**
 * Remove command implementation
 * Removes a worktree from the repository
 */

import { resolve } from "$std/path";
import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';
import { loadConfig } from '../lib/config.ts';
import { listWorktrees } from '../lib/git-utils.ts';
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
Before removing, it prompts for confirmation to prevent accidental deletions.

If you remove the worktree you're currently in, the command will show a
helpful message with instructions to navigate back to the git root.

Options:
  All 'git worktree remove' options are supported
  --yes, -y     Skip confirmation prompt
  --force, -f   Force removal even if worktree is dirty or locked
  -h, --help    Show this help message

Examples:
  gw remove feat-branch              # Prompts for confirmation
  gw remove --yes feat-branch        # Skips confirmation
  gw remove -y feat-branch           # Skips confirmation (short form)
  gw remove --force feat-branch      # Force removal, but still prompts
  gw remove -y -f feat-branch        # Force removal without prompt
  gw rm feat-branch                  # Short alias

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
  let worktreePath: string | undefined;
  let isValidWorktree = false;

  if (worktreeName) {
    try {
      const { gitRoot } = await loadConfig();

      // Resolve the worktree path
      // Handles absolute paths, relative paths, and worktree names
      worktreePath = resolveWorktreePath(gitRoot, worktreeName);

      // Check if current directory is inside the worktree being removed
      isRemovingCurrentWorktree = isPathInside(cwd, worktreePath);

      // Check if it's a valid worktree
      const worktrees = await listWorktrees();
      isValidWorktree = worktrees.some((wt) => wt.path === worktreePath);
    } catch {
      // If we can't resolve the path, just continue with removal
    }
  }

  // Check if the path exists but isn't a valid worktree
  let isLeftoverDirectory = false;
  if (worktreePath && !isValidWorktree) {
    try {
      const stat = await Deno.stat(worktreePath);
      if (stat.isDirectory || stat.isFile) {
        isLeftoverDirectory = true;
      }
    } catch {
      // Path doesn't exist or can't be accessed
    }
  }

  // Check if confirmation should be skipped
  const skipConfirmation = args.includes('--yes') || args.includes('-y');

  // Prompt for confirmation unless --yes/-y flag is present
  if (!skipConfirmation && worktreeName) {
    console.log("");

    let message: string;
    if (isLeftoverDirectory) {
      message = `${output.bold(worktreeName)} is not a valid worktree, but a leftover directory exists.\nRemove the directory manually?`;
    } else if (isRemovingCurrentWorktree) {
      message = `You are about to remove the worktree you're currently in: ${output.bold(worktreeName)}`;
    } else {
      message = `Remove worktree ${output.bold(worktreeName)}?`;
    }

    console.log(message);
    const response = prompt(`Are you sure? (yes/no) [no]:`);

    if (response?.toLowerCase() !== "yes" && response?.toLowerCase() !== "y") {
      console.log("");
      output.error("Removal cancelled.");
      Deno.exit(1);
    }
    console.log("");
  }

  // Handle leftover directory removal
  if (isLeftoverDirectory && worktreePath) {
    try {
      await Deno.remove(worktreePath, { recursive: true });
      console.log("");
      output.success(`Leftover directory ${output.bold(`"${worktreeName}"`)} removed successfully`);
      console.log("");

      // Also clean up git's worktree metadata if it exists
      const pruneCmd = new Deno.Command("git", {
        args: ["worktree", "prune"],
        stdout: "null",
        stderr: "null",
      });
      await pruneCmd.output();

      Deno.exit(0);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      output.error(`Failed to remove directory: ${errorMsg}`);
      Deno.exit(1);
    }
  }

  // Filter out --yes/-y flags before passing to git (git doesn't recognize them)
  const filteredArgs = args.filter(arg => arg !== '--yes' && arg !== '-y');

  const successMessage = worktreeName
    ? `Worktree ${output.bold(`"${worktreeName}"`)} removed successfully`
    : 'Worktree removed successfully';

  await executeGitWorktree('remove', filteredArgs, successMessage);

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
