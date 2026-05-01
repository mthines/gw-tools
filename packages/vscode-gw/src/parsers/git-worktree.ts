/**
 * Git worktree parser - runs `git worktree list --porcelain` and parses the output
 */

import * as cp from 'child_process';
import * as readline from 'readline';

/** Optional logger callback for command execution */
let logFn: ((message: string) => void) | undefined;

/**
 * Set the logger function for command execution output.
 * Pass `undefined` to disable logging.
 */
export function setLogger(fn: ((message: string) => void) | undefined): void {
  logFn = fn;
}

/**
 * Strip ANSI escape codes from a string
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Strip the remote prefix (e.g. `origin/`, `upstream/`) from a remote branch name.
 * If the branch name does not contain a `/`, it is returned unchanged.
 * Only strips the first path segment, preserving the rest of the branch name.
 *
 * Examples:
 *   `origin/test/foo`   → `test/foo`
 *   `upstream/main`     → `main`
 *   `my-local-branch`   → `my-local-branch`
 */
export function stripRemotePrefix(branchName: string): string {
  const slashIndex = branchName.indexOf('/');
  if (slashIndex === -1) {
    return branchName;
  }
  return branchName.substring(slashIndex + 1);
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
}

/**
 * Run a shell command and return stdout
 */
function exec(command: string, cwd: string, timeoutMs?: number): Promise<string> {
  logFn?.(`> ${command}`);
  return new Promise((resolve, reject) => {
    const child = cp.exec(command, { cwd, timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        // Check if it was a timeout (killed)
        if (err.killed || err.signal === 'SIGTERM') {
          logFn?.(`  [TIMEOUT] ${command}`);
          reject(new Error('TIMEOUT'));
          return;
        }
        const errMsg = stderr.trim() || err.message;
        logFn?.(`  [ERROR] ${stripAnsi(errMsg)}`);
        reject(new Error(errMsg));
        return;
      }
      const output = stdout.trim();
      if (output) {
        logFn?.(`  ${stripAnsi(output).split('\n').join('\n  ')}`);
      }
      resolve(output);
    });

    // Also set up a manual timeout in case the process hangs without being killed
    if (timeoutMs) {
      setTimeout(() => {
        child.kill('SIGTERM');
      }, timeoutMs);
    }
  });
}

/**
 * Parse the porcelain output of `git worktree list --porcelain`
 */
export function parseWorktreeListOutput(output: string): WorktreeInfo[] {
  const lines = output.trim().split('\n');
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      current.path = line.substring('worktree '.length);
    } else if (line.startsWith('HEAD ')) {
      current.head = line.substring('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      const fullRef = line.substring('branch '.length);
      current.branch = fullRef.replace(/^refs\/heads\//, '');
    } else if (line === 'bare') {
      current.bare = true;
    } else if (line === '') {
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch || '(detached)',
          head: current.head || '',
          bare: current.bare || false,
        });
      }
      current = {};
    }
  }

  // Handle last entry
  if (current.path) {
    worktrees.push({
      path: current.path,
      branch: current.branch || '(detached)',
      head: current.head || '',
      bare: current.bare || false,
    });
  }

  return worktrees;
}

/**
 * List all worktrees by invoking git
 */
export async function listWorktrees(cwd: string): Promise<WorktreeInfo[]> {
  const output = await exec('git worktree list --porcelain', cwd);
  return parseWorktreeListOutput(output);
}

/**
 * Get the configured default branch from .gw/config.json
 * Falls back to 'main' if not configured or file doesn't exist
 */
export async function getDefaultBranch(cwd: string): Promise<string> {
  try {
    const output = await exec('cat .gw/config.json', cwd);
    const config = JSON.parse(output);
    return config.defaultBranch || 'main';
  } catch {
    // Config doesn't exist or is invalid, fall back to main
    return 'main';
  }
}

/**
 * Branch information
 */
export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  commitHash?: string;
  commitMessage?: string;
  authorName?: string;
  relativeDate?: string;
}

/**
 * List all git branches (local and remote) with commit info
 */
