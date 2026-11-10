/**
 * Native git `post-checkout` hook integration.
 *
 * Git has no dedicated "worktree add" hook, but it fires `post-checkout` in the
 * new worktree with an all-zeros "previous HEAD" argument. gw installs a small,
 * marker-delimited block into the repo's `post-checkout` hook that forwards
 * that event to `gw _post-worktree-add`, so plain `git worktree add` runs the
 * same post-checkout hooks and autoCopyFiles as `gw checkout`.
 */

import { dirname, isAbsolute, join, resolve } from '@std/path';
import type { Config } from './types.ts';

export const GIT_HOOK_BEGIN = '# >>> gw-tools worktree hook (managed by gw) >>>';
export const GIT_HOOK_END = '# <<< gw-tools worktree hook <<<';

/** Env var set by `gw checkout` on its inner `git worktree add` to avoid running hooks twice. */
export const CHECKOUT_ACTIVE_ENV = 'GW_CHECKOUT_ACTIVE';

/**
 * The shell block installed into `post-checkout`. It is a no-op unless the
 * previous-HEAD argument is all zeros (new worktree), gw is on PATH, and the
 * event did not originate from `gw checkout`.
 */
export function renderHookBlock(): string {
  return [
    GIT_HOOK_BEGIN,
    'if [ -z "$' + CHECKOUT_ACTIVE_ENV + '" ] && [ -n "$1" ] && [ -z "$(printf %s "$1" | tr -d 0)" ] \\',
    '   && command -v gw >/dev/null 2>&1; then',
    '  gw _post-worktree-add "$@" || true',
    'fi',
    GIT_HOOK_END,
  ].join('\n');
}

/** True when the oid is all zeros (SHA-1 or SHA-256), i.e. git's "no previous HEAD". */
export function isZeroOid(oid: string | undefined): boolean {
  return !!oid && /^0+$/.test(oid);
}

/** Whether the file content already contains the gw-managed block. */
export function hasHookBlock(content: string): boolean {
  return content.includes(GIT_HOOK_BEGIN);
}

/** Whether a shebang line (if any) is a POSIX-shell-compatible interpreter. */
function isShellScript(content: string): boolean {
  if (!content.startsWith('#!')) return true; // no shebang: git runs it with sh
  const firstLine = content.split('\n', 1)[0];
  return /\b(sh|bash|zsh|dash|ksh)\b/.test(firstLine);
}

/**
 * Insert the gw block into hook file content, right after the shebang so that
 * an existing hook ending in `exit` can't prevent it from running.
 *
 * @returns the new content, `null` if the block is already present, or
 *   `'unsupported'` when the existing hook is not a shell script.
 */
export function addHookBlock(existing: string | null): string | null | 'unsupported' {
  const block = renderHookBlock();
  if (existing === null || existing.trim() === '') {
    return `#!/bin/sh\n${block}\n`;
  }
  if (hasHookBlock(existing)) return null;
  if (!isShellScript(existing)) return 'unsupported';

  if (existing.startsWith('#!')) {
    const newline = existing.indexOf('\n');
    const shebang = newline === -1 ? existing : existing.slice(0, newline);
    const rest = newline === -1 ? '' : existing.slice(newline + 1);
    return `${shebang}\n${block}\n${rest}`;
  }
  return `#!/bin/sh\n${block}\n${existing}`;
}

/**
 * Remove the gw block. Returns the remaining content, or `null` when nothing
 * but the (default) shebang is left and the file should be deleted.
 */
export function removeHookBlock(content: string): string | null {
  const start = content.indexOf(GIT_HOOK_BEGIN);
  const endIdx = content.indexOf(GIT_HOOK_END);
  if (start === -1 || endIdx === -1 || endIdx < start) return content;

  const after = content.slice(endIdx + GIT_HOOK_END.length).replace(/^\n/, '');
  const result = content.slice(0, start) + after;
  const meaningful = result
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.startsWith('#!'))
    .join('');
  return meaningful === '' ? null : result;
}

/** Whether the gw worktree-add git hook is enabled in config (default: true). */
export function isGitHookEnabled(config: Pick<Config, 'hooks'>): boolean {
  return config.hooks?.gitWorktreeAdd !== false;
}

