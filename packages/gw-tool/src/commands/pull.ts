/**
 * Pull command - merge latest version of default branch into current worktree
 */

import { loadConfig } from "../lib/config.ts";
import { parsePullArgs, showPullHelp } from "../lib/cli.ts";
import {
  fetchAndGetStartPoint,
  getCurrentBranch,
  getCurrentWorktreePath,
  hasUncommittedChanges,
  isDetachedHead,
  mergeBranch,
} from "../lib/git-utils.ts";
import * as output from "../lib/output.ts";

/**
 * Execute the pull command
 */
export async function executePull(args: string[]): Promise<void> {
  // 1. Parse arguments
  const parsed = parsePullArgs(args);

  // 2. Show help if requested
  if (parsed.help) {
    showPullHelp();
    Deno.exit(0);
  }

  try {
    // 3. Load config (get defaultBranch)
    const { config } = await loadConfig();
    const targetBranch = parsed.branch || config.defaultBranch || "main";

    // 4. Get current worktree and branch
    const currentPath = await getCurrentWorktreePath();
    const currentBranch = await getCurrentBranch(currentPath);

    // 5. Validate state - check for detached HEAD
    if (await isDetachedHead(currentPath)) {
      output.error(
        "Cannot pull: currently in detached HEAD state. Checkout a branch first.",
      );
      Deno.exit(1);
    }

    // 6. Check for uncommitted changes (unless --force)
    if (!parsed.force && (await hasUncommittedChanges(currentPath))) {
      output.error("Cannot merge: uncommitted changes detected");
      console.log("");
      console.log("Please commit or stash your changes before pulling:");
      console.log("  git add .");
      console.log('  git commit -m "your message"');
      console.log("");
      console.log("Or use --force to skip this check (not recommended)");
      Deno.exit(1);
    }

    // Show warning if forcing with uncommitted changes
    if (parsed.force && (await hasUncommittedChanges(currentPath))) {
      output.warning(
        "Proceeding with uncommitted changes due to --force flag",
      );
    }

    // 7. Fetch latest version of target branch
    console.log(
      `Fetching latest ${output.bold(targetBranch)} from ${output.bold(parsed.remote)}...`,
    );

    const { startPoint, fetchSucceeded, message } =
      await fetchAndGetStartPoint(targetBranch, parsed.remote);

    if (fetchSucceeded) {
      if (message) {
        console.log(output.dim(message));
      }
      console.log(output.dim(`${output.checkmark()} Fetched successfully`));
    } else {
      output.warning(message || "Could not fetch from remote");
      console.log(output.dim("Using local branch"));
    }

    console.log("");

    // 8. Dry run check
    if (parsed.dryRun) {
      output.info(
        `Would merge ${output.bold(startPoint)} into ${output.bold(currentBranch)}`,
      );
      Deno.exit(0);
    }

    // 9. Execute merge
    console.log(
      `Merging ${output.bold(startPoint)} into ${output.bold(currentBranch)}...`,
    );

    const mergeResult = await mergeBranch(currentPath, startPoint);

    // 10. Handle result
    if (mergeResult.success) {
      if (mergeResult.message === "Already up to date") {
        console.log("");
        output.info(
          `Already up to date with ${output.bold(startPoint)}`,
        );
      } else {
        console.log(output.dim(`${output.checkmark()} Merged successfully`));
        console.log("");
        output.success(
          `Updated ${output.bold(currentBranch)} with latest changes from ${output.bold(targetBranch)}`,
        );

        // Display file stats if available
        if (mergeResult.fileStats && mergeResult.fileStats.length > 0) {
          console.log("");
          for (const fileStat of mergeResult.fileStats) {
            console.log(` ${output.colorizeFileStat(fileStat)}`);
          }
        }

        // Display summary
        if (mergeResult.filesChanged) {
          console.log(
            output.dim(
              `${mergeResult.filesChanged} file${mergeResult.filesChanged === 1 ? "" : "s"} changed`,
            ),
          );
        }
      }
    } else if (mergeResult.conflicted) {
      console.log("");
      output.error("Merge conflict detected");
      console.log("");
      console.log("Resolve conflicts manually:");
      console.log("  1. Edit conflicted files");
      console.log("  2. git add <resolved-files>");
      console.log("  3. git commit");
      console.log("");
      console.log("Or abort the merge:");
      console.log("  git merge --abort");
      Deno.exit(1);
    } else {
      console.log("");
      output.error(mergeResult.message || "Merge failed");
      Deno.exit(1);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    output.error(`Failed to pull: ${errorMsg}`);
    Deno.exit(1);
  }
}
