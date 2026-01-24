/**
 * Repair command implementation
 * Repairs worktree administrative files
 */

import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';

/**
 * Execute the repair command
 *
 * @param args Command-line arguments for the repair command
 */
export async function executeRepair(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showProxyHelp(
      'repair',
      'repair',
      'Repair worktree administrative files',
      [
        'gw repair',
        'gw repair /path/to/worktree',
      ],
    );
    Deno.exit(0);
  }

  await executeGitWorktree('repair', args, 'Worktree administrative files repaired');
}
