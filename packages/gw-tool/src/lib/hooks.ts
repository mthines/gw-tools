/**
 * Hook execution utilities for running pre/post command hooks
 */

import * as output from "./output.ts";
import { emitProgress, type ProgressStage } from "./progress.ts";

/**
 * Variables available for substitution in hook commands
 */
export interface HookVariables {
  /** The worktree name (e.g., "feat/new-feature") */
  worktree: string;
  /** The full absolute path to the worktree */
  worktreePath: string;
  /** The git repository root path */
  gitRoot: string;
  /** The branch name */
  branch: string;
}

/**
 * Result of executing a hook
 */
export interface HookResult {
  /** Whether the hook executed successfully */
  success: boolean;
  /** The original command that was executed */
  command: string;
  /** Exit code from the hook command */
  exitCode: number;
}

/**
 * Substitute variables in a hook command string
 *
 * Supported variables:
 * - {worktree} - the worktree name
 * - {worktreePath} - the full absolute path to the worktree
 * - {gitRoot} - the git repository root path
 * - {branch} - the branch name
 *
 * @param command The command string with variable placeholders
 * @param variables The variables to substitute
 * @returns The command with variables substituted
 */
export function substituteVariables(
  command: string,
  variables: HookVariables,
): string {
  return command
    .replace(/\{worktree\}/g, variables.worktree)
    .replace(/\{worktreePath\}/g, variables.worktreePath)
    .replace(/\{gitRoot\}/g, variables.gitRoot)
    .replace(/\{branch\}/g, variables.branch);
}

/**
 * Execute a single hook command
 *
 * @param command The command to execute (will be run via shell)
 * @param cwd The working directory to run the command in
 * @param variables Variables for substitution
 * @returns The result of the hook execution
 */
export async function executeHook(
  command: string,
  cwd: string,
  variables: HookVariables,
): Promise<HookResult> {
  const expandedCommand = substituteVariables(command, variables);

  console.log(`  ${output.dim("$")} ${output.dim(expandedCommand)}`);

  // Determine shell based on platform
  const shell = Deno.build.os === "windows" ? "cmd" : "sh";
  const shellArgs = Deno.build.os === "windows"
    ? ["/c", expandedCommand]
    : ["-c", expandedCommand];

  const process = new Deno.Command(shell, {
    args: shellArgs,
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await process.output();

  return {
    success: code === 0,
    command: expandedCommand,
    exitCode: code,
  };
}

/**
 * Execute a list of hooks
 *
 * @param hooks Array of hook commands to execute
 * @param cwd The working directory to run hooks in
 * @param variables Variables for substitution
 * @param hookType Type of hook (for logging purposes, e.g., "pre-add", "post-add")
 * @param abortOnFailure Whether to stop executing remaining hooks if one fails
 * @param progressStage When provided, emits per-hook start/end/error NDJSON events
 *   to stderr for tooling consumers. Undefined = no progress events (backward-compatible).
 * @returns Array of hook results
 */
export async function executeHooks(
  hooks: string[],
  cwd: string,
  variables: HookVariables,
  hookType: string,
  abortOnFailure: boolean = true,
  progressStage?: Extract<
    ProgressStage,
    "pre-checkout-hooks" | "post-checkout-hooks"
  >,
): Promise<{ results: HookResult[]; allSuccessful: boolean }> {
  if (hooks.length === 0) {
    return { results: [], allSuccessful: true };
  }

  console.log(`\nRunning ${output.bold(hookType)} hooks...\n`);

  const results: HookResult[] = [];
  let allSuccessful = true;
  const total = hooks.length;

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];
    const hookIndex = i + 1;

    // Pre-expand the command so it can appear in the progress event before execution.
    // substituteVariables is defined in this same module.
    const expandedCommand = substituteVariables(hook, variables);

    const startMs = Date.now();

    if (progressStage) {
      emitProgress({
        stage: progressStage,
        status: "start",
        hook: hookIndex,
        of: total,
        command: expandedCommand,
      });
    }

    const result = await executeHook(hook, cwd, variables);
    const durationMs = Date.now() - startMs;
    results.push(result);

    if (!result.success) {
      allSuccessful = false;
      console.log(
        `  ${output.errorSymbol()} Hook failed with exit code ${result.exitCode}`,
      );

      if (progressStage) {
        emitProgress({
          stage: progressStage,
          status: "error",
          hook: hookIndex,
          of: total,
          message: `Hook failed with exit code ${result.exitCode}`,
          exitCode: result.exitCode,
        });
      }

      if (abortOnFailure) {
        break;
      }
    } else {
      console.log(`  ${output.checkmark()} Hook completed successfully`);

      if (progressStage) {
        emitProgress({
          stage: progressStage,
          status: "end",
          hook: hookIndex,
          of: total,
          durationMs,
        });
      }
    }
  }

  console.log();
  return { results, allSuccessful };
}