export async function listBranches(cwd: string): Promise<BranchInfo[]> {
  // Use for-each-ref to get branch info with commit details
  // Format: refname|objectname:short|subject|authorname|committerdate:relative
  const format = '%(refname)|%(objectname:short)|%(subject)|%(authorname)|%(committerdate:relative)';
  const output = await exec(`git for-each-ref --format='${format}' refs/heads refs/remotes`, cwd);
  const lines = output.split('\n').filter((line) => line.trim());

  // Get current branch name
  let currentBranch = '';
  try {
    currentBranch = await exec('git rev-parse --abbrev-ref HEAD', cwd);
  } catch {
    // Ignore - might be in detached HEAD state
  }

  const branches: BranchInfo[] = [];
  for (const line of lines) {
    const [refname, commitHash, commitMessage, authorName, relativeDate] = line.split('|');

    // Parse refname to get clean branch name and determine if remote
    let name = refname;
    let isRemote = false;

    if (refname.startsWith('refs/heads/')) {
      name = refname.replace('refs/heads/', '');
    } else if (refname.startsWith('refs/remotes/')) {
      name = refname.replace('refs/remotes/', '');
      isRemote = true;
    }

    // Skip HEAD pointer entries
    if (name.endsWith('/HEAD')) {
      continue;
    }

    branches.push({
      name,
      isRemote,
      isCurrent: name === currentBranch,
      commitHash,
      commitMessage,
      authorName,
      relativeDate,
    });
  }
  return branches;
}

/**
 * Get the git root directory for a given path
 */
export async function getGitRoot(cwd: string): Promise<string> {
  try {
    return await exec('git rev-parse --show-toplevel', cwd);
  } catch {
    // Could be bare repo - try common dir
    return await exec('git rev-parse --git-common-dir', cwd);
  }
}

/**
 * Check if a worktree has uncommitted changes
 */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  try {
    const output = await exec('git status --porcelain', worktreePath);
    return output.length > 0;
  } catch {
    // If we can't check status, assume it might have changes
    return true;
  }
}

/**
 * Remove a worktree using gw remove
 */
export function removeWorktree(cwd: string, worktreePath: string, force = false): Promise<void> {
  const flags = force ? '--yes --force' : '--yes';
  return exec(`gw remove "${worktreePath}" ${flags}`, cwd).then(() => undefined);
}

/**
 * Create a new worktree via gw checkout
 */
export function createWorktree(cwd: string, branchName: string): Promise<string> {
  return exec(`gw checkout ${branchName}`, cwd);
}

/**
 * Create a new worktree from staged files via gw checkout --from-staged
 */
export function createWorktreeFromStaged(cwd: string, branchName: string): Promise<string> {
  return exec(`gw checkout ${branchName} --from-staged`, cwd);
}

/**
 * Check if there are staged files in the current worktree
 */
