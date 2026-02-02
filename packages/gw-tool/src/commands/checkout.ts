/**
 * Checkout command implementation
 * Smart git checkout wrapper that works well with worktrees
 */

import { listWorktrees } from "../lib/git-utils.ts";
import { signalNavigation } from "../lib/shell-navigation.ts";
import * as output from "../lib/output.ts";

/**
 * Check if a branch exists locally
 */
async function branchExistsLocally(branchName: string): Promise<boolean> {
  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "--verify", branchName],
    stdout: "null",
    stderr: "null",
  });
  const result = await cmd.output();
  return result.code === 0;
}

/**
 * Check if a branch exists on remote
 */
async function branchExistsOnRemote(
  branchName: string,
  remoteName = "origin",
): Promise<boolean> {
  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "--verify", `${remoteName}/${branchName}`],
    stdout: "null",
    stderr: "null",
  });
  const result = await cmd.output();
  return result.code === 0;
}

/**
 * Get current branch name
 */
async function getCurrentBranch(): Promise<string | null> {
  const cmd = new Deno.Command("git", {
    args: ["branch", "--show-current"],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout } = await cmd.output();
  if (code !== 0) {
    return null; // Detached HEAD or error
  }

  const branch = new TextDecoder().decode(stdout).trim();
  return branch || null;
}

/**
 * Checkout a branch in the current worktree
 */
async function checkoutBranch(branchName: string): Promise<boolean> {
  const cmd = new Deno.Command("git", {
    args: ["checkout", branchName],
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await cmd.output();
  return code === 0;
}

/**
 * Show help for the checkout command
 */
function showCheckoutHelp(): void {
  console.log(`
gw checkout - Smart git checkout for worktree workflows

Usage:
  gw checkout <branch>
  gw co <branch>

Arguments:
  <branch>    Branch name to checkout

Description:
  A smart wrapper around git checkout that handles common worktree scenarios:

  1. If the branch exists locally and isn't checked out anywhere:
     - Checks out the branch in the current worktree (standard git checkout)

  2. If the branch is already checked out in another worktree:
     - Navigates to that worktree automatically
     - Shows you where the branch is checked out

  3. If the branch exists on remote but not locally:
     - Prompts to create a new worktree for it (via gw add)

  4. If the branch doesn't exist anywhere:
     - Shows an error with suggestions

Options:
  -h, --help    Show this help message

Examples:
  # Checkout a local branch
  gw checkout feature-x

  # Navigate to worktree where main is checked out
  gw checkout main

  # Create worktree for remote branch (prompts)
  gw checkout origin/feature-y

Tips:
  - Use 'gw co' as a shorthand for 'gw checkout'
  - To update your branch with main, use 'gw pull' instead of checking out main
  - The command teaches you worktree workflows by showing what's happening
`);
}

/**
 * Execute the checkout command
 */
export async function executeCheckout(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showCheckoutHelp();
    Deno.exit(args.length === 0 ? 1 : 0);
  }

  const branchName = args[0];

  // Get current branch
  const currentBranch = await getCurrentBranch();
  if (currentBranch === branchName) {
    output.info(`Already on '${branchName}'`);
    Deno.exit(0);
  }

  // Get list of all worktrees
  const worktrees = await listWorktrees();

  // Check if branch is checked out in any worktree
  const worktreeWithBranch = worktrees.find((wt) => wt.branch === branchName);

  if (worktreeWithBranch) {
    // Case 2: Branch is checked out in another worktree - navigate to it
    console.log("");
    output.info(
      `Branch ${output.bold(branchName)} is checked out in another worktree:`,
    );
    console.log(`  ${output.path(worktreeWithBranch.path)}`);
    console.log("");
    console.log("Navigating there...");

    await signalNavigation(worktreeWithBranch.path);
    Deno.exit(0);
  }

  // Check if branch exists locally
  const existsLocally = await branchExistsLocally(branchName);

  if (existsLocally) {
    // Case 1: Branch exists locally and not checked out - checkout normally
    console.log(`Checking out ${output.bold(branchName)}...`);
    const success = await checkoutBranch(branchName);

    if (success) {
      output.success(`Switched to branch '${branchName}'`);
      Deno.exit(0);
    } else {
      output.error(`Failed to checkout '${branchName}'`);
      Deno.exit(1);
    }
  }

  // Check if branch exists on remote
  const existsOnRemote = await branchExistsOnRemote(branchName);

  if (existsOnRemote) {
    // Case 3: Branch exists on remote but not locally - prompt to create worktree
    console.log("");
    output.info(
      `Branch ${output.bold(branchName)} exists on remote but not locally.`,
    );
    console.log("");

    const response = prompt(
      `Create a new worktree for it? [Y/n]:`,
    );

    if (
      response === null || response === "" || response.toLowerCase() === "y" ||
      response.toLowerCase() === "yes"
    ) {
      console.log("");
      console.log(`Running: ${output.dim(`gw add ${branchName}`)}`);
      console.log("");

      // Execute gw add
      const addCmd = new Deno.Command(Deno.execPath(), {
        args: ["run", "--allow-all", Deno.mainModule, "add", branchName],
        stdout: "inherit",
        stderr: "inherit",
      });

      const { code } = await addCmd.output();
      Deno.exit(code);
    } else {
      console.log("");
      output.info("Operation cancelled.");
      Deno.exit(0);
    }
  }

  // Case 4: Branch doesn't exist anywhere
  console.log("");
  output.error(`Branch '${branchName}' not found locally or on remote.`);
  console.log("");
  console.log("Did you mean to:");
  console.log(
    `  ${output.bold(`gw add ${branchName}`)} - Create a new worktree with a new branch`,
  );
  console.log("");
  Deno.exit(1);
}
