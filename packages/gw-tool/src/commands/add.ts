/**
 * Add command implementation
 * Creates a new worktree and optionally copies files
 */

import { basename } from "$std/path";
import { loadConfig } from "../lib/config.ts";
import { copyFiles } from "../lib/file-ops.ts";
import { executeHooks, type HookVariables } from "../lib/hooks.ts";
import { resolveWorktreePath } from "../lib/path-resolver.ts";
import * as output from "../lib/output.ts";

/**
 * Check if a branch exists (locally or remotely)
 */
async function branchExists(branchName: string): Promise<boolean> {
  // Check local branch
  const localCheck = new Deno.Command("git", {
    args: ["rev-parse", "--verify", branchName],
    stdout: "null",
    stderr: "null",
  });
  const localResult = await localCheck.output();
  if (localResult.code === 0) return true;

  // Check remote branch
  const remoteCheck = new Deno.Command("git", {
    args: ["rev-parse", "--verify", `origin/${branchName}`],
    stdout: "null",
    stderr: "null",
  });
  const remoteResult = await remoteCheck.output();
  return remoteResult.code === 0;
}

/**
 * Check if -b or -B flag is present in git args
 */
function hasBranchFlag(gitArgs: string[]): boolean {
  return gitArgs.includes("-b") || gitArgs.includes("-B");
}

/**
 * Parse add command arguments
 */
function parseAddArgs(args: string[]): {
  help: boolean;
  worktreeName?: string;
  files: string[];
  gitArgs: string[];
} {
  const result = {
    help: false,
    worktreeName: undefined as string | undefined,
    files: [] as string[],
    gitArgs: [] as string[],
  };

  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    result.help = true;
    return result;
  }

  // First positional arg is the worktree name (required)
  // All other args are either git flags or files to copy
  // Git flags start with - or --, files don't

  let foundWorktreeName = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Git worktree flags that take a value
    if (arg === "-b" || arg === "-B" || arg === "--track") {
      result.gitArgs.push(arg);
      if (i + 1 < args.length) {
        result.gitArgs.push(args[++i]);
      }
      continue;
    }

    // Git worktree boolean flags
    if (
      arg.startsWith("-") &&
      (arg === "--detach" || arg === "--force" || arg === "-f" ||
        arg === "--quiet" || arg === "-q" || arg === "--guess-remote")
    ) {
      result.gitArgs.push(arg);
      continue;
    }

    // If we haven't found the worktree name yet and it doesn't start with -, it's the worktree name
    if (!foundWorktreeName && !arg.startsWith("-")) {
      result.worktreeName = arg;
      foundWorktreeName = true;
      continue;
    }

    // After worktree name, non-flag args are files to copy
    if (foundWorktreeName && !arg.startsWith("-")) {
      result.files.push(arg);
    }
  }

  return result;
}

/**
 * Show help for the add command
 */
function showAddHelp(): void {
  console.log(`Usage: gw add [options] <worktree-name> [files...]

Create a new git worktree and optionally copy files.

If the branch doesn't exist, it will be automatically created from the
defaultBranch configured in .gw/config.json (defaults to "main").

If autoCopyFiles is configured in .gw/config.json, those files will be
automatically copied to the new worktree. You can override this by passing
specific files as arguments.

Arguments:
  <worktree-name>         Name or path for the new worktree
  [files...]              Optional files to copy (overrides config)

Options:
  All git worktree add options are supported:
    -b <branch>           Create a new branch (explicit, overrides auto-create)
    -B <branch>           Create or reset a branch
    --detach              Detach HEAD in new worktree
    --force, -f           Force checkout even if already checked out
    --track               Track branch from remote
    -h, --help            Show this help message

Examples:
  # Create worktree - auto-creates branch if it doesn't exist
  gw add feat/new-feature

  # Create worktree with explicit branch from specific start point
  gw add feat/new-feature -b my-branch develop

  # Create worktree and copy specific files (overrides config)
  gw add feat/new-feature .env secrets/

Configuration:
  To enable auto-copy, use 'gw init' with --auto-copy-files:

  gw init --auto-copy-files .env,secrets/

Hooks:
  Pre-add and post-add hooks can be configured to run before and after
  worktree creation. Use 'gw init' to configure hooks:

  # Configure post-add hook to install dependencies
  gw init --post-add "cd {worktreePath} && pnpm install"

  # Configure pre-add hook for validation
  gw init --pre-add "echo 'Creating worktree: {worktree}'"

  Hook variables:
    {worktree}      - The worktree name
    {worktreePath}  - Full absolute path to the worktree
    {gitRoot}       - The git repository root path
    {branch}        - The branch name

  Pre-add hooks run before the worktree is created and abort on failure.
  Post-add hooks run in the new worktree directory after creation.
`);
}

/**
 * Execute the add command
 *
 * @param args Command-line arguments for the add command
 */
