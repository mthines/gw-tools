/**
 * Remove command implementation
 * Removes a worktree from the repository
 */

import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';
import * as output from '../lib/output.ts';

/**
 * Execute the remove command
 *
 * @param args Command-line arguments for the remove command
 */
export async function executeRemove(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showProxyHelp(
      'remove',
      'remove',
      'Remove a worktree from the repository',
      [
        'gw remove feat-branch',
        'gw remove --force feat-branch',
        'gw rm feat-branch  # Short alias',
      ],
    );
    Deno.exit(0);
  }

  // Extract worktree name from args (first non-flag argument)
  let worktreeName: string | undefined;
  for (const arg of args) {
    if (!arg.startsWith('-')) {
      worktreeName = arg;
      break;
    }
  }

  const successMessage = worktreeName
    ? `Worktree ${output.bold(`"${worktreeName}"`)} removed successfully`
    : 'Worktree removed successfully';

  await executeGitWorktree('remove', args, successMessage);
}
