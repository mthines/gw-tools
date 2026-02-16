/**
 * PR command implementation
 * Fetches a pull request's branch and creates a worktree for it
 */

import { promptAndRunAutoClean } from '../lib/auto-clean.ts';
import { loadConfig } from '../lib/config.ts';
import { copyFiles } from '../lib/file-ops.ts';
import { listWorktrees } from '../lib/git-utils.ts';
import { executeHooks, type HookVariables } from '../lib/hooks.ts';
import { resolveWorktreePath } from '../lib/path-resolver.ts';
import { signalNavigation } from '../lib/shell-navigation.ts';
import * as output from '../lib/output.ts';

/**
 * Information about a pull request from gh CLI
 */
interface PrInfo {
  number: number;
  headRefName: string;
  headRepository: { name: string };
  headRepositoryOwner: { login: string };
  isCrossRepository: boolean;
}

/**
 * Parse a PR identifier (number or URL) to extract PR number
 * @param identifier PR number or GitHub URL
 * @returns Object with PR number and optional owner/repo for URL validation
 */
function parsePrIdentifier(identifier: string): { prNumber: number; owner?: string; repo?: string } | null {
  // Try parsing as a number first
  const asNumber = parseInt(identifier, 10);
  if (!isNaN(asNumber) && asNumber > 0) {
    return { prNumber: asNumber };
  }

  // Try parsing as GitHub URL
  // Patterns:
  // - https://github.com/owner/repo/pull/123
  // - github.com/owner/repo/pull/123
  const urlPattern = /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
  const match = identifier.match(urlPattern);

  if (match) {
    const [, owner, repo, prNumberStr] = match;
    const prNumber = parseInt(prNumberStr, 10);
    if (!isNaN(prNumber) && prNumber > 0) {
      return { prNumber, owner, repo };
    }
  }

  return null;
}

/**
 * Parse PR command arguments
 */
function parsePrArgs(args: string[]): {
  help: boolean;
  prIdentifier?: string;
  name?: string;
  noNavigate: boolean;
} {
  const result = {
    help: false,
    prIdentifier: undefined as string | undefined,
    name: undefined as string | undefined,
    noNavigate: false,
  };

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    result.help = true;
    return result;
  }

  // Check for no-navigate flag
  if (args.includes('--no-cd')) {
    result.noNavigate = true;
    args = args.filter((a) => a !== '--no-cd');
  }

  // Parse remaining arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --name flag
    if (arg === '--name') {
      if (i + 1 < args.length) {
        result.name = args[++i];
      }
      continue;
    }

    if (arg.startsWith('--name=')) {
      result.name = arg.substring('--name='.length);
      continue;
    }

    // Skip other flags
    if (arg.startsWith('-')) {
      continue;
    }

    // First positional arg is the PR identifier
    if (!result.prIdentifier) {
      result.prIdentifier = arg;
    }
  }

  return result;
}

/**
 * Show help for the pr command
 */
function showPrHelp(): void {
  console.log(`Usage: gw pr [options] <pr-number|pr-url>

Check out a pull request into a new worktree.

This command fetches a PR's branch and creates a worktree for it in one step,
making it easy to review, test, or contribute to pull requests.

Arguments:
  <pr-number|pr-url>    PR number (e.g., 42) or GitHub PR URL

Options:
  --name <name>         Custom name for the worktree directory
  --no-cd               Don't navigate to the new worktree after creation
  -h, --help            Show this help message

Examples:
  # Check out PR #42
  gw pr 42

  # Check out PR by URL
  gw pr https://github.com/user/repo/pull/42

  # Use custom worktree name
  gw pr 42 --name review-feature

Requirements:
  - GitHub CLI (gh) must be installed and authenticated
  - Install: https://cli.github.com/

How It Works:
  1. Resolves PR number/URL to branch information via gh CLI
  2. Fetches the PR branch (handles forks automatically)
  3. Creates worktree with auto-copy files and hooks (same as gw add)
  4. Navigates to the new worktree

If the PR's branch is already checked out in a worktree, the command
will offer to navigate to that worktree instead.
`);
}

/**
 * Check if gh CLI is installed
 */
async function isGhInstalled(): Promise<boolean> {
  try {
    const cmd = new Deno.Command('gh', {
      args: ['--version'],
      stdout: 'null',
      stderr: 'null',
    });
    const { code } = await cmd.output();
    return code === 0;
  } catch {
    return false;
  }
}

