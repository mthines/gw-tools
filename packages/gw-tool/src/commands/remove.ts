/**
 * Remove command implementation
 * Removes a worktree from the repository
 */

import { resolve } from '@std/path';
import { loadConfig } from '../lib/config.ts';
import {
  deleteLocalBranch,
  hasUncommittedChanges,
  hasUnpushedCommits,
  isBranchCheckedOutElsewhere,
  listWorktrees,
  pruneOrphanBranches,
  type WorktreeInfo,
} from '../lib/git-utils.ts';
import { resolveWorktreePath } from '../lib/path-resolver.ts';
import { containsGlob, matchWorktreesByPattern, worktreeName } from '../lib/glob-match.ts';
import { isProtectedBranch } from '../lib/branch-protection.ts';
import * as output from '../lib/output.ts';

/**
 * Check if a path is inside or equal to another path
 */
function isPathInside(childPath: string, parentPath: string): boolean {
  const child = resolve(childPath);
  const parent = resolve(parentPath);
  return child === parent || child.startsWith(parent + '/');
}

/**
 * What kind of target a positional argument resolves to.
 */
interface ResolvedTarget {
  /** User-facing label (typically the relative worktree name) */
  name: string;
  /** Absolute path on disk */
  path: string;
  /** Branch name, when known */
  branch?: string;
  /** True when the worktree is registered with git */
  isValidWorktree: boolean;
  /** True when path exists on disk but is not a registered worktree */
  isLeftoverDirectory: boolean;
}

/**
 * Resolve a single literal worktree argument (no glob characters).
 * Returns null when nothing matches; the caller decides whether that is fatal.
 */
