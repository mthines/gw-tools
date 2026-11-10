/**
 * Git hook commands
 *
 * - `gw install-hook`: manage the native git `post-checkout` hook that makes
 *   plain `git worktree add` run gw's post-checkout hooks and autoCopyFiles
 * - `gw _post-worktree-add`: internal entry point invoked by that git hook
 */

import { parse as parseJsonc } from '@std/jsonc';
import { relative } from '@std/path';
import { loadConfig, resolveConfigPaths } from '../lib/config.ts';
import { copyFiles } from '../lib/file-ops.ts';
import {
  installGitHook,
  isGitHookEnabled,
  isGitHookInstalled,
  isZeroOid,
  resolveFrom,
  uninstallGitHook,
} from '../lib/git-hook.ts';
import { getCurrentBranch, listWorktrees } from '../lib/git-utils.ts';
import { executeHooks, type HookVariables } from '../lib/hooks.ts';
import * as output from '../lib/output.ts';
import { findGitRoot, resolveWorktreePath } from '../lib/path-resolver.ts';

function showInstallHookHelp(): void {
  console.log(`gw install-hook - Make plain 'git worktree add' run gw hooks

Usage:
  gw install-hook [options]

Options:
  --uninstall     Remove the gw block from the repository's post-checkout hook
  --status        Show whether the hook is installed and enabled
  -h, --help      Show this help message

Description:
  Installs a small block into the repository's git post-checkout hook. When a
  worktree is created with plain 'git worktree add' (not 'gw checkout'), the
  hook runs, in the new worktree:

    - autoCopyFiles from .gw/config.json
    - hooks.checkout.post commands (e.g. "pnpm install")

  Pre-checkout hooks cannot run: git has no pre-add hook. 'gw checkout' already
  runs everything itself, so nothing runs twice.

  This is installed automatically for repositories with a .gw/config.json.
  To disable it, set in .gw/config.json:

    { "hooks": { "gitWorktreeAdd": false } }

  The setting is read each time the hook fires, so no reinstall is needed.
  An existing post-checkout hook is preserved; gw adds its block at the top.
  If core.hooksPath is set (e.g. Husky), add this line to your hook manually:

    gw _post-worktree-add "$@"

Examples:
  gw install-hook
  gw install-hook --status
  gw install-hook --uninstall
`);
}

/**
 * Execute `gw install-hook`
 */
export async function executeInstallHook(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    showInstallHookHelp();
    Deno.exit(0);
  }

  if (args.includes('--status')) {
    const installed = await isGitHookInstalled();
    const { configPath } = await resolveConfigPaths();
    let enabled = true;
    if (configPath) {
      enabled = await readHookEnabled(configPath);
    }
    console.log(`Git hook:  ${installed ? 'installed' : 'not installed'}`);
    console.log(`Config:    ${enabled ? 'enabled' : 'disabled'} (hooks.gitWorktreeAdd)`);
    return;
  }

  if (args.includes('--uninstall')) {
    const removed = await uninstallGitHook();
    if (removed) {
      output.success('Removed gw block from the post-checkout git hook');
      console.log(
        output.dim(
          'Note: gw re-installs it on the next gw command unless you set hooks.gitWorktreeAdd to false in .gw/config.json.\n'
        )
      );
    } else {
      output.info('No gw git hook found');
    }
    return;
  }

  const result = await installGitHook();
  if (result.status === 'installed') {
    output.success(`Installed git hook: ${output.path(result.hookPath!)}`);
    console.log("'git worktree add' now runs autoCopyFiles and post-checkout hooks.\n");
  } else if (result.status === 'already-installed') {
    output.info(`Git hook already installed: ${output.path(result.hookPath!)}`);
  } else {
    output.warning(`Could not install git hook: ${result.reason}`);
    Deno.exit(1);
  }
}

async function readHookEnabled(configPath: string): Promise<boolean> {
  try {
    const base = parseJsonc(await Deno.readTextFile(configPath)) as Record<string, unknown>;
    let merged = base;
    try {
      const local = parseJsonc(await Deno.readTextFile(configPath.replace(/config\.json$/, 'config.local.json')));
      merged = { ...base, ...(local as Record<string, unknown>) };
    } catch {
      // no local override
    }
    return isGitHookEnabled(merged as { hooks?: { gitWorktreeAdd?: boolean } });
  } catch {
    return true;
  }
}

