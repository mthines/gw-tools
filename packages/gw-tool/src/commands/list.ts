/**
 * List command implementation
 * Lists all worktrees in the repository
 */

import { promptAndRunAutoClean } from '../lib/auto-clean.ts';
import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';

/**
 * Execute the list command
 *
 * @param args Command-line arguments for the list command
 */
export async function executeList(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showProxyHelp('list', 'list', 'List all worktrees in the repository', [
      'gw list',
      'gw list --porcelain',
      'gw list -v',
      'gw ls  # Short alias',
    ]);
    Deno.exit(0);
  }

  await executeGitWorktree('list', args);

  // Auto-cleanup stale worktrees if enabled (interactive prompt)
  await promptAndRunAutoClean();
}
