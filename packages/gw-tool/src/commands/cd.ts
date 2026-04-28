/**
 * CD command implementation
 * Outputs the path to a worktree for use with cd command
 */

import * as output from '../lib/output.ts';
import {
  hasUncommittedChanges,
  listWorktrees,
} from '../lib/git-utils.ts';
import { isShellIntegrationInstalled } from '../lib/shell-integration.ts';

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
    const exactMatches = matches.filter((wt) => wt.branch.toLowerCase() === pattern.toLowerCase());
    if (exactMatches.length === 1) {
      resolved = exactMatches;
    }
  }

  if (resolved.length > 1) {
    output.error(`Multiple worktrees match "${pattern}":`);
    const hasDetached = resolved.some((wt) => !wt.branch);
    resolved.forEach((wt) => {
      const label = wt.branch ? wt.branch : `${wt.path.split('/').pop() || wt.path} (detached)`;
      console.error(`  ${label} -> ${wt.path}`);
    });
    if (hasDetached) {
      const detached = resolved.filter((wt) => !wt.branch);
      for (const wt of detached) {
        console.error(`\nhint: Remove detached worktree with: gw remove ${wt.path}`);
      }
    }
    console.error('\nPlease be more specific.');
    Deno.exit(1);
  }

  const target = resolved[0];

  // Check if the pattern matches a local branch that differs from
  // the worktree's current branch. Offer to switch when interactive.
  if (
    Deno.stdin.isTerminal() &&
    target.branch !== pattern &&
    target.branch.toLowerCase() !== pattern.toLowerCase()
  ) {
    // Check if pattern is actually a local branch name
    const branchCheckCmd = new Deno.Command('git', {
      args: ['rev-parse', '--verify', pattern],
      stdout: 'null',
      stderr: 'null',
    });
    const branchCheckResult = await branchCheckCmd.output();

    if (branchCheckResult.code === 0) {
      // Pattern is a valid branch but the worktree has a different
      // one checked out — ask whether to switch
      console.error('');
      console.error(
        `Worktree at ${output.path(target.path)} is on ` +
          `branch ${output.bold(target.branch)}, ` +
          `not ${output.bold(pattern)}.`
      );

      const answer = prompt(`Switch to ${output.bold(pattern)}? [Y/n]: `);

      if (
        answer === null ||
        answer === '' ||
        answer.toLowerCase() === 'y' ||
        answer.toLowerCase() === 'yes'
      ) {
        // Safety: refuse if there are uncommitted changes
        if (await hasUncommittedChanges(target.path)) {
          output.error(
            `Worktree has uncommitted changes on branch ${output.bold(target.branch)}`
          );
          console.error(
            `Commit or stash your changes before switching to ${output.bold(pattern)}.`
          );
          Deno.exit(1);
        }

        const switchCmd = new Deno.Command('git', {
          args: ['-C', target.path, 'checkout', pattern],
          stdout: 'inherit',
          stderr: 'inherit',
        });
        const { code: switchCode } = await switchCmd.output();

        if (switchCode !== 0) {
          output.error(`Failed to switch to branch ${output.bold(pattern)}`);
          Deno.exit(switchCode);
        }

        output.success(`Switched to branch ${output.bold(pattern)}`);
      }
    }
  }

  // Output the path to stdout (only thing that goes to stdout)
  console.log(target.path);

  // Show helpful tip if shell integration not installed and output is a TTY
  // When piped (e.g., cd $(gw cd branch)), stdout is not a TTY so warning won't appear
  if (Deno.stdout.isTerminal()) {
    const hasShellIntegration = await isShellIntegrationInstalled();
    if (!hasShellIntegration) {
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
      console.error('   Then restart your shell or source the config file.');
    }
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
