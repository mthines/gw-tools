/**
 * Prune command implementation
 * Cleans up worktree information for deleted worktrees
 */

import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';

/**
 * Execute the prune command
 *
 * @param args Command-line arguments for the prune command
 */
export async function executePrune(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showProxyHelp(
      'prune',
      'prune',
      'Clean up worktree information for deleted worktrees',
      [
        'gw prune',
        'gw prune --dry-run',
        'gw prune --verbose',
      ],
    );
    Deno.exit(0);
  }

  await executeGitWorktree('prune', args, 'Worktree information cleaned up');
}
