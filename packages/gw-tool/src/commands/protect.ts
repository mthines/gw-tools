/**
 * Protect command implementation
 * Marks a branch as protected, exempting it from auto-clean and manual clean
 */

import { loadConfig, saveConfig } from '../lib/config.ts';
import * as output from '../lib/output.ts';

/**
 * Resolve the branch name to protect.
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
 * Show help for the protect command
 */
function showProtectHelp(): void {
  console.log(`gw protect - Mark a branch as protected from cleanup

Usage:
  gw protect [branch]

Arguments:
  [branch]    Branch name to protect (default: current branch)

Options:
  -h, --help  Show this help message

Description:
  Marks a branch as protected, preventing it from being removed by
  'gw clean' (both interactive and auto modes) and auto-clean.

  If no branch is given, the current branch is detected from the
  working directory automatically.

  The protection list is stored in 'protectedBranches' inside
  .gw/config.json and is safe to commit to your repository.

  Note: The defaultBranch, 'main', 'master', and 'gw_root' are
  always protected regardless of this setting.

Examples:
  # Protect the current branch
  gw protect

  # Protect a specific branch
  gw protect staging

  # Remove protection
  gw unprotect staging
`);
}

/**
 * Execute the protect command
 *
 * @param args Command-line arguments for the protect command
 */
export async function executeProtect(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    showProtectHelp();
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

  const { config, gitRoot } = await loadConfig();

  const existing = config.protectedBranches ?? [];

  if (existing.includes(branch)) {
    output.info(`Branch ${output.bold(branch)} is already protected`);
    Deno.exit(0);
  }

  const updated = [...existing, branch];
  await saveConfig(gitRoot, { ...config, protectedBranches: updated });

  output.success(`Branch ${output.bold(branch)} is now protected`);
}
