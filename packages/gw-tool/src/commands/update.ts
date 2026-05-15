/**
 * Update command - update current worktree with latest changes from default branch
 */

import { loadConfig } from '../lib/config.ts';
import { parseUpdateArgs, showUpdateHelp } from '../lib/cli.ts';
import {
  fetchAndGetStartPoint,
  getCurrentBranch,
  getCurrentWorktreePath,
  hasUncommittedChanges,
  isDetachedHead,
  mergeBranch,
  rebaseBranch,
} from '../lib/git-utils.ts';
import { extractRemoteHost, fetchPrRef, parsePrIdentifier } from '../lib/pr-utils.ts';
import * as output from '../lib/output.ts';

/**
 * Get the URL for a given remote name as stored in git config
 * (without applying url.insteadOf rewrites, so we see what the user configured).
 * Returns null if the remote does not exist or the command fails.
 */
async function getRemoteUrl(remote: string): Promise<string | null> {
  try {
    const cmd = new Deno.Command('git', {
      args: ['config', `remote.${remote}.url`],
      stdout: 'piped',
      stderr: 'null',
    });
    const { code, stdout } = await cmd.output();
    if (code !== 0) return null;
    return new TextDecoder().decode(stdout).trim();
  } catch {
    return null;
  }
}

/**
 * Optionally enrich the display label with the PR title via `gh`.
 * Any failure (not installed, not authenticated, network, 404) is silently ignored.
 */
async function tryGetPrTitle(prNumber: number): Promise<string | null> {
  try {
    const cmd = new Deno.Command('gh', {
      args: ['pr', 'view', String(prNumber), '--json', 'title'],
      stdout: 'piped',
      stderr: 'null',
    });
    const { code, stdout } = await cmd.output();
    if (code !== 0) return null;
    const data = JSON.parse(new TextDecoder().decode(stdout));
    return typeof data.title === 'string' && data.title ? data.title : null;
  } catch {
    return null;
  }
}

/**
 * Execute the update command
 */
