/**
 * Add command implementation
 * Creates a new worktree and optionally copies files
 */

import { basename } from '$std/path';
import { loadConfig } from '../lib/config.ts';
import { copyFiles } from '../lib/file-ops.ts';
import { resolveWorktreePath } from '../lib/path-resolver.ts';

/**
 * Parse add command arguments
 */
function parseAddArgs(args: string[]): {
  help: boolean;
  worktreeName?: string;
  files: string[];
  gitArgs: string[];
} {
  const result = {
    help: false,
    worktreeName: undefined as string | undefined,
    files: [] as string[],
    gitArgs: [] as string[],
  };

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    result.help = true;
    return result;
  }

  // First positional arg is the worktree name (required)
  // All other args are either git flags or files to copy
  // Git flags start with - or --, files don't

  let foundWorktreeName = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

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
      (arg === '--detach' || arg === '--force' || arg === '-f' ||
        arg === '--quiet' || arg === '-q' || arg === '--guess-remote')
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

If autoCopyFiles is configured in .gw/config.json, those files will be
automatically copied to the new worktree. You can override this by passing
specific files as arguments.

Arguments:
  <worktree-name>         Name or path for the new worktree
  [files...]              Optional files to copy (overrides config)

Options:
  All git worktree add options are supported:
    -b <branch>           Create a new branch
    -B <branch>           Create or reset a branch
    --detach              Detach HEAD in new worktree
    --force, -f           Force checkout even if already checked out
    --track               Track branch from remote
    -h, --help            Show this help message

Examples:
  # Create worktree (auto-copy files if configured)
  gw add feat/new-feature

  # Create worktree with new branch
  gw add feat/new-feature -b my-branch

  # Create worktree and copy specific files (overrides config)
  gw add feat/new-feature .env secrets/

  # Create worktree without copying any files
  gw add feat/new-feature

Configuration:
  To enable auto-copy, use 'gw init' with --auto-copy-files:

  gw init --root /path/to/repo.git --auto-copy-files .env,secrets/

  This creates a config with:
  {
    "root": "/path/to/repo.git",
    "defaultSource": "main",
    "autoCopyFiles": [".env", "secrets/"]
  }
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
    console.error('Error: Worktree name is required\n');
    showAddHelp();
    Deno.exit(1);
  }

  // Load config
  const { config, gitRoot } = await loadConfig();

  // Build git worktree add command
  const gitCmd = [
    'git',
    'worktree',
    'add',
    ...parsed.gitArgs,
    parsed.worktreeName,
  ];

  // Execute git worktree add
  console.log(`Creating worktree: ${parsed.worktreeName}`);

  const gitProcess = new Deno.Command(gitCmd[0], {
    args: gitCmd.slice(1),
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await gitProcess.output();

  if (code !== 0) {
    console.error(`\nFailed to create worktree`);
    Deno.exit(code);
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

  // If no files to copy, we're done
  if (filesToCopy.length === 0) {
    console.log('\nDone!');
    return;
  }

  // Copy files
  console.log(`\nCopying files to new worktree...`);

  const sourceWorktree = config.defaultSource || 'main';
  const sourcePath = resolveWorktreePath(gitRoot, sourceWorktree);

  // Extract just the worktree name (last component of path)
  const worktreeNameOnly = basename(parsed.worktreeName);
  const targetPath = resolveWorktreePath(gitRoot, worktreeNameOnly);

  try {
    const results = await copyFiles(
      sourcePath,
      targetPath,
      filesToCopy,
      false,
    );

    // Display results
    console.log();
    for (const result of results) {
      if (result.success) {
        console.log(`  ✓ ${result.message}`);
      } else {
        console.log(`  ⚠ ${result.message}`);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `\nDone! Copied ${successCount}/${results.length} ${
        successCount === 1 ? 'file' : 'files'
      }`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nWarning: Failed to copy files - ${message}`);
    console.log('Worktree was created successfully, but file copying failed.');
  }
}