export async function hasStagedFiles(cwd: string): Promise<boolean> {
  try {
    const output = await exec('git diff --cached --name-only', cwd);
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the path of a worktree by branch name
 */
export async function getWorktreePath(cwd: string, branchName: string): Promise<string | undefined> {
  const worktrees = await listWorktrees(cwd);
  const worktree = worktrees.find((w) => w.branch === branchName);
  return worktree?.path;
}

/**
 * Clean up stale worktrees via gw clean
 */
export function cleanWorktrees(cwd: string, opts: { force?: boolean; dryRun?: boolean } = {}): Promise<string> {
  const flags: string[] = ['--auto', '--yes'];
  if (opts.force) flags.push('--force');
  if (opts.dryRun) flags.push('--dry-run');
  return exec(`gw clean ${flags.join(' ')}`, cwd);
}

/**
 * Checkout a PR into a new worktree via gw pr
 */
export function checkoutPr(cwd: string, prIdentifier: string): Promise<string> {
  return exec(`gw pr ${prIdentifier} --no-cd`, cwd);
}

/**
 * Sync files to a worktree via gw sync
 */
export function syncWorktree(cwd: string, target?: string, from?: string): Promise<string> {
  const args: string[] = [];
  if (target) args.push(target);
  if (from) args.push('--from', from);
  return exec(`gw sync ${args.join(' ')}`, cwd);
}

/**
 * Result from gw update command
 */
export interface UpdateResult {
  success: boolean;
  message: string;
  conflicted: boolean;
  alreadyUpToDate: boolean;
}

/**
 * Update current worktree with latest changes from default branch via gw update
 */
export async function updateWorktree(
  cwd: string,
  opts: { merge?: boolean; rebase?: boolean; from?: string } = {}
): Promise<UpdateResult> {
  const args: string[] = [];
  if (opts.merge) args.push('--merge');
  if (opts.rebase) args.push('--rebase');
  if (opts.from) args.push('--from', opts.from);

  try {
    const output = await exec(`gw update ${args.join(' ')}`, cwd);
    const cleanOutput = stripAnsi(output);

    return {
      success: true,
      message: cleanOutput,
      conflicted: false,
      alreadyUpToDate: cleanOutput.toLowerCase().includes('already up to date'),
    };
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const cleanMessage = stripAnsi(rawMessage);
    const isConflict =
      cleanMessage.toLowerCase().includes('conflict') || cleanMessage.toLowerCase().includes('fix conflicts');

    return {
      success: false,
      message: cleanMessage,
      conflicted: isConflict,
      alreadyUpToDate: false,
    };
  }
}

/**
 * Info about a cleanable worktree
 */
export interface CleanableWorktreeInfo {
  branch: string;
  path: string;
  ageDays: number;
  hasUncommitted: boolean;
  hasUnpushed: boolean;
}

/**
 * Result from gw clean --json
 */
export interface CleanCheckResult {
  cleanable: CleanableWorktreeInfo[];
  skipped: { branch: string; path: string; ageDays: number; reason: string }[];
  /** True if the command timed out (likely older gw version without --json support) */
  timedOut?: boolean;
}

/** Timeout for gw clean --json command (5 seconds) */
const GW_CLEAN_TIMEOUT_MS = 5000;

/**
 * Check which worktrees are cleanable via gw clean --json
 * Times out after 5 seconds for older gw versions without --json support
 */
export async function getCleanableWorktrees(cwd: string): Promise<CleanCheckResult> {
  try {
    const output = await exec('gw clean --json', cwd, GW_CLEAN_TIMEOUT_MS);
    return JSON.parse(output) as CleanCheckResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'TIMEOUT') {
      return { cleanable: [], skipped: [], timedOut: true };
    }
    return { cleanable: [], skipped: [] };
  }
}

// ── Structured progress (--progress=json) ────────────────────────────────────

/**
 * A single NDJSON progress event emitted by `gw checkout --progress=json`.
 * Schema version 1.
 */
export interface GwProgressEvent {
  version: 1;
  stage: 'pre-checkout-hooks' | 'create-worktree' | 'copy-files' | 'copy-staged-files' | 'post-checkout-hooks';
  status: 'start' | 'end' | 'error';
  /** 1-based hook index (hook stages only) */
  hook?: number;
  /** Total hook count (hook stages only) */
  of?: number;
  /** Expanded hook command (hook stages only) */
  command?: string;
  /** Elapsed ms (end events only) */
  durationMs?: number;
  /** Error detail (error events only) */
  message?: string;
  /** Exit code (error events only) */
  exitCode?: number;
}

/**
 * Parse a single line of stderr from `gw checkout --progress=json`.
 * Returns a typed event when the line is valid JSON with version 1,
 * or `undefined` for non-JSON lines (human-readable output, hook output, etc.).
 *
 * @param line A single line of stderr text (no trailing newline expected)
 */
export function parseProgressEvent(line: string): GwProgressEvent | undefined {
  if (!line.startsWith('{')) return undefined;
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (parsed['version'] !== 1) return undefined;
    return parsed as unknown as GwProgressEvent;
  } catch {
    return undefined;
  }
}

/** Maximum character length of hook command shown in progress labels */
const MAX_COMMAND_LENGTH = 40;

/**
 * Map a parsed progress event to a human-readable VS Code notification subtitle.
 * Returns `undefined` for events that should not update the notification
 * (e.g., end events, error events — handled separately in extension.ts).
 *
 * @param event A parsed GwProgressEvent
 */
export function progressEventToLabel(event: GwProgressEvent): string | undefined {
  if (event.status !== 'start') return undefined;

  const truncate = (cmd: string): string =>
    cmd.length > MAX_COMMAND_LENGTH ? cmd.slice(0, MAX_COMMAND_LENGTH) + '\u2026' : cmd;

  switch (event.stage) {
    case 'pre-checkout-hooks':
      if (event.hook !== undefined && event.of !== undefined && event.command !== undefined) {
        return `Running pre-checkout hook ${event.hook}/${event.of} \u2014 ${truncate(event.command)}`;
      }
      return 'Running pre-checkout hooks...';

    case 'create-worktree':
      return 'Creating worktree';

    case 'copy-files':
      return 'Copying config files';

    case 'copy-staged-files':
      return 'Moving staged files to new worktree';

    case 'post-checkout-hooks':
      if (event.hook !== undefined && event.of !== undefined && event.command !== undefined) {
        return `Running post-checkout hook ${event.hook}/${event.of} \u2014 ${truncate(event.command)}`;
      }
      return 'Running post-checkout hooks...';

    default:
      return undefined;
  }
}

