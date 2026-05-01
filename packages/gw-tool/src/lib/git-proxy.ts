/**
 * Utility for proxying git worktree commands
 */

import * as output from './output.ts';

/**
 * Execute a git worktree command with all arguments passed through
 *
 * @param subcommand The git worktree subcommand (e.g., 'list', 'remove', 'prune')
 * @param args Arguments to pass to the git command
 * @param successMessage Optional success message to display (if command succeeds with no output)
 */
export async function executeGitWorktree(subcommand: string, args: string[], successMessage?: string): Promise<void> {
  const gitCmd = ['git', 'worktree', subcommand, ...args];

  const gitProcess = new Deno.Command(gitCmd[0], {
    args: gitCmd.slice(1),
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await gitProcess.output();

  if (code !== 0) {
    output.error(`Failed to execute: git worktree ${subcommand}`);
    Deno.exit(code);
  }

  // Show success message if provided and command succeeded
  if (successMessage) {
    output.success(successMessage);
  }
}

/**
 * Show help for a proxied git worktree command
 *
 * @param command The gw command name
 * @param gitSubcommand The git worktree subcommand
 * @param description Brief description of what the command does
 * @param examples Array of example usage strings
 */
export function showProxyHelp(command: string, gitSubcommand: string, description: string, examples: string[]): void {
  console.log(`gw ${command} - ${description}

Usage:
  gw ${command} [options] [arguments]

This command wraps 'git worktree ${gitSubcommand}' and forwards all arguments.

Options:
  All 'git worktree ${gitSubcommand}' options are supported
  -h, --help    Show this help message

Examples:
${examples.map((ex) => `  ${ex}`).join('\n')}

For full git worktree ${gitSubcommand} documentation:
  git worktree ${gitSubcommand} --help
`);
}
