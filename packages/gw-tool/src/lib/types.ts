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
 * Built-in resolver names. Maps to handlers in lib/pr-resolvers.ts.
 */
export type BuiltinResolverName = 'github';

/**
 * A single entry in the PR resolver chain for `gw pr`.
 *
 * Exactly one of `command` or `builtin` must be provided.
 *
 * Resolver contract:
 *   - stdin: the user-supplied identifier
 *   - $1:    same identifier (positional, never shell-interpolated)
 *   - cwd:   git root
 *   - env:   parent env, with .gw/.env values as defaults
 *
 * The resolver writes a JSON object to stdout on exit 0:
 *   { "prNumber": 42, "branch"?, "owner"?, "repo"?, "isCrossRepository"?, "remote"? }
 *
 * Exit non-zero, empty output, or unparseable JSON = "I do not handle this
 * identifier" — gw moves on to the next resolver.
 */
export interface PrResolver {
  /** Human-readable label shown in logs and errors. */
  name: string;
  /**
   * Shell command. Receives the identifier on stdin AND as $1. The command
   * string is passed to `sh -c`; input is passed as a separate argv element
   * so it is never parsed by the shell.
   */
  command?: string;
  /**
   * Built-in handler name. "github" calls `gh` directly and returns full PR
   * metadata, avoiding a second `gh pr view` round-trip.
   */
  builtin?: BuiltinResolverName;
  /**
   * Optional timeout in milliseconds (default 20000). When exceeded, the
   * resolver process is killed and the chain moves on to the next entry.
   */
  timeoutMs?: number;
}

/**
 * Structured result returned by a resolver.
 *
 * Only `prNumber` is required; the rest are best-effort metadata. If absent,
 * gw enriches via the github builtin (when `gh` is available) before fetching
 * the branch.
 */
export interface ResolvedPr {
  /** PR number, positive integer. */
  prNumber: number;
  /** Head ref / branch name. */
  branch?: string;
  /** Repository owner that hosts the PR head. */
  owner?: string;
  /** Repository name that hosts the PR head. */
  repo?: string;
  /** True when the PR comes from a fork. */
  isCrossRepository?: boolean;
  /** Git remote to fetch from. Defaults to "origin". */
  remote?: string;
}

/**
 * Per-repository configuration stored at .gw/config.json
 *
 * This file is safe to commit to your repository. Machine-specific
 * state (such as auto-cleanup timestamps) is managed internally and
 * never written to this file.
 */
export interface Config {
  /** JSON Schema reference for IDE autocompletion */
  $schema?: string;
  /** Config schema version for migrations (managed automatically) */
  configVersion?: number;
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
  /** Default update strategy for the update command (optional, default: "merge") */
  updateStrategy?: 'merge' | 'rebase';
  /**
   * Ordered list of resolvers tried by `gw pr`. When omitted, gw uses the
   * default `[{ name: 'gh', builtin: 'github' }]`. When set, fully replaces
   * the default — include the github builtin explicitly to keep PR-number
   * and github.com URL support.
   */
  prResolvers?: PrResolver[];
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
  /**
   * Progress output mode, parsed from --progress=<value>.
   * Currently only "json" is supported (emits NDJSON to stderr).
   * Undefined when the flag is absent.
   */
  progressMode?: string;
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
