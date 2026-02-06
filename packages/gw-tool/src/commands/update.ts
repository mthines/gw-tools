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
import * as output from '../lib/output.ts';

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
    // 3. Validate mutually exclusive flags
    if (parsed.merge && parsed.rebase) {
      output.error('Cannot use both --merge and --rebase flags. Please choose one.');
      Deno.exit(1);
    }

    // 4. Load config (get defaultBranch and updateStrategy)
    const { config } = await loadConfig();
    const targetBranch = parsed.branch || config.defaultBranch || 'main';

    // 5. Determine update strategy
    let strategy: 'merge' | 'rebase' = 'merge'; // default
    if (parsed.merge) {
      strategy = 'merge';
    } else if (parsed.rebase) {
      strategy = 'rebase';
    } else if (config.updateStrategy) {
      strategy = config.updateStrategy;
    }

    // 6. Get current worktree and branch
    const currentPath = await getCurrentWorktreePath();
    const currentBranch = await getCurrentBranch(currentPath);

    // 7. Validate state - check for detached HEAD
    if (await isDetachedHead(currentPath)) {
      output.error('Cannot update: currently in detached HEAD state. Checkout a branch first.');
      Deno.exit(1);
    }

    // 8. Check for uncommitted changes (unless --force)
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

    // 9. Fetch latest version of target branch
    console.log(`Fetching latest ${output.bold(targetBranch)} from ${output.bold(parsed.remote)}...`);

    const { startPoint, fetchSucceeded, message } = await fetchAndGetStartPoint(targetBranch, parsed.remote);

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
        console.log(`Cannot update from ${output.bold(targetBranch)} because the remote fetch failed.`);
        console.log('This would use a potentially outdated local branch.');
        console.log('');
        console.log('Possible causes:');
        console.log('  • Network connectivity issues');
        console.log(`  • Branch ${output.bold(targetBranch)} doesn't exist on remote`);
        console.log('  • Authentication issues');
        console.log('');
        console.log('Options:');
        console.log(`  1. Check your network connection and try again`);
        console.log(`  2. Verify the branch exists: ${output.bold(`git ls-remote ${parsed.remote} ${targetBranch}`)}`);
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

    // 10. Prepare all messaging decisions upfront
    const strategyVerb = strategy === 'merge' ? 'Merging' : 'Rebasing';
    const strategyPrep = strategy === 'merge' ? 'into' : 'onto';
    const strategyPastTense = strategy === 'merge' ? 'Merged' : 'Rebased';

    // For merge: "Merging main into feature-branch" (bringing upstream into our branch)
    // For rebase: "Rebasing feature-branch onto main" (moving our branch on top of upstream)
    const operationMessage =
      strategy === 'merge'
        ? `${strategyVerb} ${output.bold(startPoint)} ${strategyPrep} ${output.bold(currentBranch)}`
        : `${strategyVerb} ${output.bold(currentBranch)} ${strategyPrep} ${output.bold(startPoint)}`;

    // 11. Dry run check
    if (parsed.dryRun) {
      output.info(`Would perform: ${operationMessage}`);
      Deno.exit(0);
    }

    // 12. Execute update (merge or rebase)
    console.log(`${operationMessage}...`);

    const result =
      strategy === 'merge' ? await mergeBranch(currentPath, startPoint) : await rebaseBranch(currentPath, startPoint);

    // 13. Handle result
    if (result.success) {
      if (result.message === 'Already up to date') {
        console.log('');
        output.info(`Already up to date with ${output.bold(startPoint)}`);
      } else {
        console.log(output.dim(`${output.checkmark()} ${strategyPastTense} successfully`));
        console.log('');
        output.success(`Updated ${output.bold(currentBranch)} with latest changes from ${output.bold(targetBranch)}`);

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
    const errorMsg = error instanceof Error ? error.message : String(error);
    output.error(`Failed to update: ${errorMsg}`);
    Deno.exit(1);
  }
}
