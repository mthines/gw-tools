/**
 * Remove command implementation
 * Removes a worktree from the repository
 */

import { resolve } from "$std/path";
import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';
import { loadConfig } from '../lib/config.ts';
import { listWorktrees, hasUncommittedChanges, hasUnpushedCommits } from '../lib/git-utils.ts';
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

This command wraps 'git worktree remove' and provides smart confirmation prompts.

Prompting Behavior:
  - If the worktree is clean (no uncommitted changes, all commits pushed): removes immediately
  - If the worktree has uncommitted changes or unpushed commits: prompts for confirmation
  - If --force is provided: skips all prompts and forces removal
  - If --yes is provided: skips confirmation prompt

If you remove the worktree you're currently in:
  - The CLI automatically changes to the git root before removal
  - With shell integration installed, your shell will also navigate to the root
  - Without shell integration, you'll need to manually run: cd "$(gw root)"

Options:
  All 'git worktree remove' options are supported
  --yes, -y     Skip confirmation prompt (but still prompts if worktree is dirty unless --force is also used)
  --force, -f   Force removal even if worktree is dirty or locked (never prompts)
  -h, --help    Show this help message

Examples:
  gw remove feat-branch              # Removes if clean, prompts if dirty
  gw remove --yes feat-branch        # Skips confirmation, but prompts if dirty without --force
  gw remove -y feat-branch           # Same as --yes
  gw remove --force feat-branch      # Force removal, never prompts
  gw remove -f feat-branch           # Same as --force (short form)
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

  if (!worktreeName) {
    output.error("Missing worktree name");
    console.log("Usage: gw remove [options] <worktree>");
    Deno.exit(1);
  }

  // Check if we're currently inside the worktree being removed
  const cwd = Deno.cwd();
  let isRemovingCurrentWorktree = false;
  let worktreePath: string | undefined;
  let isValidWorktree = false;
  let isLeftoverDirectory = false;

  try {
    const { gitRoot } = await loadConfig();
    const worktrees = await listWorktrees();

    // First, try to find an EXACT match by worktree name or path
    const exactMatch = worktrees.find((wt) => {
      // Check if worktree name matches exactly (last part of path)
      const wtName = wt.path.split('/').pop() || '';
      if (wtName === worktreeName) return true;

      // Check if full path matches
      if (wt.path === worktreeName) return true;

      // Check if resolved path matches
      const resolvedPath = resolveWorktreePath(gitRoot, worktreeName);
      if (wt.path === resolvedPath) return true;

      return false;
    });

    if (exactMatch) {
      // Found exact match
      worktreePath = exactMatch.path;
      isValidWorktree = true;
      isRemovingCurrentWorktree = isPathInside(cwd, worktreePath);
    } else {
      // No exact match found, check if it's a leftover directory
      const resolvedPath = resolveWorktreePath(gitRoot, worktreeName);
      try {
        const stat = await Deno.stat(resolvedPath);
        if (stat.isDirectory || stat.isFile) {
          // Check if this directory is a parent directory of any worktrees
          const isParentOfWorktrees = worktrees.some((wt) =>
            wt.path.startsWith(resolvedPath + "/")
          );

          if (isParentOfWorktrees) {
            // This is a parent directory containing worktrees, suggest the child worktrees
            const childWorktrees = worktrees.filter((wt) =>
              wt.path.startsWith(resolvedPath + "/")
            );

            console.log("");
            output.error(`${output.bold(worktreeName)} is not a worktree. It's a directory containing worktrees.`);
            console.log("");
            console.log("Did you mean one of these?");
            for (const wt of childWorktrees) {
              const wtName = wt.path.split('/').pop() || '';
              const branchInfo = wt.branch ? ` [${wt.branch}]` : '';
              console.log(`  ${output.bold(wtName)} -> ${wt.path}${branchInfo}`);
            }
            console.log("");
            Deno.exit(1);
          } else {
            // It's a leftover directory at the exact resolved path
            worktreePath = resolvedPath;
            isLeftoverDirectory = true;
            isRemovingCurrentWorktree = isPathInside(cwd, worktreePath);
          }
        }
      } catch {
        // Path doesn't exist - look for similar matches to suggest
        const similarMatches = worktrees.filter((wt) => {
          const wtName = wt.path.split('/').pop() || '';
          return wtName.includes(worktreeName!) || wt.path.includes(worktreeName!);
        });

        if (similarMatches.length > 0) {
          console.log("");
          output.error(`Worktree ${output.bold(worktreeName)} does not exist.`);
          console.log("");
          console.log("Did you mean one of these?");
          for (const wt of similarMatches) {
            const wtName = wt.path.split('/').pop() || '';
            const branchInfo = wt.branch ? ` [${wt.branch}]` : '';
            console.log(`  ${output.bold(wtName)} -> ${wt.path}${branchInfo}`);
          }
          console.log("");
          Deno.exit(1);
        } else {
          console.log("");
          output.error(`Worktree ${output.bold(worktreeName)} does not exist.`);
          console.log("");
          Deno.exit(1);
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.error(`Failed to resolve worktree: ${message}`);
    Deno.exit(1);
  }

  // Handle leftover directory removal automatically (no confirmation)
  if (isLeftoverDirectory && worktreePath && worktreeName) {
    console.log("");
    output.warning(
      `${output.bold(worktreeName)} is not a valid worktree, but a leftover directory exists.`,
    );
    console.log(`Automatically removing...`);

    try {
      // If we're inside the directory being removed, change to git root first
      if (isRemovingCurrentWorktree) {
        try {
          const { gitRoot } = await loadConfig();
          Deno.chdir(gitRoot);
        } catch {
          // If we can't get git root, try parent directory
          const parentPath = resolve(worktreePath, "..");
          Deno.chdir(parentPath);
        }
      }

      await Deno.remove(worktreePath, { recursive: true });
      output.success(`Leftover directory ${output.bold(`"${worktreeName}"`)} removed successfully`);
      console.log("");

      // Also clean up git's worktree metadata if it exists
      try {
        const pruneCmd = new Deno.Command("git", {
          args: ["worktree", "prune"],
          stdout: "null",
          stderr: "null",
        });
        await pruneCmd.output();
      } catch {
        // Ignore prune errors - not critical
      }

      Deno.exit(0);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      output.error(`Failed to remove directory: ${errorMsg}`);
      Deno.exit(1);
    }
  }

  // Check if --force flag is present
  const hasForceFlag = args.includes('--force') || args.includes('-f');

  // Check if we need to prompt based on worktree status
  let shouldPrompt = false;
  let needsForce = false;

  if (!hasForceFlag && worktreeName && !isLeftoverDirectory && worktreePath) {
    try {
      // Check if worktree has uncommitted changes or unpushed commits
      const [uncommitted, unpushed] = await Promise.all([
        hasUncommittedChanges(worktreePath),
        hasUnpushedCommits(worktreePath),
      ]);

      if (uncommitted || unpushed) {
        shouldPrompt = true;
        needsForce = true;
      }
    } catch {
      // If we can't check status, prompt to be safe
      shouldPrompt = true;
      needsForce = true;
    }
  }

  // Prompt for confirmation only if worktree has uncommitted changes or unpushed commits
  if (shouldPrompt && worktreeName) {
    console.log("");

    const message = isRemovingCurrentWorktree
      ? `The worktree you're currently in (${output.bold(worktreeName)}) has uncommitted changes or unpushed commits.`
      : `Worktree ${output.bold(worktreeName)} has uncommitted changes or unpushed commits.`;

    console.log(message);
    console.log("Removing it will result in data loss.");
    const response = prompt(`Are you sure you want to force removal? (yes/no) [no]:`);

    if (response?.toLowerCase() !== "yes" && response?.toLowerCase() !== "y") {
      console.log("");
      output.error("Removal cancelled.");
      Deno.exit(1);
    }

    // User confirmed - add --force flag to ensure removal succeeds
    if (needsForce && !args.includes('--force') && !args.includes('-f')) {
      args.push('--force');
    }

    console.log("");
  }

  // If we're removing the current worktree, change to the git root first
  // This ensures git operations run from a safe location
  if (isRemovingCurrentWorktree) {
    try {
      const { gitRoot } = await loadConfig();
      Deno.chdir(gitRoot);
    } catch (error) {
      // If we can't get git root, continue anyway
      // The git command might still work
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
