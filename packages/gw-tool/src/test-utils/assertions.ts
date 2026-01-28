/**
 * Custom assertion helpers for testing
 */

import { assertEquals } from "$std/assert";
import { join } from "$std/path";

/**
 * Assert that a file exists
 */
export async function assertFileExists(
  path: string,
  message?: string,
): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (!stat.isFile) {
      throw new Error(`Path exists but is not a file: ${path}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(message || `File does not exist: ${path}`);
    }
    throw error;
  }
}

/**
 * Assert that a directory exists
 */
export async function assertDirExists(
  path: string,
  message?: string,
): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (!stat.isDirectory) {
      throw new Error(`Path exists but is not a directory: ${path}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(message || `Directory does not exist: ${path}`);
    }
    throw error;
  }
}

/**
 * Assert that a path does NOT exist
 */
export async function assertPathNotExists(
  path: string,
  message?: string,
): Promise<void> {
  try {
    await Deno.stat(path);
    throw new Error(message || `Path should not exist: ${path}`);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return; // Expected
    }
    throw error;
  }
}

/**
 * Assert file content matches expected
 */
export async function assertFileContent(
  path: string,
  expected: string,
  message?: string,
): Promise<void> {
  const content = await Deno.readTextFile(path);
  assertEquals(content, expected, message);
}

/**
 * Assert that a worktree exists in git worktree list
 */
export async function assertWorktreeExists(
  repoPath: string,
  worktreeName: string,
): Promise<void> {
  const output = await captureCommand(
    "git",
    ["worktree", "list", "--porcelain"],
    repoPath,
  );
  const worktrees = parseWorktreeList(output);
  const expected = join(repoPath, worktreeName);

  // Also check with realpath to handle symlinks
  const expectedReal = await Deno.realPath(expected).catch(() => expected);

  const found = worktrees.some((wt) => {
    const wtReal = Deno.realPathSync(wt);
    return wt === expected || wtReal === expectedReal || wt === expectedReal;
  });

  if (!found) {
    throw new Error(
      `Worktree not found: ${worktreeName}\nExpected: ${expected}\nFound: ${
        worktrees.join(", ")
      }`,
    );
  }
}

/**
 * Assert that a worktree does NOT exist
 */
export async function assertWorktreeNotExists(
  repoPath: string,
  worktreeName: string,
): Promise<void> {
  const output = await captureCommand(
    "git",
    ["worktree", "list", "--porcelain"],
    repoPath,
  );
  const worktrees = parseWorktreeList(output);
  const expected = join(repoPath, worktreeName);

  if (worktrees.some((wt) => wt === expected)) {
    throw new Error(`Worktree should not exist: ${worktreeName}`);
  }
}

/**
 * Assert that a branch exists
 */
export async function assertBranchExists(
  repoPath: string,
  branchName: string,
): Promise<void> {
  const { code } = await new Deno.Command("git", {
    args: ["rev-parse", "--verify", branchName],
    cwd: repoPath,
    stdout: "null",
    stderr: "null",
  }).output();

  if (code !== 0) {
    throw new Error(`Branch does not exist: ${branchName}`);
  }
}

/**
 * Assert that a branch does NOT exist
 */
export async function assertBranchNotExists(
  repoPath: string,
  branchName: string,
): Promise<void> {
  const { code } = await new Deno.Command("git", {
    args: ["rev-parse", "--verify", branchName],
    cwd: repoPath,
    stdout: "null",
    stderr: "null",
  }).output();

  if (code === 0) {
    throw new Error(`Branch should not exist: ${branchName}`);
  }
}

/**
 * Helper to capture command output
 */
async function captureCommand(
  cmd: string,
  args: string[],
  cwd?: string,
): Promise<string> {
  const process = new Deno.Command(cmd, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout } = await process.output();
  if (code !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
  return new TextDecoder().decode(stdout);
}

/**
 * Parse git worktree list --porcelain output
 */
function parseWorktreeList(output: string): string[] {
  const worktrees: string[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      worktrees.push(line.substring("worktree ".length));
    }
  }

  return worktrees;
}