/**
 * Get the current repository's owner/name from gh CLI
 */
async function getCurrentRepo(): Promise<{ owner: string; repo: string } | null> {
  try {
    const cmd = new Deno.Command('gh', {
      args: ['repo', 'view', '--json', 'nameWithOwner'],
      stdout: 'piped',
      stderr: 'null',
    });
    const { code, stdout } = await cmd.output();
    if (code !== 0) return null;

    const data = JSON.parse(new TextDecoder().decode(stdout));
    const [owner, repo] = data.nameWithOwner.split('/');
    return { owner, repo };
  } catch {
    return null;
  }
}

/**
 * Fetch PR info using gh CLI
 */
async function fetchPrInfo(prNumber: number): Promise<PrInfo | null> {
  try {
    const cmd = new Deno.Command('gh', {
      args: ['pr', 'view', String(prNumber), '--json', 'number,headRefName,headRepository,headRepositoryOwner,isCrossRepository'],
      stdout: 'piped',
      stderr: 'piped',
    });
    const { code, stdout, stderr } = await cmd.output();

    if (code !== 0) {
      const errorMsg = new TextDecoder().decode(stderr);
      if (errorMsg.includes('Could not resolve') || errorMsg.includes('not found')) {
        return null;
      }
      throw new Error(errorMsg);
    }

    return JSON.parse(new TextDecoder().decode(stdout));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch PR branch using pull/<number>/head ref pattern
 * This works for both same-repo and fork PRs
 */
async function fetchPrBranch(prNumber: number, branchName: string): Promise<{ success: boolean; message?: string }> {
  // Fetch the PR head into a local branch
  const cmd = new Deno.Command('git', {
    args: ['fetch', 'origin', `pull/${prNumber}/head:${branchName}`],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stderr } = await cmd.output();

  if (code !== 0) {
    const errorMsg = new TextDecoder().decode(stderr);
    return { success: false, message: errorMsg };
  }

  return { success: true };
}

/**
 * Execute the pr command
 *
 * @param args Command-line arguments for the pr command
 */
export async function executePr(args: string[]): Promise<void> {
  const parsed = parsePrArgs(args);

  // Show help if requested
  if (parsed.help) {
    showPrHelp();
    Deno.exit(0);
  }

  // Validate arguments
  if (!parsed.prIdentifier) {
    output.error('PR number or URL is required');
    showPrHelp();
    Deno.exit(1);
  }

  // Parse PR identifier
  const prIdResult = parsePrIdentifier(parsed.prIdentifier);
  if (!prIdResult) {
    output.error(`Invalid PR identifier: ${parsed.prIdentifier}`);
    console.log('Expected a PR number (e.g., 42) or GitHub PR URL');
    console.log('Example URL: https://github.com/owner/repo/pull/42\n');
    Deno.exit(1);
  }

  // Check if gh CLI is installed
  if (!(await isGhInstalled())) {
    output.error('GitHub CLI (gh) is not installed');
    console.log('The gw pr command requires the GitHub CLI to fetch PR information.');
    console.log('');
    console.log('Install gh from: https://cli.github.com/');
    console.log('');
    console.log('After installation, authenticate with:');
    console.log('  gh auth login\n');
    Deno.exit(1);
  }

  // If URL was provided, validate it matches current repo
  if (prIdResult.owner && prIdResult.repo) {
    const currentRepo = await getCurrentRepo();
    if (!currentRepo) {
      output.error('Could not determine current repository');
      console.log('Make sure you are in a git repository with a GitHub remote.\n');
      Deno.exit(1);
    }

    if (
      currentRepo.owner.toLowerCase() !== prIdResult.owner.toLowerCase() ||
      currentRepo.repo.toLowerCase() !== prIdResult.repo.toLowerCase()
    ) {
      output.error(`PR URL is for repository '${prIdResult.owner}/${prIdResult.repo}'`);
      console.log(`But you're currently in '${currentRepo.owner}/${currentRepo.repo}'`);
      console.log('');
      console.log('Hint: Use just the PR number if you want to fetch from the current repo:');
      console.log(`  gw pr ${prIdResult.prNumber}\n`);
      Deno.exit(1);
    }
  }

  const prNumber = prIdResult.prNumber;
  console.log(`Fetching PR #${prNumber} information...\n`);

  // Fetch PR info
  const prInfo = await fetchPrInfo(prNumber);
  if (!prInfo) {
    output.error(`PR #${prNumber} not found`);
    console.log('Make sure the PR exists and you have access to it.');
    console.log('');
    console.log('If this is a private repository, ensure you are authenticated:');
    console.log('  gh auth login\n');
    Deno.exit(1);
  }

  // Determine the branch/worktree name
  const branchName = prInfo.headRefName;
  const worktreeName = parsed.name || branchName;

  console.log(`PR #${prNumber}: ${output.bold(branchName)}`);
  if (prInfo.isCrossRepository) {
    console.log(`  From fork: ${output.dim(`${prInfo.headRepositoryOwner.login}/${prInfo.headRepository.name}`)}`);
  }
  console.log('');

  // Load config
  const { config, gitRoot } = await loadConfig();

  // Resolve worktree path
  const worktreePath = resolveWorktreePath(gitRoot, worktreeName);

  // Prepare hook variables
  const hookVariables: HookVariables = {
    worktree: worktreeName,
    worktreePath,
    gitRoot,
    branch: branchName,
  };

  // Check if branch already exists in a worktree
  const worktrees = await listWorktrees();
  const existingWorktree = worktrees.find((wt) => wt.branch === branchName);

  if (existingWorktree) {
    console.log('');
    output.info(`Branch ${output.bold(branchName)} is already checked out at:`);
    console.log(`  ${output.path(existingWorktree.path)}`);
    console.log('');

    const response = prompt(`Navigate to it? [Y/n]:`);

    if (
      response === null ||
      response === '' ||
      response.toLowerCase() === 'y' ||
      response.toLowerCase() === 'yes'
    ) {
      await signalNavigation(existingWorktree.path);
      Deno.exit(0);
    } else {
      console.log('');
      output.info('PR checkout cancelled.');
      Deno.exit(0);
    }
  }

  // Check for leftover directory that isn't a valid worktree
  try {
    const stat = await Deno.stat(worktreePath);
    if (stat.isDirectory || stat.isFile) {
      // Path exists - check if it's a valid worktree
      const isValidWorktree = worktrees.some((wt) => wt.path === worktreePath);

      if (isValidWorktree) {
        // Worktree already exists but with a different branch
        console.log('');
        output.info(`Worktree ${output.bold(worktreeName)} already exists at:`);
        console.log(`  ${output.path(worktreePath)}`);
        console.log('');

        const response = prompt(`Navigate to it? [Y/n]:`);

        if (
          response === null ||
          response === '' ||
          response.toLowerCase() === 'y' ||
          response.toLowerCase() === 'yes'
        ) {
          await signalNavigation(worktreePath);
          Deno.exit(0);
        } else {
          console.log('');
          output.info('PR checkout cancelled.');
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
      throw error;
    }
  }

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

  // Fetch PR branch
  console.log(`Fetching PR branch...`);
  console.log(output.dim(`  git fetch origin pull/${prNumber}/head:${branchName}`));
  console.log('');

  const fetchResult = await fetchPrBranch(prNumber, branchName);
  if (!fetchResult.success) {
    output.error('Failed to fetch PR branch');
    console.log(fetchResult.message || 'Unknown error');
    console.log('');
    console.log('Possible causes:');
    console.log('  - The PR may have been closed and the branch deleted');
    console.log('  - Network connectivity issues');
    console.log('  - Authentication issues with the repository\n');
    Deno.exit(1);
  }

  // Create worktree
  console.log(`Creating worktree: ${output.bold(worktreeName)}\n`);

  const gitCmd = ['git', 'worktree', 'add', worktreePath, branchName];
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

  // Set up tracking to origin for the PR branch
  // This allows easy pushing of changes back to the PR
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

  // Determine which files to copy
  let filesToCopy: string[] = [];

  if (config.autoCopyFiles && config.autoCopyFiles.length > 0) {
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
      worktreePath,
      hookVariables,
      'post-add',
      false // don't abort on failure, just warn
    );

    if (!allSuccessful) {
      output.warning('One or more post-add hooks failed');
    }
  }

  // Auto-cleanup stale worktrees if enabled
  await promptAndRunAutoClean();

  output.success(`Worktree ${output.bold(`"${worktreeName}"`)} created for PR #${prNumber}`);

  // Navigate to new worktree unless --no-cd flag is set
  if (!parsed.noNavigate) {
    await signalNavigation(worktreePath);
  }
}
