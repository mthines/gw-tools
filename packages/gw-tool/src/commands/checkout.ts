/**
 * Checkout command implementation
 * Creates a new worktree and optionally copies files
 */

import { promptAndRunAutoClean } from "../lib/auto-clean.ts";
import { loadConfig } from "../lib/config.ts";
import { copyFiles } from "../lib/file-ops.ts";
import { fetchAndGetStartPoint, listWorktrees } from "../lib/git-utils.ts";
import { executeHooks, type HookVariables } from "../lib/hooks.ts";
import { resolveWorktreePath } from "../lib/path-resolver.ts";
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
 * Check if a branch exists (locally or remotely)
 */
async function branchExists(branchName: string): Promise<boolean> {
  // Check local branch
  if (await branchExistsLocally(branchName)) return true;

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
 * Check if creating a branch would conflict with existing Git refs
 * Git doesn't allow both "refs/heads/foo" and "refs/heads/foo/bar"
 */
async function hasRefConflict(branchName: string): Promise<{ hasConflict: boolean; conflictingBranch?: string }> {
  // List all branches to check for conflicts
  const cmd = new Deno.Command("git", {
    args: ["for-each-ref", "--format=%(refname:short)", "refs/heads/"],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout } = await cmd.output();
  if (code !== 0) {
    return { hasConflict: false };
  }

  const output = new TextDecoder().decode(stdout);
  const branches = output.trim().split("\n").filter(b => b.length > 0);

  // Check if any existing branch would conflict with the new branch name
  for (const branch of branches) {
    // Conflict if existing branch is a "subdirectory" of our branch
    // e.g., creating "test" when "test/foo" exists
    if (branch.startsWith(branchName + "/")) {
      return { hasConflict: true, conflictingBranch: branch };
    }
    // Conflict if our branch is a "subdirectory" of an existing branch
    // e.g., creating "test/foo" when "test" exists
    if (branchName.startsWith(branch + "/")) {
      return { hasConflict: true, conflictingBranch: branch };
    }
  }

  return { hasConflict: false };
}

/**
 * Check if -b or -B flag is present in git args
 */
function hasBranchFlag(gitArgs: string[]): boolean {
  return gitArgs.includes("-b") || gitArgs.includes("-B");
}

/**
 * Show ref conflict error and exit
 */
function showRefConflictError(
  branchName: string,
  conflictingBranch: string | undefined,
  worktreeName: string,
  hasExplicitFlag: boolean,
): never {
  console.log("");
  output.error(
    `Cannot create branch ${output.bold(branchName)} because it conflicts with existing branch ${output.bold(conflictingBranch || "")}`,
  );
  console.log("");
  console.log(
    `Git doesn't allow both ${output.dim(`refs/heads/${branchName}`)} and ${output.dim(`refs/heads/${conflictingBranch}`)}`,
  );
  console.log("");
  console.log("Options:");

  const suggestion = hasExplicitFlag
    ? `gw checkout ${worktreeName} -b ${branchName}-new`
    : `gw checkout ${worktreeName}-new`;

  console.log(`  1. Use a different name: ${output.bold(suggestion)}`);
  console.log(
    `  2. Delete the conflicting branch: ${output.bold(`git branch -d ${conflictingBranch}`)}`,
  );
  console.log(
    `  3. Use the existing branch: ${output.bold(`gw checkout ${conflictingBranch}`)}`,
  );
  console.log("");
  Deno.exit(1);
}

/**
 * Parse checkout command arguments
 */
function parseCheckoutArgs(args: string[]): {
  help: boolean;
  worktreeName?: string;
  files: string[];
  gitArgs: string[];
  noNavigate: boolean;
} {
  const result = {
    help: false,
    worktreeName: undefined as string | undefined,
    files: [] as string[],
    gitArgs: [] as string[],
    noNavigate: false,
  };

  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    result.help = true;
    return result;
  }

  // Check for no-navigate flag
  if (args.includes("--no-cd")) {
    result.noNavigate = true;
    // Remove it from args so it doesn't interfere with other parsing
    args = args.filter(a => a !== "--no-cd");
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
 * Show help for the checkout command
 */
function showCheckoutHelp(): void {
  console.log(`Usage: gw checkout [options] <branch-name> [files...]

Create a new git worktree for a branch and optionally copy files.

If the branch is already checked out in another worktree, gw will navigate there instead.

If the branch doesn't exist, it will be automatically created from the
defaultBranch configured in .gw/config.json (defaults to "main"). The new
branch will be configured to track origin/<branch-name>, so git push works
without needing to specify -u origin <branch>.

If autoCopyFiles is configured in .gw/config.json, those files will be
automatically copied to the new worktree. You can override this by passing
specific files as arguments.

Arguments:
  <branch-name>           Branch name (also used as worktree directory name)
  [files...]              Optional files to copy (overrides config)

Options:
  --no-cd                 Don't navigate to the new worktree after creation

  All git worktree add options are supported:
    -b <branch>           Create a new branch (explicit, overrides auto-create)
    -B <branch>           Create or reset a branch
    --detach              Detach HEAD in new worktree
    --force, -f           Force checkout even if already checked out
    --track               Track branch from remote
    -h, --help            Show this help message

Examples:
  # Create worktree - auto-creates branch if it doesn't exist
  # (automatically navigates to new worktree)
  gw checkout feat/new-feature

  # Create worktree without navigating to it
  gw checkout feat/new-feature --no-cd

  # Create worktree with explicit branch from specific start point
  gw checkout feat/new-feature -b my-branch develop

  # Create worktree and copy specific files (overrides config)
  gw checkout feat/new-feature .env secrets/

Aliases:
  gw co                   Short alias for checkout
  gw add                  Backwards-compatible alias

Configuration:
  To enable auto-copy, use 'gw init' with --auto-copy-files:

  gw init --auto-copy-files .env,secrets/

Hooks:
  Pre-checkout and post-checkout hooks can be configured to run before and after
  worktree creation. Use 'gw init' to configure hooks:

  # Configure post-checkout hook to install dependencies
  gw init --post-checkout "cd {worktreePath} && pnpm install"

  # Configure pre-checkout hook for validation
  gw init --pre-checkout "echo 'Creating worktree: {worktree}'"

  Hook variables:
    {worktree}      - The worktree name
    {worktreePath}  - Full absolute path to the worktree
    {gitRoot}       - The git repository root path
    {branch}        - The branch name

  Pre-checkout hooks run before the worktree is created and abort on failure.
  Post-checkout hooks run in the new worktree directory after creation.
`);
}

/**
 * Execute the checkout command
 *
 * @param args Command-line arguments for the checkout command
 */
export async function executeCheckout(args: string[]): Promise<void> {
  const parsed = parseCheckoutArgs(args);

  // Show help if requested
  if (parsed.help) {
    showCheckoutHelp();
    Deno.exit(0);
  }

  // Validate arguments
  if (!parsed.worktreeName) {
    output.error("Branch name is required");
    showCheckoutHelp();
    Deno.exit(1);
  }

  // Load config
  const { config, gitRoot } = await loadConfig();

  // Resolve worktree path (preserves full path including slashes like feat/foo-bar)
  const worktreePath = resolveWorktreePath(gitRoot, parsed.worktreeName);

  // Determine the branch name (from -b/-B flag or worktree name)
  let branchName = parsed.worktreeName;
  for (let i = 0; i < parsed.gitArgs.length; i++) {
    if (
      (parsed.gitArgs[i] === "-b" || parsed.gitArgs[i] === "-B") &&
      i + 1 < parsed.gitArgs.length
    ) {
      branchName = parsed.gitArgs[i + 1];
      break;
    }
  }

  const worktrees = await listWorktrees();

  // Check 1: Is this branch already checked out in a worktree?
  if (await branchExistsLocally(branchName)) {
    const worktreeWithBranch = worktrees.find((wt) => wt.branch === branchName);
    if (worktreeWithBranch) {
      // Branch is already checked out - navigate there directly
      // (can't checkout the same branch in two worktrees)
      console.log("");
      output.info(
        `Branch ${output.bold(branchName)} is already checked out in:`,
      );
      console.log(`  ${output.path(worktreeWithBranch.path)}`);
      console.log("");
      console.log("Navigating there...");

      await signalNavigation(worktreeWithBranch.path);
      Deno.exit(0);
    }
  }

  // Check 2: Does this path already exist as a worktree?
  // Navigate automatically
  const worktreeAtPath = worktrees.find((wt) => wt.path === worktreePath);
  if (worktreeAtPath) {
    console.log("");
    output.info(`Worktree already exists at:`);
    console.log(`  ${output.path(worktreePath)}`);
    console.log("");
    console.log("Navigating there...");

    await signalNavigation(worktreePath);
    Deno.exit(0);
  }

  // Check 3: Path exists but is NOT a valid worktree (leftover directory)
  try {
    await Deno.stat(worktreePath);
    // Path exists but isn't a worktree - error out
    console.log("");
    output.error(
      `Path ${output.bold(worktreePath)} already exists but is not a valid worktree.`,
    );
    Deno.exit(1);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  // Prepare hook variables
  const hookVariables: HookVariables = {
    worktree: parsed.worktreeName,
    worktreePath,
    gitRoot,
    branch: branchName,
  };

  // Get hooks config (prefer checkout, fall back to add for backwards compat)
  const hooksConfig = config.hooks?.checkout ?? config.hooks?.add;

  // Execute pre-checkout hooks (abort on failure)
  if (hooksConfig?.pre && hooksConfig.pre.length > 0) {
    const { allSuccessful } = await executeHooks(
      hooksConfig.pre,
      gitRoot,
      hookVariables,
      "pre-checkout",
      true, // abort on failure
    );

    if (!allSuccessful) {
      output.error("Pre-checkout hook failed. Aborting worktree creation.");
      Deno.exit(1);
    }
  }

  // === Check if we're creating a new branch and handle ref conflicts ===
  const gitArgs = [...parsed.gitArgs];
  let startPoint: string | undefined;

  // Determine if we're creating a new branch
  const explicitCreate = hasBranchFlag(gitArgs);
  const branchExistsAlready = await branchExists(parsed.worktreeName);
  const willCreateBranch = explicitCreate || !branchExistsAlready;

  if (willCreateBranch) {
    // Check for ref conflicts (single check for both paths)
    const { hasConflict, conflictingBranch } = await hasRefConflict(branchName);
    if (hasConflict) {
      showRefConflictError(
        branchName,
        conflictingBranch,
        parsed.worktreeName,
        explicitCreate,
      );
    }

    // If auto-creating (no explicit -b flag), fetch and prepare
    if (!explicitCreate) {
      const defaultBranch = config.defaultBranch || "main";

      console.log(
        `Branch ${output.bold(parsed.worktreeName)} doesn't exist, fetching latest ${output.bold(defaultBranch)}...`,
      );

      try {
        const { startPoint: fetchedStartPoint, fetchSucceeded, message } =
          await fetchAndGetStartPoint(defaultBranch);

        startPoint = fetchedStartPoint;
        gitArgs.unshift("-b", parsed.worktreeName);

        if (fetchSucceeded) {
          if (message) {
            // There's a message even though fetch succeeded (e.g., using remote ref)
            console.log(output.dim(message));
          }
          console.log(
            `Creating from ${output.bold(startPoint)} (latest from remote)`,
          );
        } else {
          output.warning(message || "Could not fetch from remote");
          console.log(
            `Creating from ${output.bold(startPoint)} (local branch)`,
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        output.error(`Failed to prepare branch: ${errorMsg}`);
        Deno.exit(1);
      }
    }
  } else {
    // Branch exists - explicitly pass it to git to avoid git inferring from path basename
    // Without this, "gw checkout test/foo" would make git use basename "foo" as branch name
    startPoint = parsed.worktreeName;
  }

  // Build git worktree add command
  // Format: git worktree add [-b <new-branch>] <path> [<commit-ish>]
  const gitCmd = [
    "git",
    "worktree",
    "add",
    ...gitArgs,
    worktreePath,
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

  // Set up correct upstream tracking if we auto-created a new branch
  // When creating a branch from a remote-tracking branch (e.g., origin/main),
  // git automatically sets tracking to that branch. We need to change it to
  // track the new branch name instead (e.g., origin/feat/new-feature).
  if (startPoint) {
    const configRemoteCmd = new Deno.Command("git", {
      args: [
        "-C",
        worktreePath,
        "config",
        `branch.${branchName}.remote`,
        "origin",
      ],
      stdout: "null",
      stderr: "null",
    });

    const configMergeCmd = new Deno.Command("git", {
      args: [
        "-C",
        worktreePath,
        "config",
        `branch.${branchName}.merge`,
        `refs/heads/${branchName}`,
      ],
      stdout: "null",
      stderr: "null",
    });

    await configRemoteCmd.output();
    await configMergeCmd.output();
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
    let sourcePath = resolveWorktreePath(gitRoot, sourceWorktree);

    // If the resolved source path doesn't exist, use git root (main worktree is at repo root)
    try {
      await Deno.stat(sourcePath);
    } catch {
      sourcePath = gitRoot;
    }

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

  // Execute post-checkout hooks (warn but don't abort on failure)
  if (hooksConfig?.post && hooksConfig.post.length > 0) {
    const { allSuccessful } = await executeHooks(
      hooksConfig.post,
      worktreePath, // Run post-checkout hooks in the new worktree directory
      hookVariables,
      "post-checkout",
      false, // don't abort on failure, just warn
    );

    if (!allSuccessful) {
      output.warning("One or more post-checkout hooks failed");
    }
  }

  // Auto-cleanup stale worktrees if enabled (interactive prompt)
  await promptAndRunAutoClean();

  output.success(`Worktree ${output.bold(`"${parsed.worktreeName}"`)} created successfully`);

  // Navigate to new worktree unless --no-cd flag is set
  if (!parsed.noNavigate) {
    await signalNavigation(worktreePath);
  }
}
