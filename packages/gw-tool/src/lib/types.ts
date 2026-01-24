/**
 * Type definitions for the gw CLI tool
 */

/**
 * Per-repository configuration stored at .gw/config.json
 */
export interface Config {
  /** Absolute path to the git repository root */
  root?: string;
  /** Default source worktree name (e.g., "main", "master") */
  defaultSource?: string;
  /** Files to automatically copy when creating new worktrees */
  autoCopyFiles?: string[];
}

/**
 * Options for the copy command
 */
export interface CopyOptions {
  /** Source worktree name */
  from?: string;
  /** Target worktree name */
  target: string;
  /** List of file/directory paths to copy */
  files: string[];
  /** Show help */
  help?: boolean;
  /** Dry run mode - show what would be copied without actually copying */
  dryRun?: boolean;
}

/**
 * Result of a single copy operation
 */
export interface CopyResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** The path that was attempted to be copied */
  path: string;
}

/**
 * Global CLI arguments after initial parsing
 */
export interface GlobalArgs {
  /** Command name (e.g., "copy", "init", "list") */
  command?: string;
  /** Remaining arguments after command extraction */
  args: string[];
  /** Whether help was requested */
  help: boolean;
}
