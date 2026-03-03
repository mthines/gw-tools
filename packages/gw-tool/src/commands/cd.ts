/**
 * CD command implementation
 * Outputs the path to a worktree for use with cd command
 */

import * as output from '../lib/output.ts';
import { listWorktrees } from '../lib/git-utils.ts';

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
  let worktrees: Array<{ path: string; branch: string }>;
  try {
    worktrees = await listWorktrees();
  } catch (err) {
    output.error(`Failed to get worktree list: ${err instanceof Error ? err.message : String(err)}`);
    Deno.exit(1);
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

  // If multiple matches, check for a single exact branch match
  let resolved = matches;
  if (matches.length > 1) {
    const exactMatches = matches.filter(
      (wt) => wt.branch.toLowerCase() === pattern.toLowerCase()
    );
    if (exactMatches.length === 1) {
      resolved = exactMatches;
    }
  }

  if (resolved.length > 1) {
    output.error(`Multiple worktrees match "${pattern}":`);
    resolved.forEach((wt) => {
      console.error(`  ${wt.branch || '(detached)'} -> ${wt.path}`);
    });
    console.error('\nPlease be more specific.');
    Deno.exit(1);
  }

  // Output the path to stdout (only thing that goes to stdout)
  console.log(resolved[0].path);

  // If stdout is a TTY, user is running directly without shell integration
  // (Shell function captures stdout, so it won't be a TTY)
  if (Deno.stdout.isTerminal()) {
    const shell = Deno.env.get('SHELL') || '';
    const shellName = shell.split('/').pop() || '';

    let configFile = '~/.zshrc';
    let evalLine = 'eval "$(gw install-shell)"';

    if (shellName === 'bash') {
      configFile = '~/.bashrc';
    } else if (shellName === 'fish') {
      configFile = '~/.config/fish/config.fish';
      evalLine = 'gw install-shell | source';
    }

    console.error('');
    console.error('💡 Tip: Add shell integration for automatic navigation:');
    console.error(`   echo '${evalLine}' >> ${configFile}`);
  }
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
  name and the worktree path. If multiple matches are found, an exact
  branch name match is preferred. Otherwise, it will error and show all
  matches so you can be more specific.

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
