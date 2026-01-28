/**
 * Git test repository harness for creating isolated temporary git repositories
 * Provides utilities for testing git worktree operations
 */

import { join, dirname } from "$std/path";

/**
 * Creates an isolated temporary git repository for testing
 * Automatically cleaned up after tests
 */
export class GitTestRepo {
  public readonly path: string;
  private tempDir: string;

  constructor() {
    this.tempDir = Deno.makeTempDirSync({ prefix: "gw-test-" });
    // Resolve symlinks (e.g., /var -> /private/var on macOS)
    this.path = Deno.realPathSync(this.tempDir);
  }

  /**
   * Initialize a bare git repository
   */
  async initBare(): Promise<void> {
    await this.runCommand("git", ["init", "--bare", this.path]);
  }

  /**
   * Initialize a regular git repository
   */
  async init(): Promise<void> {
    await this.runCommand("git", ["init"], this.path);
    // Set initial branch name to main
    await this.runCommand("git", ["checkout", "-b", "main"], this.path);
    // Configure user for commits
    await this.runCommand("git", ["config", "user.email", "test@example.com"], this.path);
    await this.runCommand("git", ["config", "user.name", "Test User"], this.path);
    // Disable GPG signing for tests
    await this.runCommand("git", ["config", "commit.gpgsign", "false"], this.path);
    // Create initial commit (needed for worktrees)
    await this.runCommand("git", ["commit", "--allow-empty", "-m", "Initial commit"], this.path);
  }

  /**
   * Create a worktree
   * @param name Worktree name/path
   * @param branch Optional branch name (defaults to worktree name)
   */
  async createWorktree(name: string, branch?: string): Promise<string> {
    const args = ["worktree", "add"];
    if (branch) {
      args.push("-b", branch);
    }
    args.push(name);
    await this.runCommand("git", args, this.path);
    return join(this.path, name);
  }

  /**
   * Create a file with content
   * @param relativePath Path relative to repo root
   * @param content File content
   */
  async createFile(relativePath: string, content: string): Promise<void> {
    const fullPath = join(this.path, relativePath);
    await Deno.mkdir(dirname(fullPath), { recursive: true });
    await Deno.writeTextFile(fullPath, content);
  }

  /**
   * Create a commit
   * @param message Commit message
   */
  async createCommit(message: string): Promise<void> {
    // Only add if there are files to add
    try {
      await this.runCommand("git", ["add", "-A"], this.path);
    } catch {
      // Ignore - no files to add
    }
    await this.runCommand(
      "git",
      ["commit", "-m", message, "--allow-empty"],
      this.path,
    );
  }

  /**
   * Create a branch
   * @param name Branch name
   * @param startPoint Optional start point (defaults to HEAD)
   */
  async createBranch(name: string, startPoint?: string): Promise<void> {
    const args = ["branch", name];
    if (startPoint) {
      args.push(startPoint);
    }
    await this.runCommand("git", args, this.path);
  }

  /**
   * Get list of worktrees
   * @returns Array of worktree paths
   */
  async listWorktrees(): Promise<string[]> {
    const output = await this.captureCommand(
      "git",
      ["worktree", "list", "--porcelain"],
      this.path,
    );
    return this.parseWorktreeList(output);
  }

  /**
   * Get list of branches
   * @returns Array of branch names
   */
  async listBranches(): Promise<string[]> {
    const output = await this.captureCommand(
      "git",
      ["for-each-ref", "--format=%(refname:short)", "refs/heads/"],
      this.path,
    );
    return output
      .trim()
      .split("\n")
      .filter((b) => b.length > 0);
  }

  /**
   * Check if a file exists in the repo
   * @param relativePath Path relative to repo root
   */
  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = join(this.path, relativePath);
      const stat = await Deno.stat(fullPath);
      return stat.isFile;
    } catch {
      return false;
    }
  }

  /**
   * Read file content
   * @param relativePath Path relative to repo root
   */
  async readFile(relativePath: string): Promise<string> {
    const fullPath = join(this.path, relativePath);
    return await Deno.readTextFile(fullPath);
  }

  /**
   * Cleanup - remove temporary directory
   */
  async cleanup(): Promise<void> {
    try {
      await Deno.remove(this.tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn(`Failed to cleanup test repo: ${error}`);
    }
  }

  /**
   * Helper to run git command and wait for completion
   */
  private async runCommand(
    cmd: string,
    args: string[],
    cwd?: string,
  ): Promise<void> {
    const process = new Deno.Command(cmd, {
      args,
      cwd: cwd || this.path,
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await process.output();
    if (code !== 0) {
      const stderrText = new TextDecoder().decode(stderr);
      const stdoutText = new TextDecoder().decode(stdout);
      throw new Error(
        `Command failed (exit code ${code}): ${cmd} ${args.join(" ")}\nstderr: ${stderrText}\nstdout: ${stdoutText}`,
      );
    }
  }

  /**
   * Helper to capture command output
   */
  private async captureCommand(
    cmd: string,
    args: string[],
    cwd?: string,
  ): Promise<string> {
    const process = new Deno.Command(cmd, {
      args,
      cwd: cwd || this.path,
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
  private parseWorktreeList(output: string): string[] {
    const worktrees: string[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        worktrees.push(line.substring("worktree ".length));
      }
    }

    return worktrees;
  }
}
