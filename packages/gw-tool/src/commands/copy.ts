/**
 * Copy command implementation
 */

import { parseCopyArgs, showCopyHelp } from "../lib/cli.ts";
import { loadConfig } from "../lib/config.ts";
import { copyFiles } from "../lib/file-ops.ts";
import {
  resolveWorktreePath,
  validatePathExists,
} from "../lib/path-resolver.ts";
import * as output from "../lib/output.ts";

/**
 * Execute the copy command
 *
 * @param args Command-line arguments for the copy command
 */
export async function executeCopy(args: string[]): Promise<void> {
  // 1. Parse command arguments
  const parsed = parseCopyArgs(args);

  // 2. Show help if requested
  if (parsed.help) {
    showCopyHelp();
    Deno.exit(0);
  }

  // 3. Validate arguments
  if (!parsed.target || parsed.files.length === 0) {
    output.error("Target worktree and files required");
    showCopyHelp();
    Deno.exit(1);
  }

  // 4. Load config
  const { config, gitRoot } = await loadConfig();

  // 5. Resolve paths
  const sourceWorktree = parsed.from || config.defaultBranch || "main";
  const sourcePath = resolveWorktreePath(gitRoot, sourceWorktree);
  const targetPath = resolveWorktreePath(gitRoot, parsed.target);

  // 6. Validate paths exist
  try {
    await validatePathExists(sourcePath, "directory");
  } catch (_error) {
    output.error(`Source worktree not found: ${output.path(sourcePath)}`);
    console.error(`Make sure '${output.bold(sourceWorktree)}' worktree exists in ${output.path(gitRoot)}\n`);
    Deno.exit(1);
  }

  try {
    await validatePathExists(targetPath, "directory");
  } catch (_error) {
    output.error(`Target worktree not found: ${output.path(targetPath)}`);
    console.error(`Make sure '${output.bold(parsed.target)}' worktree exists in ${output.path(gitRoot)}\n`);
    Deno.exit(1);
  }

  // 7. Copy files
  const dryRunNotice = parsed.dryRun ? output.dim(" (DRY RUN)") : "";
  console.log(
    `Copying from ${output.bold(sourceWorktree)} to ${output.bold(parsed.target)}${dryRunNotice}...\n`,
  );

  const results = await copyFiles(
    sourcePath,
    targetPath,
    parsed.files,
    parsed.dryRun,
  );

  // 8. Display results
  for (const result of results) {
    if (result.success) {
      console.log(`  ${output.checkmark()} ${result.message}`);
    } else {
      console.log(`  ${output.warningSymbol()} ${result.message}`);
    }
  }

  // 9. Summary
  const successCount = results.filter((r) => r.success).length;
  const verb = parsed.dryRun ? "Would copy" : "Copied";
  const fileWord = successCount === 1 ? "file" : "files";

  if (successCount === results.length) {
    output.success(`${verb} ${output.bold(`${successCount}/${results.length}`)} ${fileWord}`);
  } else {
    output.warning(`${verb} ${output.bold(`${successCount}/${results.length}`)} ${fileWord}`);
    Deno.exit(1);
  }
}