export async function executeAdd(args: string[]): Promise<void> {
  const parsed = parseAddArgs(args);

  // Show help if requested
  if (parsed.help) {
    showAddHelp();
    Deno.exit(0);
  }

  // Validate arguments
  if (!parsed.worktreeName) {
    output.error("Worktree name is required");
    showAddHelp();
    Deno.exit(1);
  }

  // Load config
  const { config, gitRoot } = await loadConfig();

  // Extract just the worktree name (last component of path)
  const worktreeNameOnly = basename(parsed.worktreeName);
  const worktreePath = resolveWorktreePath(gitRoot, worktreeNameOnly);

  // Determine the branch name (from -b/-B flag or worktree name)
  let branchName = worktreeNameOnly;
  for (let i = 0; i < parsed.gitArgs.length; i++) {
    if (
      (parsed.gitArgs[i] === "-b" || parsed.gitArgs[i] === "-B") &&
      i + 1 < parsed.gitArgs.length
    ) {
      branchName = parsed.gitArgs[i + 1];
      break;
    }
  }

  // Prepare hook variables
  const hookVariables: HookVariables = {
    worktree: parsed.worktreeName,
    worktreePath,
    gitRoot,
    branch: branchName,
  };

  // Execute pre-add hooks (abort on failure)
  if (config.hooks?.add?.pre && config.hooks.add.pre.length > 0) {
    const { allSuccessful } = await executeHooks(
      config.hooks.add.pre,
      gitRoot,
      hookVariables,
      "pre-add",
      true, // abort on failure
    );

    if (!allSuccessful) {
      output.error("Pre-add hook failed. Aborting worktree creation.");
      Deno.exit(1);
    }
  }

  // Check if branch exists and auto-create if needed
  const gitArgs = [...parsed.gitArgs];
  let startPoint: string | undefined;
  if (!hasBranchFlag(gitArgs)) {
    const exists = await branchExists(parsed.worktreeName);
    if (!exists) {
      // Auto-create branch from defaultBranch
      startPoint = config.defaultBranch || "main";
      gitArgs.unshift("-b", parsed.worktreeName);
      console.log(
        `Branch ${output.bold(parsed.worktreeName)} doesn't exist, creating from ${output.bold(startPoint)}`,
      );
    }
  }

  // Build git worktree add command
  // Format: git worktree add [-b <new-branch>] <path> [<commit-ish>]
  const gitCmd = [
    "git",
    "worktree",
    "add",
    ...gitArgs,
    parsed.worktreeName,
    ...(startPoint ? [startPoint] : []),
  ];

  // Execute git worktree add
  console.log(`Creating worktree: ${output.bold(parsed.worktreeName)}\n`);

  const gitProcess = new Deno.Command(gitCmd[0], {
    args: gitCmd.slice(1),
    stdout: "inherit",
    stderr: "inherit",
  });

  const { code } = await gitProcess.output();

  if (code !== 0) {
    output.error("Failed to create worktree");
    Deno.exit(code);
  }

  // Determine which files to copy
  let filesToCopy: string[] = [];

  if (parsed.files.length > 0) {
    // Files explicitly passed as arguments - use those
    filesToCopy = parsed.files;
  } else if (config.autoCopyFiles && config.autoCopyFiles.length > 0) {
    // No files passed, but autoCopyFiles is configured - use those
    filesToCopy = config.autoCopyFiles;
  }

  // Copy files if any
  if (filesToCopy.length > 0) {
    console.log(`Copying files to new worktree...`);

    const sourceWorktree = config.defaultBranch || "main";
    const sourcePath = resolveWorktreePath(gitRoot, sourceWorktree);

    try {
      const results = await copyFiles(
        sourcePath,
        worktreePath,
        filesToCopy,
        false,
      );

      // Display results
      console.log();
      for (const result of results) {
        if (result.success) {
          console.log(`  ${output.checkmark()} ${result.message}`);
        } else {
          console.log(`  ${output.warningSymbol()} ${result.message}`);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const fileWord = successCount === 1 ? "file" : "files";
      console.log();
      console.log(
        `  Copied ${
          output.bold(`${successCount}/${results.length}`)
        } ${fileWord}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.warning(`Failed to copy files - ${message}`);
      console.log(
        "Worktree was created successfully, but file copying failed.\n",
      );
    }
  }

  // Execute post-add hooks (warn but don't abort on failure)
  if (config.hooks?.add?.post && config.hooks.add.post.length > 0) {
    const { allSuccessful } = await executeHooks(
      config.hooks.add.post,
      worktreePath, // Run post-add hooks in the new worktree directory
      hookVariables,
      "post-add",
      false, // don't abort on failure, just warn
    );

    if (!allSuccessful) {
      output.warning("One or more post-add hooks failed");
    }
  }

  output.success("Worktree created successfully");
}
