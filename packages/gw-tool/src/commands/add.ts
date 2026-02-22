/**
 * Add command implementation
 * Creates a new worktree and optionally copies files
 */

import { promptAndRunAutoClean } from '../lib/auto-clean.ts';
import { loadConfig } from '../lib/config.ts';
import { copyFiles } from '../lib/file-ops.ts';
import { fetchAndGetStartPoint, listWorktrees } from '../lib/git-utils.ts';
import { executeHooks, type HookVariables } from '../lib/hooks.ts';
import { resolveWorktreePath } from '../lib/path-resolver.ts';
import { signalNavigation } from '../lib/shell-navigation.ts';
import * as output from '../lib/output.ts';

/**
 * Check if a branch exists locally
 */
async function localBranchExists(branchName: string): Promise<boolean> {
  const localCheck = new Deno.Command('git', {
    args: ['rev-parse', '--verify', `refs/heads/${branchName}`],
    stdout: 'null',
    stderr: 'null',
  });
  const localResult = await localCheck.output();
  return localResult.code === 0;
}

/**
 * Check if a branch exists on remote
 */
async function remoteBranchExists(branchName: string, remoteName = 'origin'): Promise<boolean> {
  const remoteCheck = new Deno.Command('git', {
    args: ['rev-parse', '--verify', `refs/remotes/${remoteName}/${branchName}`],
    stdout: 'null',
    stderr: 'null',
  });
  const remoteResult = await remoteCheck.output();
  return remoteResult.code === 0;
}

/**
 * Check if a branch exists (locally or remotely)
 */
async function branchExists(branchName: string): Promise<boolean> {
  if (await localBranchExists(branchName)) return true;
  return await remoteBranchExists(branchName);
}

/**
 * Check if creating a branch would conflict with existing Git refs
 * Git doesn't allow both "refs/heads/foo" and "refs/heads/foo/bar"
 */
