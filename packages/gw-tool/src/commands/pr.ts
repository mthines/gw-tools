/**
 * PR command implementation
 * Fetches a pull request's branch and creates a worktree for it
 */

import { runAutoClean } from '../lib/auto-clean.ts';
import { loadConfig } from '../lib/config.ts';
import { copyFiles } from '../lib/file-ops.ts';
import { listWorktrees } from '../lib/git-utils.ts';
import { executeHooks, type HookVariables } from '../lib/hooks.ts';
import { resolveWorktreePath } from '../lib/path-resolver.ts';
import { signalNavigation } from '../lib/shell-navigation.ts';
import * as output from '../lib/output.ts';
import {
  DEFAULT_PR_RESOLVERS,
  enrichWithGh,
  isGhInstalled,
  parseGithubIdentifier,
  resolvePrIdentifier,
} from '../lib/pr-resolvers.ts';
import type { PrResolver, ResolvedPr } from '../lib/types.ts';

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
  console.log(`Usage: gw pr [options] <pr-number|pr-url|custom-identifier>

Check out a pull request into a new worktree.

This command resolves an identifier — a PR number, GitHub PR URL, or any
input understood by a configured custom resolver (e.g. a Linear review URL)
— into PR metadata, fetches the branch, and creates a worktree for it.

Arguments:
  <pr-number|pr-url|custom-identifier>
                        PR number (e.g., 42), GitHub PR URL, or an
                        identifier handled by a custom prResolver.

Options:
  --name <name>         Custom name for the worktree directory
  --no-cd               Don't navigate to the new worktree after creation
  -h, --help            Show this help message

Examples:
  # Check out PR #42 (uses the github builtin resolver)
  gw pr 42

  # Check out PR by URL
  gw pr https://github.com/user/repo/pull/42

  # Check out a PR via a custom resolver (e.g. Linear)
  gw pr https://linear.app/<workspace>/review/<slug>

  # Use custom worktree name
  gw pr 42 --name review-feature

Requirements:
  - GitHub CLI (gh) for the default github builtin resolver
  - Install: https://cli.github.com/

Custom resolvers:
  Define resolvers in .gw/config.json under "prResolvers" — an ordered list
  of { name, command|builtin, timeoutMs? }. Each resolver receives the
  identifier on stdin and as $1, and writes JSON to stdout:
    { "prNumber": 42, "branch"?, "owner"?, "repo"?, "isCrossRepository"?, "remote"? }
  Exit non-zero or empty output = "I don't handle this", try next resolver.
  Secrets live in .gw/.env (auto-loaded, gitignored).

If the PR's branch is already checked out in a worktree, the command
will offer to navigate to that worktree instead.
`);
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
 * Fetch PR branch using pull/<number>/head ref pattern
 * This works for both same-repo and fork PRs
 */
