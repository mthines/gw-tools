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
    console.error("Error: Target worktree and files required\n");
    showCopyHelp();
    Deno.exit(1);
  }

  // 4. Load config
  const { config, gitRoot } = await loadConfig();

  // 5. Resolve paths
  const sourceWorktree = parsed.from || config.defaultSource || "main";
  const sourcePath = resolveWorktreePath(gitRoot, sourceWorktree);
  const targetPath = resolveWorktreePath(gitRoot, parsed.target);

  // 6. Validate paths exist
  try {
    await validatePathExists(sourcePath, "directory");
  } catch (_error) {
    console.error(`Error: Source worktree not found: ${sourcePath}`);
    console.error(
      `Make sure '${sourceWorktree}' worktree exists in ${gitRoot}`,
    );
    Deno.exit(1);
  }

  try {
    await validatePathExists(targetPath, "directory");
  } catch (_error) {
    console.error(`Error: Target worktree not found: ${targetPath}`);
    console.error(
      `Make sure '${parsed.target}' worktree exists in ${gitRoot}`,
    );
    Deno.exit(1);
  }

  // 7. Copy files
  const dryRunNotice = parsed.dryRun ? " (DRY RUN)" : "";
  console.log(
    `Copying from ${sourceWorktree} to ${parsed.target}${dryRunNotice}...`,
  );

  const results = await copyFiles(
    sourcePath,
    targetPath,
    parsed.files,
    parsed.dryRun,
  );

  // 8. Display results
  console.log();
  for (const result of results) {
    if (result.success) {
      console.log(`  ✓ ${result.message}`);
    } else {
      console.log(`  ⚠ ${result.message}`);
    }
  }

  // 9. Summary
  const successCount = results.filter((r) => r.success).length;
  const verb = parsed.dryRun ? "Would copy" : "Copied";
  console.log(
    `\nDone! ${verb} ${successCount}/${results.length} ${
      successCount === 1 ? "file" : "files"
    }`,
  );

  // Exit with error code if some files failed
  if (successCount < results.length) {
    Deno.exit(1);
  }
}