async function resolveLiteralTarget(
  arg: string,
  worktrees: WorktreeInfo[],
  gitRoot: string
): Promise<ResolvedTarget | null> {
  const exactMatch = worktrees.find((wt) => {
    const wtName = wt.path.split('/').pop() || '';
    if (wtName === arg) return true;
    if (wt.path === arg) return true;
    const resolvedPath = resolveWorktreePath(gitRoot, arg);
    if (wt.path === resolvedPath) return true;
    return false;
  });

  if (exactMatch) {
    return {
      name: worktreeName(exactMatch, gitRoot),
      path: exactMatch.path,
      branch: exactMatch.branch,
      isValidWorktree: true,
      isLeftoverDirectory: false,
    };
  }

  // Strip a trailing slash so `gw rm tmp/` and `gw rm tmp` behave identically.
  // Without this, `resolvedPath + '/'` would produce a `//` that never matches
  // any worktree path, bypassing the parent-of-worktrees guard.
  const resolvedPath = resolveWorktreePath(gitRoot, arg).replace(/\/+$/, '');
  try {
    const stat = await Deno.stat(resolvedPath);
    if (stat.isDirectory || stat.isFile) {
      const isParentOfWorktrees = worktrees.some((wt) => wt.path.startsWith(resolvedPath + '/'));
      if (isParentOfWorktrees) {
        const childWorktrees = worktrees.filter((wt) => wt.path.startsWith(resolvedPath + '/'));
        const argNoTrailingSlash = arg.replace(/\/+$/, '');
        console.log('');
        output.error(`${output.bold(arg)} is not a worktree. It's a directory containing worktrees.`);
        console.log('');
        console.log(`To remove all worktrees under ${output.bold(argNoTrailingSlash)}:`);
        console.log(`  ${output.bold(`gw rm ${argNoTrailingSlash}/*`)}`);
        console.log('');
        console.log('Or pick a specific worktree:');
        for (const wt of childWorktrees) {
          const branchInfo = wt.branch ? ` [${wt.branch}]` : '';
          console.log(`  ${output.bold(worktreeName(wt, gitRoot))} -> ${wt.path}${branchInfo}`);
        }
        console.log('');
        Deno.exit(1);
      }
      return {
        name: arg,
        path: resolvedPath,
        isValidWorktree: false,
        isLeftoverDirectory: true,
      };
    }
  } catch {
    // Path doesn't exist — fall through to similar-match suggestion
  }

  return null;
}

function printRemovalPreview(targets: ResolvedTarget[]): void {
  console.log('');
  console.log(`The following ${output.bold(String(targets.length))} worktree(s) will be removed:`);
  console.log('');
  for (const t of targets) {
    const branchInfo = t.branch ? ` [${t.branch}]` : '';
    console.log(`  ${output.bold(t.name)} -> ${t.path}${branchInfo}`);
  }
  console.log('');
}

async function removeLeftoverDirectory(target: ResolvedTarget, currentCwd: string): Promise<boolean> {
  console.log('');
  output.warning(`${output.bold(target.name)} is not a valid worktree, but a leftover directory exists.`);
  console.log(`Automatically removing...`);

  const isRemovingCwd = isPathInside(currentCwd, target.path);

  try {
    if (isRemovingCwd) {
      try {
        const { gitRoot } = await loadConfig();
        Deno.chdir(gitRoot);
      } catch {
        Deno.chdir(resolve(target.path, '..'));
      }
    }
    await Deno.remove(target.path, { recursive: true });
    output.success(`Leftover directory ${output.bold(`"${target.name}"`)} removed successfully`);
    console.log('');

    try {
      const pruneCmd = new Deno.Command('git', {
        args: ['worktree', 'prune'],
        stdout: 'null',
        stderr: 'null',
      });
      await pruneCmd.output();
    } catch {
      // ignore
    }
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    output.error(`Failed to remove directory: ${errorMsg}`);
    return false;
  }
}

/**
 * Remove a single registered worktree. Honors prompt/force semantics.
 *
 * `interactive` controls whether dirty worktrees trigger a confirmation prompt.
 * In batch mode we already confirmed the whole list up front, so dirty ones are
 * skipped with a warning unless --force was set.
 */
async function removeRegisteredWorktree(
  target: ResolvedTarget,
  options: {
    hasForceFlag: boolean;
    preserveBranch: boolean;
    interactive: boolean;
    currentCwd: string;
  }
): Promise<boolean> {
  const { hasForceFlag, preserveBranch, interactive, currentCwd } = options;

  let needsForce = false;
  if (!hasForceFlag) {
    try {
      const [uncommitted, unpushed] = await Promise.all([
        hasUncommittedChanges(target.path),
        hasUnpushedCommits(target.path),
      ]);
      if (uncommitted || unpushed) {
        needsForce = true;
      }
    } catch {
      needsForce = true;
    }
  }

  const isRemovingCwd = isPathInside(currentCwd, target.path);

  if (needsForce && interactive) {
    console.log('');
    const message = isRemovingCwd
      ? `The worktree you're currently in (${output.bold(target.name)}) has uncommitted changes or unpushed commits.`
      : `Worktree ${output.bold(target.name)} has uncommitted changes or unpushed commits.`;
    console.log(message);
    console.log('Removing it will result in data loss.');

    await Deno.stdout.write(new TextEncoder().encode(''));

    const response = prompt(`Are you sure you want to force removal? [Y/n]: `);
    // Default is yes: cancel only on explicit "no"/"n" or EOF (Ctrl-D).
    const normalized = response?.trim().toLowerCase();
    if (normalized === undefined || normalized === 'n' || normalized === 'no') {
      console.log('');
      output.warning(`Skipping ${output.bold(target.name)}.`);
      return false;
    }
    console.log('');
  } else if (needsForce && !interactive) {
    output.warning(
      `Skipping ${output.bold(target.name)}: has uncommitted changes or unpushed commits. Use ${output.bold(
        '--force'
      )} to remove anyway.`
    );
    return false;
  }

  if (isRemovingCwd) {
    try {
      const { gitRoot } = await loadConfig();
      Deno.chdir(gitRoot);
    } catch {
      // continue
    }
  }

  const gitArgs: string[] = ['worktree', 'remove'];
  if (hasForceFlag || needsForce) {
    gitArgs.push('--force');
  }
  gitArgs.push(target.path);

  const gitProcess = new Deno.Command('git', {
    args: gitArgs,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const { code } = await gitProcess.output();
  if (code !== 0) {
    output.error(`Failed to remove worktree ${output.bold(target.name)}`);
    return false;
  }
  output.success(`Worktree ${output.bold(`"${target.name}"`)} removed successfully`);

  if (!preserveBranch && target.branch && target.isValidWorktree) {
    const { config } = await loadConfig();
    const defaultBranch = config.defaultBranch || 'main';

    if (!isProtectedBranch(target.branch, defaultBranch)) {
      const isCheckedOutElsewhere = await isBranchCheckedOutElsewhere(target.branch);
      if (isCheckedOutElsewhere) {
        output.warning(`Branch ${output.bold(target.branch)} is checked out in another worktree, keeping it.`);
      } else {
        const deleteResult = await deleteLocalBranch(target.branch, hasForceFlag);
        if (deleteResult.success) {
          output.success(`Deleted branch ${output.bold(`"${target.branch}"`)}`);
        } else {
          output.warning(`Could not delete branch: ${deleteResult.message}`);
          if (!hasForceFlag && deleteResult.message?.includes('not fully merged')) {
            console.log(`  Use ${output.bold('gw remove --force')} to force delete the branch.`);
          }
        }
      }
    }
  }

  return true;
}

/**
 * Execute the remove command
 */
export async function executeRemove(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`gw remove - Remove a worktree from the repository

Usage:
  gw remove [options] <worktree...>

This command wraps 'git worktree remove' and provides smart confirmation prompts.

Multiple Worktrees & Glob Patterns:
  You can remove several worktrees in one invocation by listing them, or by
  using a glob pattern. When more than one worktree matches, the list is shown
  and you are prompted to confirm before anything is removed.

  Supported pattern syntax:
    *       In a pattern with no '/': matches anything (including '/').
            In a pattern containing '/': matches anything except '/'.
    **      Matches anything including '/' (recursive)
    ?       Matches any single character
    [abc]   Matches one of the listed characters

  Examples of the '/'-aware rule:
    fix*        matches fix/agent0-foo, fix-branch, fixture
    fix/*       matches fix/agent0-foo (direct children only)
    fix/**      matches fix/agent0-foo AND fix/sub/nested

  Examples (no quotes needed with shell integration installed):
    gw rm test/*             Remove every worktree directly under test/
    gw rm feat/**            Remove feat/foo and feat/sub/bar (recursive)
    gw rm spike-?            Remove spike-1, spike-a, etc.

  Without shell integration, zsh users must quote: gw rm 'test/*'
  (Install with: eval "$(gw install-shell)")

  In batch mode, dirty worktrees are skipped with a warning instead of being
  prompted for one-by-one. Use --force to remove them anyway.

Branch Cleanup:
  By default, gw remove also deletes the local branch associated with the worktree.
  This prevents orphaned branches from accumulating.

  - Uses safe delete (git branch -d) which warns if branch has unmerged commits
  - Protected branches (defaultBranch, main, master, gw_root) are never deleted
  - Use --preserve-branch to keep the local branch after removing the worktree

Prompting Behavior:
  - Single worktree, clean: removes immediately
  - Single worktree, dirty: shows the data-loss warning and prompts (default: yes — Enter proceeds)
  - Multiple worktrees: shows the list and prompts once (default: yes — Enter proceeds)
  - To cancel any prompt: type 'n' or 'no', or press Ctrl-D
  - --force: skips all prompts and forces removal (including branch deletion)
  - --yes / -y: skips the confirmation prompt
  - --dry-run / -n: shows the list and exits without removing anything

If you remove the worktree you're currently in:
  - The CLI automatically changes to the git root before removal
  - With shell integration installed, your shell will also navigate to the root
  - Without shell integration, you'll need to manually run: cd "$(gw root)"

Options:
  --preserve-branch   Keep the local branch after removing the worktree
  --yes, -y           Skip confirmation prompts
  --force, -f         Force removal even if worktrees are dirty or locked
  --dry-run, -n       Show what would be removed without removing anything
  -h, --help          Show this help message

Examples:
  gw remove feat-branch                    # Remove worktree AND delete local branch
  gw remove feat-branch --preserve-branch  # Remove worktree but KEEP local branch
  gw remove --yes feat-branch              # Skip confirmation
  gw remove --force feat-branch            # Force removal and branch deletion
  gw rm test/*                             # Remove all worktrees under test/ (with shell integration)
  gw rm 'test/*'                           # Same, explicit quoting if no shell integration
  gw rm feat/* spike/* --yes               # Remove every feat/* and spike/* worktree
  gw rm feat-a feat-b                      # Remove multiple worktrees by name
  gw rm --dry-run feat/*                   # Preview what would be removed (no changes)
  gw rm -n feat/*                          # Same as above using short flag

For full git worktree remove documentation:
  git worktree remove --help
`);
    Deno.exit(0);
  }

  const flags = args.filter((a) => a.startsWith('-'));
  const positionalArgs = args.filter((a) => !a.startsWith('-'));

  if (positionalArgs.length === 0) {
    output.error('Missing worktree name');
    console.log('Usage: gw remove [options] <worktree...>');
    Deno.exit(1);
  }

  const hasYesFlag = flags.includes('--yes') || flags.includes('-y');
  const hasForceFlag = flags.includes('--force') || flags.includes('-f');
  const preserveBranch = flags.includes('--preserve-branch');
  const isDryRun = flags.includes('--dry-run') || flags.includes('-n');

  const { config, gitRoot } = await loadConfig();
  const worktrees = await listWorktrees();
  const defaultBranch = config.defaultBranch || 'main';

  const targets: ResolvedTarget[] = [];
  const skippedProtected: { arg: string; branch: string }[] = [];

  for (const arg of positionalArgs) {
    if (containsGlob(arg)) {
      const matches = matchWorktreesByPattern(worktrees, arg, gitRoot);
      if (matches.length === 0) {
        console.log('');
        output.error(`No worktrees match pattern: ${output.bold(arg)}`);
        console.log('');
        Deno.exit(1);
      }
      for (const m of matches) {
        if (isProtectedBranch(m.branch, defaultBranch)) {
          if (m.branch) {
            skippedProtected.push({ arg, branch: m.branch });
          }
          continue;
        }
        targets.push({
          name: worktreeName(m, gitRoot),
          path: m.path,
          branch: m.branch,
          isValidWorktree: true,
          isLeftoverDirectory: false,
        });
      }
    } else {
      const resolved = await resolveLiteralTarget(arg, worktrees, gitRoot);
      if (!resolved) {
        const similarMatches = worktrees.filter((wt) => {
          const wtName = wt.path.split('/').pop() || '';
          return wtName.includes(arg) || wt.path.includes(arg);
        });
        console.log('');
        output.error(`Worktree ${output.bold(arg)} does not exist.`);
        if (similarMatches.length > 0) {
          console.log('');
          console.log('Did you mean one of these?');
          for (const wt of similarMatches) {
            const branchInfo = wt.branch ? ` [${wt.branch}]` : '';
            console.log(`  ${output.bold(worktreeName(wt, gitRoot))} -> ${wt.path}${branchInfo}`);
          }
        }
        console.log('');
        Deno.exit(1);
      }
      if (resolved.isValidWorktree && resolved.branch && isProtectedBranch(resolved.branch, defaultBranch)) {
        console.log('');
        output.error(`Cannot remove ${output.bold(resolved.branch)} - this is a protected branch.`);
        console.log('');
        if (resolved.branch === defaultBranch) {
          console.log(`The default branch (${output.bold(defaultBranch)}) cannot be removed.`);
        } else {
          console.log(`The ${output.bold('gw_root')} branch is the bare repository root and cannot be removed.`);
        }
        console.log('');
        Deno.exit(1);
      }
      targets.push(resolved);
    }
  }

  const dedupedTargets: ResolvedTarget[] = [];
  const seenPaths = new Set<string>();
  for (const t of targets) {
    if (!seenPaths.has(t.path)) {
      seenPaths.add(t.path);
      dedupedTargets.push(t);
    }
  }

  if (dedupedTargets.length === 0) {
    if (skippedProtected.length > 0) {
      output.warning('All matches were protected branches; nothing to remove.');
    } else {
      output.error('No worktrees to remove.');
    }
    Deno.exit(1);
  }

  if (isDryRun) {
    printRemovalPreview(dedupedTargets);
    if (skippedProtected.length > 0) {
      const branches = [...new Set(skippedProtected.map((s) => s.branch))].join(', ');
      output.info(`Skipping protected branch(es): ${branches}`);
      console.log('');
    }
    output.info(`Dry run: ${dedupedTargets.length} worktree(s) would be removed. No changes made.`);
    return;
  }

  if (dedupedTargets.length > 1) {
    printRemovalPreview(dedupedTargets);
    if (skippedProtected.length > 0) {
      const branches = [...new Set(skippedProtected.map((s) => s.branch))].join(', ');
      output.info(`Skipping protected branch(es): ${branches}`);
      console.log('');
    }
    if (!hasYesFlag && !hasForceFlag) {
      await Deno.stdout.write(new TextEncoder().encode(''));
      const response = prompt(`Remove ${dedupedTargets.length} worktree(s)? [Y/n]: `);
      // Default is yes: cancel only on an explicit "no"/"n" or EOF (Ctrl-D).
      const normalized = response?.trim().toLowerCase();
      if (normalized === undefined || normalized === 'n' || normalized === 'no') {
        console.log('');
        output.error('Removal cancelled.');
        Deno.exit(1);
      }
      console.log('');
    }
  }

  const currentCwd = Deno.cwd();
  const isBatch = dedupedTargets.length > 1;

  let successCount = 0;
  let failureCount = 0;
  let removedCurrentWorktree = false;

  for (const target of dedupedTargets) {
    const removingCwd = isPathInside(currentCwd, target.path);

    let ok = false;
    if (target.isLeftoverDirectory) {
      ok = await removeLeftoverDirectory(target, currentCwd);
    } else if (target.isValidWorktree) {
      ok = await removeRegisteredWorktree(target, {
        hasForceFlag,
        preserveBranch,
        interactive: !isBatch,
        currentCwd,
      });
    }

    if (ok) {
      successCount++;
      if (removingCwd) removedCurrentWorktree = true;
    } else {
      failureCount++;
    }
  }

  try {
    const deleted = await pruneOrphanBranches(defaultBranch);
    if (deleted > 0) {
      output.success(`Pruned ${deleted} orphan branch(es)`);
    }
  } catch {
    // Don't fail remove if orphan branch pruning fails
  }

  if (isBatch) {
    console.log('');
    if (failureCount === 0) {
      output.success(`Removed ${successCount} worktree(s).`);
    } else {
      output.warning(`Removed ${successCount} worktree(s); ${failureCount} skipped or failed.`);
    }
  }

  if (removedCurrentWorktree) {
    console.log('');
    output.warning('You removed the current worktree. Your shell is now in a non-existent directory.');
    console.log(`  Navigate to the git root by running: ${output.bold('cd "$(gw root)"')}`);
    console.log('');
  }

  if (failureCount > 0 && successCount === 0) {
    Deno.exit(1);
  }
}
