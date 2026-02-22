/**
 * Type definitions for the gw CLI tool
 */

/**
 * Hook configuration for a command
 */
export interface CommandHooks {
  /** Commands to run before the main command executes */
  pre?: string[];
  /** Commands to run after the main command completes successfully */
  post?: string[];
}

/**
 * Hooks configuration for various gw commands
 */
export interface HooksConfig {
  /** Hooks for the checkout command */
  checkout?: CommandHooks;
}

/**
 * Per-repository configuration stored at .gw/config.json
 */
export interface Config {
  /** Config schema version for migrations (managed automatically) */
  configVersion?: number;
  /** Absolute path to the git repository root */
  root?: string;
  /** Default source worktree name (e.g., "main", "master") */
  defaultBranch?: string;
  /** Files to automatically copy when creating new worktrees */
  autoCopyFiles?: string[];
  /** Command hooks configuration */
  hooks?: HooksConfig;
  /** Minimum age in days for worktrees to be cleaned (optional, default: 7) */
  cleanThreshold?: number;
  /** Enable automatic cleanup of stale worktrees (optional, default: false) */
  autoClean?: boolean;
  /** Unix timestamp in milliseconds of last auto-cleanup run (managed automatically) */
  lastAutoCleanTime?: number;
  /** Default update strategy for the update command (optional, default: "merge") */
  updateStrategy?: 'merge' | 'rebase';
}

/**
 * Options for the copy command
 */
export interface CopyOptions {
  /** Source worktree name */
  from?: string;
  /** Target worktree name */
  target?: string;
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
  /** Whether version was requested */
  version: boolean;
}

/**
 * Options for the update command
 */
export interface UpdateOptions {
  /** Show help */
  help: boolean;
  /** Skip uncommitted changes check (dangerous) */
  force: boolean;
  /** Dry run mode - show what would happen without executing */
  dryRun: boolean;
  /** Branch to update from (overrides defaultBranch) */
  branch?: string;
  /** Remote name (default: "origin") */
  remote: string;
  /** Force merge strategy (overrides config) */
  merge?: boolean;
  /** Force rebase strategy (overrides config) */
  rebase?: boolean;
}

/**
 * Result of a git merge operation
 */
export interface MergeResult {
  /** Whether the merge succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message?: string;
  /** Whether there are merge conflicts */
  conflicted?: boolean;
  /** Number of files changed */
  filesChanged?: number;
  /** List of changed files with their stats */
  fileStats?: string[];
}

/**
 * Result of a git rebase operation
 */
export interface RebaseResult {
  /** Whether the rebase succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message?: string;
  /** Whether there are rebase conflicts */
  conflicted?: boolean;
  /** Number of files changed */
  filesChanged?: number;
  /** List of changed files with their stats */
  fileStats?: string[];
}