async function fetchPrBranch(
  prNumber: number,
  branchName: string,
  remote: string
): Promise<{
  success: boolean;
  message?: string;
}> {
  const cmd = new Deno.Command('git', {
    args: ['fetch', remote, `pull/${prNumber}/head:${branchName}`],
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
 * Resolve the user identifier through the configured chain and enrich
 * with gh metadata if needed. Handles all error reporting and exits the
 * process on failure.
 */
async function resolveOrExit(
  identifier: string,
  resolvers: PrResolver[],
  gitRoot: string
): Promise<{ resolved: ResolvedPr; resolverName: string }> {
  if (resolvers.length === 0) {
    output.error('No PR resolvers configured');
    console.log('Set "prResolvers" in .gw/config.json — at minimum [{ "name": "gh", "builtin": "github" }].\n');
    Deno.exit(1);
  }

  const winning = await resolvePrIdentifier(identifier, {
    resolvers,
    gitRoot,
  });

  if (!winning) {
    // Distinguish the common case (only gh in chain, but gh missing) from
    // "no resolver knew how to handle this".
    const onlyGithubBuiltin = resolvers.length === 1 && resolvers[0].builtin === 'github';
    if (onlyGithubBuiltin && !(await isGhInstalled())) {
      output.error('GitHub CLI (gh) is not installed');
      console.log('The default github resolver requires the GitHub CLI to fetch PR information.');
      console.log('');
      console.log('Install gh from: https://cli.github.com/');
      console.log('');
      console.log('After installation, authenticate with:');
      console.log('  gh auth login');
      console.log('');
      console.log('Or configure a custom resolver in .gw/config.json under "prResolvers" — see `gw pr --help`.\n');
      Deno.exit(1);
    }

    output.error(`Could not resolve PR identifier: ${identifier}`);
    console.log('');
    console.log('Tried resolvers (in order):');
    for (const r of resolvers) {
      console.log(`  - ${r.name}${r.builtin ? ` (builtin: ${r.builtin})` : ''}`);
    }
    console.log('');
    console.log('Add or adjust resolvers in .gw/config.json. See `gw pr --help`.\n');
    Deno.exit(1);
  }

  const enriched = await enrichWithGh(winning.result);

  if (!enriched.branch) {
    output.error(`Resolver "${winning.resolver.name}" returned PR #${enriched.prNumber} but no branch name`);
    console.log('');
    console.log('Either include `branch` in the resolver output, or install gh so gw can');
    console.log('fetch the branch name automatically.\n');
    Deno.exit(1);
  }

  return { resolved: enriched, resolverName: winning.resolver.name };
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

  // Load config — needed for resolver chain, hooks, and auto-copy.
  const { config, gitRoot } = await loadConfig();
  const resolvers = config.prResolvers ?? DEFAULT_PR_RESOLVERS;

  // Owner/repo mismatch guard runs ONLY for github.com URLs and uses the
  // pure-string parse — it does not depend on the resolver chain. This
  // catches the "paste a PR URL from the wrong repo" mistake before we
  // burn a network round-trip on the wrong PR.
  const ghParse = parseGithubIdentifier(parsed.prIdentifier);
  if (ghParse?.owner && ghParse.repo && (await isGhInstalled())) {
    const currentRepo = await getCurrentRepo();
    if (currentRepo) {
      if (
        currentRepo.owner.toLowerCase() !== ghParse.owner.toLowerCase() ||
        currentRepo.repo.toLowerCase() !== ghParse.repo.toLowerCase()
      ) {
        output.error(`PR URL is for repository '${ghParse.owner}/${ghParse.repo}'`);
        console.log(`But you're currently in '${currentRepo.owner}/${currentRepo.repo}'`);
        console.log('');
        console.log('Hint: Use just the PR number if you want to fetch from the current repo:');
        console.log(`  gw pr ${ghParse.prNumber}\n`);
        Deno.exit(1);
      }
    }
  }

  console.log(`Resolving ${output.dim(parsed.prIdentifier)}...\n`);

  const { resolved, resolverName } = await resolveOrExit(parsed.prIdentifier, resolvers, gitRoot);
  const prNumber = resolved.prNumber;
  const branchName = resolved.branch!;
  const remote = resolved.remote ?? 'origin';

  if (resolverName !== 'gh') {
    console.log(output.dim(`  Resolved via "${resolverName}" → PR #${prNumber}`));
    console.log('');
  }

  // Determine the branch/worktree name
  const worktreeName = parsed.name || branchName;

  console.log(`PR #${prNumber}: ${output.bold(branchName)}`);
  if (resolved.isCrossRepository && resolved.owner && resolved.repo) {
    console.log(`  From fork: ${output.dim(`${resolved.owner}/${resolved.repo}`)}`);
  }
  console.log('');

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

    if (response === null || response === '' || response.toLowerCase() === 'y' || response.toLowerCase() === 'yes') {
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
      const isValidWorktree = worktrees.some((wt) => wt.path === worktreePath);

      if (isValidWorktree) {
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
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  // Execute pre-checkout hooks (abort on failure)
  if (config.hooks?.checkout?.pre && config.hooks.checkout.pre.length > 0) {
    const { allSuccessful } = await executeHooks(
      config.hooks.checkout.pre,
      gitRoot,
      hookVariables,
      'pre-checkout',
      true
    );

    if (!allSuccessful) {
      output.error('Pre-checkout hook failed. Aborting worktree creation.');
      Deno.exit(1);
    }
  }

  // Fetch PR branch
  console.log(`Fetching PR branch...`);
  console.log(output.dim(`  git fetch ${remote} pull/${prNumber}/head:${branchName}`));
  console.log('');

  const fetchResult = await fetchPrBranch(prNumber, branchName, remote);
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

  // Set up tracking to origin for the PR branch so pushes work transparently.
  const configRemoteCmd = new Deno.Command('git', {
    args: ['-C', worktreePath, 'config', `branch.${branchName}.remote`, remote],
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

  if (filesToCopy.length > 0) {
    console.log(`Copying files to new worktree...`);

    const sourceWorktree = config.defaultBranch || 'main';
    let sourcePath = resolveWorktreePath(gitRoot, sourceWorktree);

    try {
      await Deno.stat(sourcePath);
    } catch {
      sourcePath = gitRoot;
    }

    try {
      const results = await copyFiles(sourcePath, worktreePath, filesToCopy, false);

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

  // Execute post-checkout hooks (warn but don't abort on failure)
  if (config.hooks?.checkout?.post && config.hooks.checkout.post.length > 0) {
    const { allSuccessful } = await executeHooks(
      config.hooks.checkout.post,
      worktreePath,
      hookVariables,
      'post-checkout',
      false
    );

    if (!allSuccessful) {
      output.warning('One or more post-checkout hooks failed');
    }
  }

  output.success(`Worktree ${output.bold(`"${worktreeName}"`)} created for PR #${prNumber}`);

  // Navigate to new worktree unless --no-cd flag is set
  if (!parsed.noNavigate) {
    await signalNavigation(worktreePath);
  }

  // Auto-cleanup stale worktrees silently in background
  runAutoClean();
}