export async function executeUpdate(args: string[]): Promise<void> {
  // 1. Parse arguments
  const parsed = parseUpdateArgs(args);

  // 2. Show help if requested
  if (parsed.help) {
    showUpdateHelp();
    Deno.exit(0);
  }

  try {
    // 3. --from-pr + --from mutual exclusion (before any I/O)
    if (parsed.fromPr && parsed.branch) {
      output.error('Cannot use both --from-pr and --from flags. Please choose one.');
      Deno.exit(1);
    }

    // 4. Resolve PR identifier if --from-pr was given
    let startPoint: string | undefined;
    let displayLabel: string | undefined;

    if (parsed.fromPr) {
      // 4a. Parse the identifier
      const prIdResult = parsePrIdentifier(parsed.fromPr);
      if (!prIdResult) {
        output.error(`Invalid PR identifier: ${parsed.fromPr}`);
        console.log('Expected a PR number (e.g., 42) or GitHub PR URL');
        console.log('Example URL: https://github.com/owner/repo/pull/42\n');
        Deno.exit(1);
      }

      const { prNumber } = prIdResult;

      // 4b. Detect remote host and guard against non-GitHub remotes
      const remoteUrl = await getRemoteUrl(parsed.remote);
      const host = remoteUrl ? extractRemoteHost(remoteUrl) : null;

      if (!host || !host.includes('github.com')) {
        const detectedLabel = host ?? (remoteUrl ? remoteUrl : 'unknown');
        output.error(`--from-pr requires a GitHub remote; detected: ${detectedLabel}`);
        Deno.exit(1);
      }

      // 4c. Force-fetch the PR ref
      const fetchResult = await fetchPrRef(prNumber, parsed.remote);
      if (!fetchResult.success) {
        output.error(`Failed to fetch PR #${prNumber}: ${fetchResult.message || 'unknown error'}`);
        console.log('');
        console.log('Possible causes:');
        console.log('  - The PR may have been closed and the ref deleted');
        console.log('  - Network connectivity issues');
        console.log('  - Authentication issues with the repository\n');
        Deno.exit(1);
      }

      startPoint = fetchResult.ref;
      displayLabel = `PR #${prNumber}`;

      // 4d. Optionally enrich label with PR title (silent on failure)
      const title = await tryGetPrTitle(prNumber);
      if (title) {
        displayLabel = `PR #${prNumber}: ${title}`;
      }
    }

    // 5. Validate mutually exclusive flags
    if (parsed.merge && parsed.rebase) {
      output.error('Cannot use both --merge and --rebase flags. Please choose one.');
      Deno.exit(1);
    }

    // 6. Load config (get defaultBranch and updateStrategy)
    const { config } = await loadConfig();
    const targetBranch = parsed.fromPr ? undefined : parsed.branch || config.defaultBranch || 'main';

    // 7. Determine update strategy
    let strategy: 'merge' | 'rebase' = 'merge'; // default
    if (parsed.merge) {
      strategy = 'merge';
    } else if (parsed.rebase) {
      strategy = 'rebase';
    } else if (config.updateStrategy) {
      strategy = config.updateStrategy;
    }

    // 8. Get current worktree and branch
    const currentPath = await getCurrentWorktreePath();
    const currentBranch = await getCurrentBranch(currentPath);

    // 9. Validate state - check for detached HEAD
    if (await isDetachedHead(currentPath)) {
      output.error('Cannot update: currently in detached HEAD state. Checkout a branch first.');
      Deno.exit(1);
    }

    // 10. Check for uncommitted changes (unless --force)
    if (!parsed.force && (await hasUncommittedChanges(currentPath))) {
      output.error(`Cannot ${strategy}: uncommitted changes detected`);
      console.log('');
      console.log(`Please commit or stash your changes before updating:`);
      console.log('  git add .');
      console.log('  git commit -m "your message"');
      console.log('');
      console.log('Or use --force to skip this check (not recommended)');
      Deno.exit(1);
    }

    // Show warning if forcing with uncommitted changes
    if (parsed.force && (await hasUncommittedChanges(currentPath))) {
      output.warning('Proceeding with uncommitted changes due to --force flag');
    }

    // 11. Fetch latest version of target branch (only when not using --from-pr)
    if (!startPoint) {
      console.log(`Fetching latest ${output.bold(targetBranch!)} from ${output.bold(parsed.remote)}...`);

      const fetchResult = await fetchAndGetStartPoint(targetBranch!, parsed.remote);
      startPoint = fetchResult.startPoint;
      const { fetchSucceeded, message } = fetchResult;

      if (fetchSucceeded) {
        if (message) {
          console.log(output.dim(message));
        }
        console.log(output.dim(`${output.checkmark()} Fetched successfully`));
      } else {
        // Check if failure is due to no remote (acceptable) or fetch failure (problematic)
        const noRemoteConfigured = message && message.includes('No remote');

        // When --from is explicitly specified and remote exists but fetch failed
        if (parsed.branch && !noRemoteConfigured) {
          console.log('');
          output.error(message || 'Could not fetch from remote');
          console.log('');
          console.log(`Cannot update from ${output.bold(targetBranch!)} because the remote fetch failed.`);
          console.log('This would use a potentially outdated local branch.');
          console.log('');
          console.log('Possible causes:');
          console.log('  • Network connectivity issues');
          console.log(`  • Branch ${output.bold(targetBranch!)} doesn't exist on remote`);
          console.log('  • Authentication issues');
          console.log('');
          console.log('Options:');
          console.log(`  1. Check your network connection and try again`);
          console.log(
            `  2. Verify the branch exists: ${output.bold(`git ls-remote ${parsed.remote} ${targetBranch}`)}`
          );
          console.log(`  3. Use a different source branch: ${output.bold(`gw update --from <branch>`)}`);
          console.log(`  4. Update from default branch: ${output.bold(`gw update`)}`);
          console.log('');
          Deno.exit(1);
        }

        // For default branch (no --from specified) or no remote configured, warn but allow
        output.warning(message || 'Could not fetch from remote');
        console.log(output.dim('Using local branch'));
      }

      console.log('');
    } else {
      // --from-pr path: startPoint already set
      console.log(output.dim(`${output.checkmark()} Fetched ${displayLabel} successfully`));
      console.log('');
    }

    // 12. Prepare all messaging decisions upfront
    const strategyVerb = strategy === 'merge' ? 'Merging' : 'Rebasing';
    const strategyPrep = strategy === 'merge' ? 'into' : 'onto';
    const strategyPastTense = strategy === 'merge' ? 'Merged' : 'Rebased';

    // Human-readable ref label (e.g. "PR #42" or "main")
    const displayRef = displayLabel ?? startPoint;

    // For merge: "Merging main into feature-branch" (bringing upstream into our branch)
    // For rebase: "Rebasing feature-branch onto main" (moving our branch on top of upstream)
    const operationMessage =
      strategy === 'merge'
        ? `${strategyVerb} ${output.bold(displayRef)} ${strategyPrep} ${output.bold(currentBranch)}`
        : `${strategyVerb} ${output.bold(currentBranch)} ${strategyPrep} ${output.bold(displayRef)}`;

    // 13. Dry run check
    if (parsed.dryRun) {
      output.info(`Would perform: ${operationMessage}`);
      Deno.exit(0);
    }

    // 14. Execute update (merge or rebase)
    console.log(`${operationMessage}...`);

    const result =
      strategy === 'merge' ? await mergeBranch(currentPath, startPoint) : await rebaseBranch(currentPath, startPoint);

    // 15. Handle result
    if (result.success) {
      if (result.message === 'Already up to date') {
        console.log('');
        output.info(`Already up to date with ${output.bold(displayRef)}`);
      } else {
        console.log(output.dim(`${output.checkmark()} ${strategyPastTense} successfully`));
        console.log('');
        // sourceName for success message: human label if available, else targetBranch, else startPoint
        const sourceName = displayLabel ?? targetBranch ?? startPoint;
        output.success(`Updated ${output.bold(currentBranch)} with latest changes from ${output.bold(sourceName)}`);

        // Display file stats if available
        if (result.fileStats && result.fileStats.length > 0) {
          console.log('');
          for (const fileStat of result.fileStats) {
            console.log(` ${output.colorizeFileStat(fileStat)}`);
          }
        }

        // Display summary
        if (result.filesChanged) {
          console.log(output.dim(`${result.filesChanged} file${result.filesChanged === 1 ? '' : 's'} changed`));
        }
      }
    } else if (result.conflicted) {
      console.log('');
      output.error(`${strategy === 'merge' ? 'Merge' : 'Rebase'} conflict detected`);
      console.log('');
      console.log('Resolve conflicts manually:');
      console.log('  1. Edit conflicted files');
      console.log('  2. git add <resolved-files>');
      if (strategy === 'merge') {
        console.log('  3. git commit');
        console.log('');
        console.log('Or abort the merge:');
        console.log('  git merge --abort');
      } else {
        console.log('  3. git rebase --continue');
        console.log('');
        console.log('Or abort the rebase:');
        console.log('  git rebase --abort');
      }
      Deno.exit(1);
    } else {
      console.log('');
      output.error(result.message || `${strategy === 'merge' ? 'Merge' : 'Rebase'} failed`);
      Deno.exit(1);
    }
  } catch (error) {
    // Re-throw MockExitError (test harness) so it propagates correctly
    if (error instanceof Error && error.name === 'MockExitError') {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    output.error(`Failed to update: ${errorMsg}`);
    Deno.exit(1);
  }
}
