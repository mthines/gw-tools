/**
 * List command implementation
 * Lists all worktrees in the repository, annotating protected branches
 */

import { runAutoClean } from '../lib/auto-clean.ts';
import { loadConfig } from '../lib/config.ts';
import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';
import { listWorktrees } from '../lib/git-utils.ts';
import * as output from '../lib/output.ts';

/**
 * Flags that make machine-readable output incompatible with annotation.
 * When any of these are present we fall back to the raw git proxy.
 */
const RAW_PROXY_FLAGS = new Set(['--porcelain', '-z', '--verbose', '-v']);

/**
 * Determine whether to fall back to the raw git proxy.
 * Returns true when any arg is a known machine-readable or
 * incompatible flag.
 */
export function shouldUseRawProxy(args: string[]): boolean {
  return args.some((arg) => RAW_PROXY_FLAGS.has(arg));
}

/**
 * Render the annotated worktree list.
 * Reproduces git worktree list's default (non-porcelain) format and appends
 * a cyan "[protected]" tag for branches the user has explicitly protected
 * via `gw protect`. System-protected branches (defaultBranch, main, master,
 * gw_root) are deliberately NOT tagged here — that protection is implicit
 * and unrelated to the user-controlled list, and showing it confuses the
 * meaning of the tag.
 */
export async function renderAnnotatedList(protectedBranches: string[]): Promise<void> {
  const worktrees = await listWorktrees();

  if (worktrees.length === 0) {
    return;
  }

  // Compute column widths for aligned output (matching git's default format)
  const maxPathLen = Math.max(...worktrees.map((wt) => wt.path.length));
  const headWidth = 7; // short SHA is 7 chars

  for (const wt of worktrees) {
    const pathCol = wt.path.padEnd(maxPathLen);
    const head = wt.head ? wt.head.slice(0, headWidth) : '0000000';

    let branchCol: string;
    if (wt.bare) {
      branchCol = '(bare)';
    } else if (!wt.branch) {
      branchCol = '(detached HEAD)';
    } else {
      branchCol = `[${wt.branch}]`;
    }

    const isUserProtected = !wt.bare && !!wt.branch && protectedBranches.includes(wt.branch);
    const tag = isUserProtected ? `  ${output.path('[protected]')}` : '';

    console.log(`${pathCol}  ${head}  ${branchCol}${tag}`);
  }
}

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

  // Fall back to raw git proxy for machine-readable or verbose flags
  if (shouldUseRawProxy(args)) {
    await executeGitWorktree('list', args);
    runAutoClean();
    return;
  }

  // Custom renderer with [protected] annotation
  try {
    const { config } = await loadConfig();
    const protectedBranches = config.protectedBranches ?? [];
    await renderAnnotatedList(protectedBranches);
  } catch {
    // If config loading fails or git errors, fall back to raw proxy
    await executeGitWorktree('list', args);
  }

  // Auto-cleanup stale worktrees silently in background
  runAutoClean();
}
