/**
 * Copy command implementation
 */

import { basename } from '$std/path';
import { parseCopyArgs, showCopyHelp } from '../lib/cli.ts';
import { loadConfig } from '../lib/config.ts';
import { copyFiles } from '../lib/file-ops.ts';
import { getCurrentWorktreePath } from '../lib/git-utils.ts';
import { resolveWorktreePath, validatePathExists } from '../lib/path-resolver.ts';
import * as output from '../lib/output.ts';

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

  // 3. Load config (needed for autoCopyFiles and defaultBranch)
  const { config, gitRoot } = await loadConfig();

  // 4. Resolve target - default to current worktree if not specified
  let target = parsed.target;
  if (!target) {
    const currentWorktreePath = await getCurrentWorktreePath();
    if (!currentWorktreePath) {
      output.error('Target worktree required (not currently inside a worktree)');
      showCopyHelp();
      Deno.exit(1);
    }
    target = basename(currentWorktreePath);
  }

  // 5. Determine files to copy - use autoCopyFiles from config if no files specified
  let filesToCopy = parsed.files;
  if (filesToCopy.length === 0 && config.autoCopyFiles?.length) {
    filesToCopy = config.autoCopyFiles;
  }

  if (filesToCopy.length === 0) {
    output.error('No files to sync. Specify files or configure autoCopyFiles in .gw/config.json');
    showCopyHelp();
    Deno.exit(1);
  }

  // 6. Resolve paths
  const sourceWorktree = parsed.from || config.defaultBranch || 'main';
  const sourcePath = resolveWorktreePath(gitRoot, sourceWorktree);
  const targetPath = resolveWorktreePath(gitRoot, target);

  // 7. Validate paths exist
  try {
    await validatePathExists(sourcePath, 'directory');
  } catch (_error) {
    output.error(`Source worktree not found: ${output.path(sourcePath)}`);
    console.error(`Make sure '${output.bold(sourceWorktree)}' worktree exists in ${output.path(gitRoot)}\n`);
    Deno.exit(1);
  }

  try {
    await validatePathExists(targetPath, 'directory');
  } catch (_error) {
    output.error(`Target worktree not found: ${output.path(targetPath)}`);
    console.error(`Make sure '${output.bold(target)}' worktree exists in ${output.path(gitRoot)}\n`);
    Deno.exit(1);
  }

  // 8. Copy files
  const dryRunNotice = parsed.dryRun ? output.dim(' (DRY RUN)') : '';
  console.log(`Copying from ${output.bold(sourceWorktree)} to ${output.bold(target)}${dryRunNotice}...\n`);

  const results = await copyFiles(sourcePath, targetPath, filesToCopy, parsed.dryRun);

  // 9. Display results
  for (const result of results) {
    if (result.success) {
      console.log(`  ${output.checkmark()} ${result.message}`);
    } else {
      console.log(`  ${output.warningSymbol()} ${result.message}`);
    }
  }

  // 10. Summary
  const successCount = results.filter((r) => r.success).length;
  const verb = parsed.dryRun ? 'Would copy' : 'Copied';
  const fileWord = successCount === 1 ? 'file' : 'files';

  if (successCount === results.length) {
    output.success(`${verb} ${output.bold(`${successCount}/${results.length}`)} ${fileWord}`);
  } else {
    output.warning(`${verb} ${output.bold(`${successCount}/${results.length}`)} ${fileWord}`);
    Deno.exit(1);
  }
}
