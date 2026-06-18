/**
 * Unprotect command implementation
 * Removes a branch from the protected list, allowing cleanup to remove it
 */

import { loadRootConfig, saveConfig } from '../lib/config.ts';
import * as output from '../lib/output.ts';

/**
 * Resolve the branch name to unprotect.
 * If a branch name is provided, use it directly.
 * Otherwise, auto-detect from the current working directory via git.
 *
 * @returns The resolved branch name
 */
async function resolveBranch(branch: string | undefined): Promise<string> {
  if (branch) {
    return branch;
  }

  const cmd = new Deno.Command('git', {
    args: ['rev-parse', '--abbrev-ref', 'HEAD'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    const errMsg = new TextDecoder().decode(stderr).trim();
    throw new Error(`Could not detect current branch: ${errMsg || 'not inside a git repository'}`);
  }

  const detected = new TextDecoder().decode(stdout).trim();

  if (!detected || detected === 'HEAD') {
    throw new Error('Could not detect current branch: cwd is in detached HEAD state');
  }

  return detected;
}

/**
 * Show help for the unprotect command
 */
function showUnprotectHelp(): void {
  console.log(`gw unprotect - Remove a branch from the protected list

Usage:
  gw unprotect [branch]

Arguments:
  [branch]    Branch name to unprotect (default: current branch)

Options:
  -h, --help  Show this help message

Description:
  Removes a branch from the 'protectedBranches' list in .gw/config.json,
  allowing 'gw clean' and auto-clean to remove it again.

  If no branch is given, the current branch is detected from the
  working directory automatically.

  Note: The defaultBranch, 'main', 'master', and 'gw_root' are always
  protected and cannot be unprotected via this command.

Examples:
  # Unprotect the current branch
  gw unprotect

  # Unprotect a specific branch
  gw unprotect staging
`);
}

/**
 * Execute the unprotect command
 *
 * @param args Command-line arguments for the unprotect command
 */
export async function executeUnprotect(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    showUnprotectHelp();
    Deno.exit(0);
  }

  const branchArg = args.find((a) => !a.startsWith('-'));

  let branch: string;
  try {
    branch = await resolveBranch(branchArg);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    output.error(message);
    Deno.exit(1);
  }

  // protectedBranches lives in the git-root config — see protect.ts for
  // the rationale. unprotect edits the same canonical list.
  const { config, gitRoot } = await loadRootConfig();

  const existing = config.protectedBranches ?? [];

  if (!existing.includes(branch)) {
    output.warning(`Branch ${output.bold(branch)} is not in the protected list`);
    Deno.exit(0);
  }

  const updated = existing.filter((b) => b !== branch);

  // Remove the field entirely when the list is empty (cleaner config)
  const newConfig = { ...config };
  if (updated.length === 0) {
    delete newConfig.protectedBranches;
  } else {
    newConfig.protectedBranches = updated;
  }

  await saveConfig(gitRoot, newConfig);

  output.success(`Branch ${output.bold(branch)} is no longer protected`);
}
