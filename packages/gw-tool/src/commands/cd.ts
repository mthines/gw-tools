/**
 * CD command implementation
 * Outputs the path to a worktree for use with cd command
 */

import * as output from '../lib/output.ts';

/**
 * Execute the cd command
 *
 * @param args Command-line arguments for the cd command
 */
export async function executeCd(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showCdHelp();
    Deno.exit(0);
  }

  // Get worktree pattern from arguments
  const pattern = args[0];
  if (!pattern) {
    output.error('Error: Worktree name or pattern required');
    console.error('\nUsage: gw cd <worktree>');
    console.error('Then: cd $(gw cd <worktree>)');
    Deno.exit(1);
  }

  // Get list of worktrees from git
  const gitCmd = new Deno.Command('git', {
    args: ['worktree', 'list', '--porcelain'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await gitCmd.output();

  if (code !== 0) {
    const errorMsg = new TextDecoder().decode(stderr);
    output.error(`Failed to get worktree list: ${errorMsg}`);
    Deno.exit(1);
  }

  // Parse worktree list
  const outputText = new TextDecoder().decode(stdout);
  const lines = outputText.trim().split('\n');
  const worktrees: Array<{ path: string; branch: string }> = [];

  let currentWorktree: { path?: string; branch?: string } = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      currentWorktree.path = line.substring('worktree '.length);
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring('branch '.length).split('/').pop() || '';
    } else if (line === '') {
      if (currentWorktree.path) {
        worktrees.push({
          path: currentWorktree.path,
          branch: currentWorktree.branch || '',
        });
      }
      currentWorktree = {};
    }
  }

  // Handle last worktree if no trailing newline
  if (currentWorktree.path) {
    worktrees.push({
      path: currentWorktree.path,
      branch: currentWorktree.branch || '',
    });
  }

  // Find matching worktrees
  const matches = worktrees.filter((wt) => {
    // Match against branch name or path
    const pathMatch = wt.path.toLowerCase().includes(pattern.toLowerCase());
    const branchMatch = wt.branch.toLowerCase().includes(pattern.toLowerCase());
    return pathMatch || branchMatch;
  });

  if (matches.length === 0) {
    output.error(`No worktree found matching: ${pattern}`);
    Deno.exit(1);
  }

  if (matches.length > 1) {
    output.error(`Multiple worktrees match "${pattern}":`);
    matches.forEach((wt) => {
      console.error(`  ${wt.branch || '(detached)'} -> ${wt.path}`);
    });
    console.error('\nPlease be more specific.');
    Deno.exit(1);
  }

  // Output the path to stdout (only thing that goes to stdout)
  console.log(matches[0].path);
}

/**
 * Display help text for the cd command
 */
function showCdHelp(): void {
  console.log(`
gw cd - Get the path to a worktree for directory navigation

Usage:
  gw cd <worktree>
  cd $(gw cd <worktree>)

Arguments:
  <worktree>    Name or partial name of the worktree
                Matches against branch name or path

Description:
  Finds a worktree by name or partial match and outputs its absolute path.
  Designed to be used with the 'cd' command in a subshell.

  The command searches all worktrees and matches against both the branch
  name and the worktree path. If multiple matches are found, it will
  error and show all matches so you can be more specific.

Examples:
  # Navigate to a worktree by exact name
  cd $(gw cd feat-branch)

  # Navigate using partial match
  cd $(gw cd feat)

  # List matching worktrees (if multiple matches)
  gw cd api
  # Output: Multiple worktrees match "api":
  #   api-refactor -> /path/to/repo/api-refactor
  #   graphql-api -> /path/to/repo/graphql-api

  # Create an alias in your shell config for convenience:
  # alias cw='cd $(gw cd "$@")'
  # Then use: cw feat-branch

Tips:
  - Use unique prefixes for quick navigation: "gw cd feat" for "feat-branch"
  - Add shell aliases for even faster workflow
  - Errors go to stderr, so failed cd won't navigate to error text
`);
}
