/**
 * Git utility functions for worktree operations
 */

import { join } from "$std/path";

/**
 * Worktree information from git worktree list
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
}

/**
 * Get list of all worktrees
 */
export async function listWorktrees(): Promise<WorktreeInfo[]> {
  const cmd = new Deno.Command("git", {
    args: ["worktree", "list", "--porcelain"],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    const errorMsg = new TextDecoder().decode(stderr);
    throw new Error(`Failed to list worktrees: ${errorMsg}`);
  }

  const output = new TextDecoder().decode(stdout);
  const lines = output.trim().split("\n");
  const worktrees: WorktreeInfo[] = [];

  let current: Partial<WorktreeInfo> = {};

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      current.path = line.substring("worktree ".length);
    } else if (line.startsWith("HEAD ")) {
      current.head = line.substring("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      current.branch = line.substring("branch ".length).split("/").pop() || "";
    } else if (line === "bare") {
      current.bare = true;
    } else if (line === "") {
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch || "",
          head: current.head || "",
          bare: current.bare || false,
        });
      }
      current = {};
    }
  }

  // Handle last worktree
  if (current.path) {
    worktrees.push({
      path: current.path,
      branch: current.branch || "",
      head: current.head || "",
      bare: current.bare || false,
    });
  }

  return worktrees;
}

/**
 * Check if worktree has uncommitted changes
 */
export async function hasUncommittedChanges(
  worktreePath: string,
): Promise<boolean> {
  const cmd = new Deno.Command("git", {
    args: ["-C", worktreePath, "status", "--porcelain"],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout } = await cmd.output();
  if (code !== 0) return true; // Treat error as "has changes" for safety

  const output = new TextDecoder().decode(stdout).trim();
  return output.length > 0;
}

/**
 * Check if worktree has unpushed commits
 */
export async function hasUnpushedCommits(
  worktreePath: string,
): Promise<boolean> {
  // First check if there's a remote tracking branch
  const trackingCmd = new Deno.Command("git", {
    args: ["-C", worktreePath, "rev-parse", "--abbrev-ref", "@{u}"],
    stdout: "piped",
    stderr: "null",
  });

  const trackingResult = await trackingCmd.output();
  if (trackingResult.code !== 0) {
    // No upstream branch - no unpushed commits
    return false;
  }

  // Check for commits ahead of upstream
  const revListCmd = new Deno.Command("git", {
    args: ["-C", worktreePath, "rev-list", "@{u}..HEAD", "--count"],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout } = await revListCmd.output();
  if (code !== 0) return true; // Treat error as "has unpushed" for safety

  const count = parseInt(new TextDecoder().decode(stdout).trim(), 10);
  return count > 0;
}

/**
 * Get the age of a worktree in days
 */
export async function getWorktreeAgeDays(worktreePath: string): Promise<number> {
  try {
    // Use .git file modification time as proxy for worktree creation time
    const gitPath = join(worktreePath, ".git");
    const stat = await Deno.stat(gitPath);
    const mtime = stat.mtime;

    if (!mtime) return 0;

    const now = new Date();
    const ageMs = now.getTime() - mtime.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    return Math.floor(ageDays);
  } catch {
    return 0; // On error, return 0 (won't be cleaned)
  }
}

/**
 * Remove a worktree
 */
export async function removeWorktree(
  worktreePath: string,
  force = false,
): Promise<void> {
  const args = ["worktree", "remove"];
  if (force) args.push("--force");
  args.push(worktreePath);

  const cmd = new Deno.Command("git", {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error(`Failed to remove worktree: ${worktreePath}`);
  }
}
