/**
 * Unlock command implementation
 * Unlocks a worktree to allow removal
 */

import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';

/**
 * Execute the unlock command
 *
 * @param args Command-line arguments for the unlock command
 */
export async function executeUnlock(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showProxyHelp('unlock', 'unlock', 'Unlock a worktree to allow removal', ['gw unlock feat-branch']);
    Deno.exit(0);
  }

  await executeGitWorktree('unlock', args, 'Worktree unlocked successfully');
}
