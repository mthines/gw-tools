/**
 * Lock command implementation
 * Locks a worktree to prevent it from being removed
 */

import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';

/**
 * Execute the lock command
 *
 * @param args Command-line arguments for the lock command
 */
export async function executeLock(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showProxyHelp('lock', 'lock', 'Lock a worktree to prevent removal', [
      'gw lock feat-branch',
      'gw lock --reason "Work in progress" feat-branch',
    ]);
    Deno.exit(0);
  }

  await executeGitWorktree('lock', args, 'Worktree locked successfully');
}