/**
 * Represents a hook failure that occurred during `gw checkout --progress=json`.
 * Thrown by the progress-aware variants so the caller can distinguish:
 * - Pre-checkout failures: worktree was NOT created (fatal).
 * - Post-checkout failures: worktree WAS created but hook failed (non-fatal).
 */
export class HookFailureError extends Error {
  constructor(
    /** Whether the failing hook ran before worktree creation */
    public readonly isPreCheckout: boolean,
    /** The resolved worktree path (for post-checkout only, to enable "Open Worktree" button) */
    public readonly worktreePath: string | undefined,
    message: string
  ) {
    super(message);
    this.name = 'HookFailureError';
  }
}

/**
 * Internal helper: run a progress-aware `gw checkout` command.
 * Parses stderr line-by-line; calls onProgress for each stage label.
 * Throws HookFailureError when a hook error event is detected,
 * or a plain Error for all other non-zero exits.
 */
function runCheckoutWithProgress(
  args: string[],
  cwd: string,
  onProgress: (message: string) => void,
  logPrefix: string
): Promise<string> {
  logFn?.(`> gw ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    const child = cp.spawn('gw', args, { cwd });

    let stdout = '';
    let stderrBuffer = '';
    let lastHookErrorEvent: GwProgressEvent | undefined;

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    // Parse stderr line-by-line; only attempt JSON.parse on lines that start with '{'.
    const rl = readline.createInterface({ input: child.stderr, crlfDelay: Infinity });
    rl.on('line', (line: string) => {
      const event = parseProgressEvent(line);
      if (event) {
        if (
          event.status === 'error' &&
          (event.stage === 'pre-checkout-hooks' || event.stage === 'post-checkout-hooks')
        ) {
          lastHookErrorEvent = event;
        }
        const label = progressEventToLabel(event);
        if (label) onProgress(label);
      } else {
        // Non-JSON stderr line — forward to logger (strips ANSI for readability)
        const stripped = stripAnsi(line);
        if (stripped) {
          logFn?.(`  ${stripped}`);
          stderrBuffer += stripped + '\n';
        }
      }
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      // Hook error detected via structured event — surface as HookFailureError
      if (lastHookErrorEvent) {
        const isPreCheckout = lastHookErrorEvent.stage === 'pre-checkout-hooks';
        reject(
          new HookFailureError(
            isPreCheckout,
            undefined, // worktreePath resolved by extension.ts after getWorktreePath
            lastHookErrorEvent.message ?? `Hook failed with exit code ${lastHookErrorEvent.exitCode ?? code}`
          )
        );
        return;
      }

      const errMsg = stderrBuffer.trim() || `${logPrefix} exited with code ${code}`;
      logFn?.(`  [ERROR] ${errMsg}`);
      reject(new Error(errMsg));
    });

    child.on('error', (err: Error) => {
      logFn?.(`  [ERROR] ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Create a new worktree via `gw checkout --progress=json`, calling `onProgress`
 * for each stage. This is the progress-aware replacement for `createWorktree`.
 *
 * Non-JSON stderr lines (human output, hook stdout) are forwarded to the logger.
 * Throws HookFailureError on hook failures so the caller can show the
 * appropriate notification type.
 *
 * @param cwd Workspace path passed to gw as cwd
 * @param branchName Branch / worktree name to create
 * @param onProgress Callback invoked with a human-readable stage label on each progress event
 * @returns Resolves with stdout output; rejects on non-zero exit
 */
export function createWorktreeWithProgress(
  cwd: string,
  branchName: string,
  onProgress: (message: string) => void
): Promise<string> {
  return runCheckoutWithProgress(['checkout', branchName, '--progress=json'], cwd, onProgress, 'gw checkout');
}

/**
 * Create a new worktree from staged files via `gw checkout --from-staged --progress=json`,
 * calling `onProgress` for each stage. Progress-aware replacement for `createWorktreeFromStaged`.
 *
 * Throws HookFailureError on hook failures.
 *
 * @param cwd Workspace path passed to gw as cwd
 * @param branchName Branch / worktree name to create
 * @param onProgress Callback invoked with a human-readable stage label on each progress event
 * @returns Resolves with stdout output; rejects on non-zero exit
 */
export function createWorktreeFromStagedWithProgress(
  cwd: string,
  branchName: string,
  onProgress: (message: string) => void
): Promise<string> {
  return runCheckoutWithProgress(
    ['checkout', branchName, '--from-staged', '--progress=json'],
    cwd,
    onProgress,
    'gw checkout --from-staged'
  );
}