/**
 * Silently make sure the git hook is installed for repos that use gw and
 * haven't disabled it. Best-effort: never throws and never prints.
 */
export async function ensureGitHookInstalled(): Promise<void> {
  try {
    const { configPath } = await resolveConfigPaths();
    if (!configPath) return;
    if (!(await readHookEnabled(configPath))) return;
    await installGitHook();
  } catch {
    // best-effort
  }
}

async function gitOut(args: string[]): Promise<string> {
  const { code, stdout } = await new Deno.Command('git', { args, stdout: 'piped', stderr: 'null' }).output();
  return code === 0 ? new TextDecoder().decode(stdout).trim() : '';
}

/**
 * Execute `gw _post-worktree-add <prev-head> <new-head> <flag>`
 *
 * Invoked by git's post-checkout hook (cwd = the checked-out worktree). Only
 * acts for a newly created linked worktree. Never exits non-zero.
 */
export async function executePostWorktreeAdd(args: string[]): Promise<void> {
  try {
    // Only a new worktree has an all-zeros previous HEAD
    if (!isZeroOid(args[0])) return;

    const cwd = Deno.cwd();

    // Must be a linked worktree (git-dir differs from the shared common dir)
    const gitDir = await gitOut(['rev-parse', '--absolute-git-dir']);
    const commonDir = await gitOut(['rev-parse', '--path-format=absolute', '--git-common-dir']);
    if (!gitDir || !commonDir || resolveFrom(cwd, gitDir) === resolveFrom(cwd, commonDir)) return;

    const worktreePath = await gitOut(['rev-parse', '--show-toplevel']);
    if (!worktreePath) return;
    const gitRoot = await findGitRoot(worktreePath);

    // Locate config without auto-creating one; fall back to the repo root for
    // layouts where worktrees aren't nested inside it.
    let { configPath } = await resolveConfigPaths();
    if (!configPath) {
      // Not nested under a config (e.g. bare layout where main's config is uncommitted): try the repo root,
      // then every existing worktree.
      for (const dir of [gitRoot, ...(await listWorktrees()).filter((w) => !w.bare).map((w) => w.path)]) {
        Deno.chdir(dir);
        ({ configPath } = await resolveConfigPaths());
        if (configPath) break;
      }
    }
    if (!configPath) return;

    const { config } = await loadConfig();
    if (!isGitHookEnabled(config)) return;

    const worktreeName = relative(gitRoot, worktreePath) || worktreePath;
    const branch = (await getCurrentBranch(worktreePath)) || worktreeName;
    console.log(`\ngw: new worktree detected (${output.bold(worktreeName)})`);

    // Copy autoCopyFiles from the default worktree
    if (config.autoCopyFiles && config.autoCopyFiles.length > 0) {
      let sourcePath = resolveWorktreePath(gitRoot, config.defaultBranch || 'main');
      try {
        await Deno.stat(sourcePath);
      } catch {
        sourcePath = gitRoot;
      }
      if (sourcePath !== worktreePath) {
        console.log('\nCopying files...');
        try {
          const results = await copyFiles(sourcePath, worktreePath, config.autoCopyFiles, false);
          for (const result of results) {
            console.log(`  ${result.success ? output.checkmark() : output.warningSymbol()} ${result.message}`);
          }
        } catch (error) {
          output.warning(`Failed to copy files - ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Post-checkout hooks (warn, don't abort)
    const postHooks = config.hooks?.checkout?.post;
    if (postHooks && postHooks.length > 0) {
      const variables: HookVariables = { worktree: worktreeName, worktreePath, gitRoot, branch };
      const { allSuccessful } = await executeHooks(postHooks, worktreePath, variables, 'post-checkout', false);
      if (!allSuccessful) output.warning('One or more post-checkout hooks failed');
    }
  } catch (error) {
    output.warning(`gw worktree hook failed - ${error instanceof Error ? error.message : String(error)}`);
  }
}
