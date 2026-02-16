/**
 * Move command implementation
 * Moves a worktree to a new location
 */

import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';

/**
 * Execute the move command
 *
 * @param args Command-line arguments for the move command
 */
export async function executeMove(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showProxyHelp('move', 'move', 'Move a worktree to a new location', [
      'gw move feat-branch ../new-location',
      'gw mv feat-branch ../new-location  # Short alias',
    ]);
    Deno.exit(0);
  }

  await executeGitWorktree('move', args, 'Worktree moved successfully');
}