async function git(args: string[], cwd?: string): Promise<{ code: number; out: string }> {
  try {
    const { code, stdout } = await new Deno.Command('git', {
      args,
      cwd,
      stdout: 'piped',
      stderr: 'null',
    }).output();
    return { code, out: new TextDecoder().decode(stdout).trim() };
  } catch {
    return { code: 1, out: '' };
  }
}

export type InstallStatus = 'installed' | 'already-installed' | 'skipped';

export interface InstallResult {
  status: InstallStatus;
  hookPath?: string;
  reason?: string;
}

/** Resolve the hooks dir shared by all worktrees, or a reason it can't be used. */
async function resolveHooksDir(cwd?: string): Promise<{ dir?: string; reason?: string }> {
  const hooksPath = await git(['config', '--get', 'core.hooksPath'], cwd);
  if (hooksPath.code === 0 && hooksPath.out) {
    return {
      reason: `core.hooksPath is set (${hooksPath.out}); add 'gw _post-worktree-add "$@"' to your post-checkout hook manually`,
    };
  }
  const common = await git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  if (common.code !== 0 || !common.out) return { reason: 'not inside a git repository' };
  return { dir: join(common.out, 'hooks') };
}

/** Install (or leave in place) the gw block in the repo's post-checkout hook. */
export async function installGitHook(cwd?: string): Promise<InstallResult> {
  const { dir, reason } = await resolveHooksDir(cwd);
  if (!dir) return { status: 'skipped', reason };

  const hookPath = join(dir, 'post-checkout');
  let existing: string | null = null;
  let existingMode: number | null = null;
  try {
    // A symlinked hook usually points at a tracked repo script; writing through it would modify that script.
    const info = await Deno.lstat(hookPath);
    if (info.isSymlink) {
      return {
        status: 'skipped',
        hookPath,
        reason: 'post-checkout is a symlink; add \'gw _post-worktree-add "$@"\' to the linked script manually',
      };
    }
    existingMode = info.mode;
    existing = await Deno.readTextFile(hookPath);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }

  // A hook left non-executable is deliberately disabled; do not re-enable it.
  if (existingMode !== null && (existingMode & 0o111) === 0 && existing !== null && existing.trim() !== '') {
    return { status: 'skipped', hookPath, reason: 'existing post-checkout hook is not executable (disabled)' };
  }

  const updated = addHookBlock(existing);
  if (updated === null) return { status: 'already-installed', hookPath };
  if (updated === 'unsupported') {
    return {
      status: 'skipped',
      hookPath,
      reason: 'existing post-checkout hook is not a shell script; add \'gw _post-worktree-add "$@"\' to it manually',
    };
  }

  await Deno.mkdir(dirname(hookPath), { recursive: true });
  await Deno.writeTextFile(hookPath, updated);
  // Only a freshly created hook needs its mode set; an existing one keeps its own.
  if (existingMode === null) await Deno.chmod(hookPath, 0o755);
  return { status: 'installed', hookPath };
}

/** Remove the gw block from the repo's post-checkout hook. Returns true if anything was removed. */
export async function uninstallGitHook(cwd?: string): Promise<boolean> {
  const { dir } = await resolveHooksDir(cwd);
  if (!dir) return false;
  const hookPath = join(dir, 'post-checkout');
  let existing: string;
  try {
    if ((await Deno.lstat(hookPath)).isSymlink) return false;
    existing = await Deno.readTextFile(hookPath);
  } catch {
    return false;
  }
  if (!hasHookBlock(existing)) return false;

  const remaining = removeHookBlock(existing);
  if (remaining === null) {
    await Deno.remove(hookPath);
  } else {
    await Deno.writeTextFile(hookPath, remaining);
  }
  return true;
}

/** Whether the gw block is currently installed. */
export async function isGitHookInstalled(cwd?: string): Promise<boolean> {
  const { dir } = await resolveHooksDir(cwd);
  if (!dir) return false;
  try {
    return hasHookBlock(await Deno.readTextFile(join(dir, 'post-checkout')));
  } catch {
    return false;
  }
}

/** Resolve a path reported by git relative to a cwd. */
export function resolveFrom(cwd: string, p: string): string {
  return isAbsolute(p) ? p : resolve(cwd, p);
}