async function hasRefConflict(branchName: string): Promise<{ hasConflict: boolean; conflictingBranch?: string }> {
  // List all branches to check for conflicts
  const cmd = new Deno.Command('git', {
    args: ['for-each-ref', '--format=%(refname:short)', 'refs/heads/'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout } = await cmd.output();
  if (code !== 0) {
    return { hasConflict: false };
  }

  const output = new TextDecoder().decode(stdout);
  const branches = output
    .trim()
    .split('\n')
    .filter((b) => b.length > 0);

  // Check if any existing branch would conflict with the new branch name
  for (const branch of branches) {
    // Conflict if existing branch is a "subdirectory" of our branch
    // e.g., creating "test" when "test/foo" exists
    if (branch.startsWith(branchName + '/')) {
      return { hasConflict: true, conflictingBranch: branch };
    }
    // Conflict if our branch is a "subdirectory" of an existing branch
    // e.g., creating "test/foo" when "test" exists
    if (branchName.startsWith(branch + '/')) {
      return { hasConflict: true, conflictingBranch: branch };
    }
  }

  return { hasConflict: false };
}

/**
 * Check if -b or -B flag is present in git args
 */
function hasBranchFlag(gitArgs: string[]): boolean {
  return gitArgs.includes('-b') || gitArgs.includes('-B');
}

/**
 * Parse add command arguments
 */
function parseAddArgs(args: string[]): {
  help: boolean;
  worktreeName?: string;
  files: string[];
  gitArgs: string[];
  noNavigate: boolean;
  fromBranch?: string;
} {
  const result = {
    help: false,
    worktreeName: undefined as string | undefined,
    files: [] as string[],
    gitArgs: [] as string[],
    noNavigate: false,
    fromBranch: undefined as string | undefined,
  };

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    result.help = true;
    return result;
  }

  // Check for no-navigate flag
  if (args.includes('--no-cd')) {
    result.noNavigate = true;
    // Remove it from args so it doesn't interfere with other parsing
    args = args.filter((a) => a !== '--no-cd');
  }

  // First positional arg is the worktree name (required)
  // All other args are either git flags or files to copy
  // Git flags start with - or --, files don't

  let foundWorktreeName = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --from flag
    if (arg === '--from') {
      if (i + 1 < args.length) {
        result.fromBranch = args[++i];
      }
      continue;
    }

    if (arg.startsWith('--from=')) {
      result.fromBranch = arg.substring('--from='.length);
      continue;
    }

    // Git worktree flags that take a value
    if (arg === '-b' || arg === '-B' || arg === '--track') {
      result.gitArgs.push(arg);
      if (i + 1 < args.length) {
        result.gitArgs.push(args[++i]);
      }
      continue;
    }

    // Git worktree boolean flags
    if (
      arg.startsWith('-') &&
      (arg === '--detach' ||
        arg === '--force' ||
        arg === '-f' ||
        arg === '--quiet' ||
        arg === '-q' ||
        arg === '--guess-remote')
    ) {
      result.gitArgs.push(arg);
      continue;
    }

    // If we haven't found the worktree name yet and it doesn't start with -, it's the worktree name
    if (!foundWorktreeName && !arg.startsWith('-')) {
      result.worktreeName = arg;
      foundWorktreeName = true;
      continue;
    }

    // After worktree name, non-flag args are files to copy
    if (foundWorktreeName && !arg.startsWith('-')) {
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
defaultBranch configured in .gw/config.json (defaults to "main"). The new
branch will be configured to track origin/<branch-name>, so git push works
without needing to specify -u origin <branch>.

If autoCopyFiles is configured in .gw/config.json, those files will be
automatically copied to the new worktree. You can override this by passing
specific files as arguments.

Arguments:
  <worktree-name>         Name or path for the new worktree
  [files...]              Optional files to copy (overrides config)

Options:
  --no-cd                 Don't navigate to the new worktree after creation
  --from <branch>         Create new branch from specified branch instead of defaultBranch

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
  gw add feat/new-feature

  # Create worktree without navigating to it
  gw add feat/new-feature --no-cd

  # Create worktree from a different branch
  gw add feat/new-feature --from develop

  # Create child feature from parent feature
  gw add feat/child-feature --from feat/parent-feature

  # Create worktree with explicit branch from specific start point
  gw add feat/new-feature -b my-branch develop

  # Create worktree and copy specific files (overrides config)
  gw add feat/new-feature .env secrets/

Configuration:
  To enable auto-copy, use 'gw init' with --auto-copy-files:

  gw init --auto-copy-files .env,secrets/

Network Behavior:
  gw add fetches from remote to ensure your worktree uses fresh code.

  For new branches (without --from flag):
    - Fetches defaultBranch from remote (e.g., origin/main)
    - Falls back to local branch if fetch fails (offline support)

  For new branches (with --from flag):
    - Requires successful fetch from remote (ensures fresh code)
    - Exits with error if fetch fails (network issues, auth problems)

  For local branches:
    - Uses the existing local branch directly

  For remote-only branches:
    - Fetches the branch and creates a local tracking branch
    - Falls back to cached remote ref if fetch fails

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
    output.error('Worktree name is required');
    showAddHelp();
    Deno.exit(1);
  }

  // Load config
  const { config, gitRoot } = await loadConfig();

  // Resolve worktree path (preserves full path including slashes like feat/foo-bar)
  const worktreePath = resolveWorktreePath(gitRoot, parsed.worktreeName);

  // Determine the branch name (from -b/-B flag or worktree name)
  let branchName = parsed.worktreeName;
  for (let i = 0; i < parsed.gitArgs.length; i++) {
    if ((parsed.gitArgs[i] === '-b' || parsed.gitArgs[i] === '-B') && i + 1 < parsed.gitArgs.length) {
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
      'pre-add',
      true // abort on failure
    );

    if (!allSuccessful) {
      output.error('Pre-add hook failed. Aborting worktree creation.');
      Deno.exit(1);
    }
  }

  // Check for leftover directory that isn't a valid worktree
  try {
    const stat = await Deno.stat(worktreePath);
    if (stat.isDirectory || stat.isFile) {
      // Path exists - check if it's a valid worktree
      const worktrees = await listWorktrees();
      const isValidWorktree = worktrees.some((wt) => wt.path === worktreePath);

      if (isValidWorktree) {
        // Worktree already exists - prompt user to navigate to it
        console.log('');
        output.info(`Worktree ${output.bold(parsed.worktreeName)} already exists at:`);
        console.log(`  ${output.path(worktreePath)}`);
        console.log('');

        const response = prompt(`Navigate to it? [Y/n]:`);

        if (
          response === null ||
          response === '' ||
          response.toLowerCase() === 'y' ||
          response.toLowerCase() === 'yes'
        ) {
          // Signal navigation to shell integration via temp file
          // This avoids buffering output
          await signalNavigation(worktreePath);
          Deno.exit(0);
        } else {
          console.log('');
          output.info('Worktree creation cancelled.');
          Deno.exit(0);
        }
      } else {
        // Path exists but isn't a valid worktree - automatically clean up
        console.log('');
        output.warning(`Path ${output.bold(worktreePath)} already exists but is not a valid worktree.`);
        console.log(`This can happen if a previous worktree creation was interrupted.`);
        console.log(`Automatically removing and continuing...`);

        await Deno.remove(worktreePath, { recursive: true });
        output.success('Removed successfully.');
        console.log('');
      }
    }
  } catch (error) {
    // Path doesn't exist - this is fine, we'll create it
    if (!(error instanceof Deno.errors.NotFound)) {
      // Some other error occurred
      throw error;
    }
  }

  // Check if branch exists and auto-create if needed
  const gitArgs = [...parsed.gitArgs];
  let startPoint: string | undefined;
  let isNewBranch = false; // Track if we're creating a truly new branch (not local, not remote-only)
  let needsTrackingSetup = false; // Track if we need to set up tracking (new branches AND remote-only branches)

  // If user specified -b or -B, check for ref conflicts since they're creating a new branch
  if (hasBranchFlag(gitArgs)) {
    const { hasConflict, conflictingBranch } = await hasRefConflict(branchName);
    if (hasConflict) {
      console.log('');
      output.error(
        `Cannot create branch ${output.bold(branchName)} because it conflicts with existing branch ${output.bold(conflictingBranch || '')}`
      );
      console.log('');
      console.log(
        `Git doesn't allow both ${output.dim(`refs/heads/${branchName}`)} and ${output.dim(`refs/heads/${conflictingBranch}`)}`
      );
      console.log('');
      console.log('Options:');
      console.log(`  1. Use a different name: ${output.bold(`gw add ${parsed.worktreeName} -b ${branchName}-new`)}`);
      console.log(`  2. Delete the conflicting branch: ${output.bold(`git branch -d ${conflictingBranch}`)}`);
      console.log(`  3. Use the existing branch: ${output.bold(`gw add ${conflictingBranch}`)}`);
      console.log('');
      Deno.exit(1);
    }
  } else {
    // No -b flag, check if branch exists
    const exists = await branchExists(parsed.worktreeName);
    if (!exists) {
      // Branch doesn't exist, we'll auto-create it - check for ref conflicts
      const { hasConflict, conflictingBranch } = await hasRefConflict(parsed.worktreeName);
      if (hasConflict) {
        console.log('');
        output.error(
          `Cannot create branch ${output.bold(parsed.worktreeName)} because it conflicts with existing branch ${output.bold(conflictingBranch || '')}`
        );
        console.log('');
        console.log(
          `Git doesn't allow both ${output.dim(`refs/heads/${parsed.worktreeName}`)} and ${output.dim(`refs/heads/${conflictingBranch}`)}`
        );
        console.log('');
        console.log('Options:');
        console.log(`  1. Use a different name: ${output.bold(`gw add ${parsed.worktreeName}-new`)}`);
        console.log(`  2. Delete the conflicting branch: ${output.bold(`git branch -d ${conflictingBranch}`)}`);
        console.log(`  3. Use the existing branch: ${output.bold(`gw add ${conflictingBranch}`)}`);
        console.log('');
        Deno.exit(1);
      }

      // Auto-create branch from --from or defaultBranch
      const sourceBranch = parsed.fromBranch || config.defaultBranch || 'main';

      // Validate source branch exists if --from was specified
      if (parsed.fromBranch) {
        const sourceBranchExists = await branchExists(sourceBranch);
        if (!sourceBranchExists) {
          console.log('');
          output.error(`Source branch ${output.bold(sourceBranch)} does not exist locally or remotely`);
          console.log('');
          console.log('Options:');
          console.log(
            `  1. Use a different source: ${output.bold(`gw add ${parsed.worktreeName} --from <existing-branch>`)}`
          );
          console.log(`  2. Use default branch: ${output.bold(`gw add ${parsed.worktreeName}`)}`);
          console.log('');
          Deno.exit(1);
        }
      }

      console.log(
        `Branch ${output.bold(parsed.worktreeName)} doesn't exist, creating from ${output.bold(sourceBranch)}...`
      );
      console.log(output.dim('Fetching latest from remote to ensure fresh start point...'));

      // Mark as new branch - we need to set up tracking for this
      isNewBranch = true;
      needsTrackingSetup = true;

      try {
        const { startPoint: fetchedStartPoint, fetchSucceeded, message } = await fetchAndGetStartPoint(sourceBranch);

        startPoint = fetchedStartPoint;
        gitArgs.unshift('-b', parsed.worktreeName);

        if (fetchSucceeded) {
          console.log(output.dim('✓ Fetched successfully from remote'));
          if (message) {
            // There's a message even though fetch succeeded (e.g., using remote ref)
            console.log(output.dim(message));
          }
          console.log(`Creating from ${output.bold(startPoint)} (latest from remote)`);
          console.log('');
        } else {
          // Check if failure is due to no remote (acceptable) or fetch failure (problematic)
          const noRemoteConfigured = message && message.includes('No remote');

          // When --from is explicitly specified and remote exists but fetch failed
          if (parsed.fromBranch && !noRemoteConfigured) {
            console.log('');
            output.error(message || 'Could not fetch from remote');
            console.log('');
            console.log(`Cannot create branch from ${output.bold(sourceBranch)} because the remote fetch failed.`);
            console.log('This would use a potentially outdated local branch.');
            console.log('');
            console.log('Possible causes:');
            console.log('  • Network connectivity issues');
            console.log(`  • Branch ${output.bold(sourceBranch)} doesn't exist on remote`);
            console.log('  • Authentication issues');
            console.log('');
            console.log('Options:');
            console.log(`  1. Check your network connection and try again`);
            console.log(`  2. Verify the branch exists: ${output.bold(`git ls-remote origin ${sourceBranch}`)}`);
            console.log(
              `  3. Use a different source branch: ${output.bold(`gw add ${parsed.worktreeName} --from <branch>`)}`
            );
            console.log(
              `  4. Create without --from to use default branch: ${output.bold(`gw add ${parsed.worktreeName}`)}`
            );
            console.log('');
            Deno.exit(1);
          }

          // For default branch (no --from specified) or no remote configured, warn but allow local fallback
          console.log('');
          output.warning(message || 'Could not fetch from remote');
          console.log('');
          console.log(output.dim('Falling back to local branch. The start point may not be up-to-date with remote.'));
          console.log(output.dim('This is acceptable for offline development or when remote is unavailable.'));
          console.log('');
          console.log(`Creating from ${output.bold(startPoint)} (local branch)`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        output.error(`Failed to prepare branch: ${errorMsg}`);
        Deno.exit(1);
      }
    } else {
      // Branch exists somewhere - check if it's local or remote-only
      const isLocal = await localBranchExists(parsed.worktreeName);

      if (isLocal) {
        // Local branch exists - just use it directly
        // Git worktree add will checkout the existing local branch
        startPoint = parsed.worktreeName;
        console.log(`Using existing local branch ${output.bold(parsed.worktreeName)}`);
        console.log('');
      } else {
        // Branch exists only on remote - fetch and create local tracking branch
        console.log(`Branch ${output.bold(parsed.worktreeName)} exists on remote, fetching...`);

        try {
          const {
            startPoint: fetchedStartPoint,
            fetchSucceeded,
            message,
          } = await fetchAndGetStartPoint(parsed.worktreeName);

          if (fetchSucceeded) {
            // Create local branch from remote with -b flag
            startPoint = fetchedStartPoint;
            gitArgs.unshift('-b', parsed.worktreeName);
            needsTrackingSetup = true; // Need to set up tracking for remote-only branches
            console.log(output.dim('✓ Fetched successfully from remote'));
            if (message) {
              console.log(output.dim(message));
            }
            console.log(`Creating local branch from ${output.bold(startPoint)}`);
            console.log('');
          } else {
            // Fetch failed but we know the remote branch exists
            // Try using origin/branch directly with -b flag
            startPoint = `origin/${parsed.worktreeName}`;
            gitArgs.unshift('-b', parsed.worktreeName);
            needsTrackingSetup = true; // Need to set up tracking for remote-only branches
            console.log('');
            output.warning(message || 'Could not fetch from remote');
            console.log(output.dim(`Using cached remote ref ${startPoint}. It may not be up-to-date.`));
            console.log('');
          }
        } catch {
          // Error during fetch - try using cached remote ref
          startPoint = `origin/${parsed.worktreeName}`;
          gitArgs.unshift('-b', parsed.worktreeName);
          needsTrackingSetup = true; // Need to set up tracking for remote-only branches
          output.warning('Could not fetch from remote, using cached remote ref');
          console.log('');
        }
      }
    }
  }

  // Build git worktree add command
  // Format: git worktree add [-b <new-branch>] <path> [<commit-ish>]
  const gitCmd = ['git', 'worktree', 'add', ...gitArgs, worktreePath, ...(startPoint ? [startPoint] : [])];

  // Execute git worktree add
  console.log(`Creating worktree: ${output.bold(parsed.worktreeName)}\n`);

  const gitProcess = new Deno.Command(gitCmd[0], {
    args: gitCmd.slice(1),
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await gitProcess.output();

  if (code !== 0) {
    output.error('Failed to create worktree');
    Deno.exit(code);
  }

  // Set up correct upstream tracking for new branches AND remote-only branches
  // - For local branches: keep existing tracking (don't overwrite)
  // - For remote-only branches: explicitly set tracking (git doesn't always do it reliably)
  // - For new branches: set tracking to origin/<new-branch-name> so push works without -u
  if (needsTrackingSetup && startPoint) {
    const configRemoteCmd = new Deno.Command('git', {
      args: ['-C', worktreePath, 'config', `branch.${branchName}.remote`, 'origin'],
      stdout: 'null',
      stderr: 'null',
    });

    const configMergeCmd = new Deno.Command('git', {
      args: ['-C', worktreePath, 'config', `branch.${branchName}.merge`, `refs/heads/${branchName}`],
      stdout: 'null',
      stderr: 'null',
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

    const sourceWorktree = config.defaultBranch || 'main';
    let sourcePath = resolveWorktreePath(gitRoot, sourceWorktree);

    // If the resolved source path doesn't exist, use git root (main worktree is at repo root)
    try {
      await Deno.stat(sourcePath);
    } catch {
      sourcePath = gitRoot;
    }

    try {
      const results = await copyFiles(sourcePath, worktreePath, filesToCopy, false);

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
      const fileWord = successCount === 1 ? 'file' : 'files';
      console.log();
      console.log(`  Copied ${output.bold(`${successCount}/${results.length}`)} ${fileWord}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.warning(`Failed to copy files - ${message}`);
      console.log('Worktree was created successfully, but file copying failed.\n');
    }
  }

  // Execute post-add hooks (warn but don't abort on failure)
  if (config.hooks?.add?.post && config.hooks.add.post.length > 0) {
    const { allSuccessful } = await executeHooks(
      config.hooks.add.post,
      worktreePath, // Run post-add hooks in the new worktree directory
      hookVariables,
      'post-add',
      false // don't abort on failure, just warn
    );

    if (!allSuccessful) {
      output.warning('One or more post-add hooks failed');
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
