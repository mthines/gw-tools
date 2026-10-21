/**
 * Global registry of gw-managed repositories
 *
 * Stores the root path of every repository gw has been used in, so
 * cross-repo commands (e.g. `gw clean --all`) know which repos exist.
 *
 * Location: $XDG_CONFIG_HOME/gw/repos.json, falling back to
 * ~/.config/gw/repos.json.
 */

import { basename, dirname, join, resolve } from '@std/path';
import { resolveConfigPaths } from './config.ts';
import { findGitRoot, pathExists } from './path-resolver.ts';

/** A single registered repository */
export interface RegisteredRepo {
  /** Absolute path to the repository root (bare root for bare setups) */
  path: string;
  /** ISO 8601 timestamp of when the repo was first registered */
  addedAt: string;
}

/** On-disk shape of repos.json */
interface RegistryFile {
  repos: RegisteredRepo[];
}

/**
 * Directory holding gw's global (user-level) config.
 * Honors XDG_CONFIG_HOME; falls back to ~/.config/gw.
 */
export function getGlobalConfigDir(): string {
  const xdg = Deno.env.get('XDG_CONFIG_HOME');
  if (xdg) {
    return join(xdg, 'gw');
  }
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE');
  if (!home) {
    throw new Error('Cannot determine home directory for the gw repo registry');
  }
  return join(home, '.config', 'gw');
}

/**
 * Path of the repo registry file
 */
export function getRegistryPath(): string {
  return join(getGlobalConfigDir(), 'repos.json');
}

/**
 * Display name for a registered repo (directory name of its root)
 */
export function getRepoDisplayName(repoPath: string): string {
  return basename(repoPath) || repoPath;
}

/**
 * Load all registered repos. A missing or unreadable registry is treated
 * as empty so callers never fail because of it.
 */
export async function loadRegistry(): Promise<RegisteredRepo[]> {
  try {
    const content = await Deno.readTextFile(getRegistryPath());
    const data = JSON.parse(content) as Partial<RegistryFile>;
    if (!Array.isArray(data.repos)) return [];
    return data.repos
      .filter((r): r is RegisteredRepo => typeof r?.path === 'string' && r.path.length > 0)
      .map((r) => ({ path: r.path, addedAt: typeof r.addedAt === 'string' ? r.addedAt : '' }));
  } catch {
    return [];
  }
}

/**
 * Write the registry atomically (temp file + rename) so a crash mid-write
 * never leaves a truncated file behind.
 */
async function saveRegistry(repos: RegisteredRepo[]): Promise<void> {
  const registryPath = getRegistryPath();
  await Deno.mkdir(dirname(registryPath), { recursive: true });
  const tmpPath = `${registryPath}.${Deno.pid}.tmp`;
  const data: RegistryFile = { repos };
  await Deno.writeTextFile(tmpPath, JSON.stringify(data, null, 2) + '\n');
  await Deno.rename(tmpPath, registryPath);
}

/**
 * Add a repository root to the registry.
 * @returns true if the repo was newly added, false if already registered
 * @throws if the registry cannot be written
 */
export async function registerRepo(repoPath: string): Promise<boolean> {
  const normalized = resolve(repoPath);
  const repos = await loadRegistry();
  if (repos.some((r) => resolve(r.path) === normalized)) {
    return false;
  }
  repos.push({ path: normalized, addedAt: new Date().toISOString() });
  await saveRegistry(repos);
  return true;
}

/**
 * Register the repository containing `path` (resolved to its git root).
 * Best-effort: any failure is swallowed — registration must never break
 * the user's command.
 *
 * @returns true if a repo was newly registered
 */
export async function tryRegisterRepo(path: string): Promise<boolean> {
  try {
    const gitRoot = await findGitRoot(path);
    return await registerRepo(gitRoot);
  } catch {
    return false;
  }
}

/**
 * Register the gw repo containing the current directory, if any.
 *
 * Only repos that already have a .gw/config.json are registered. Runs on
 * every command, which back-fills repos initialized before the registry
 * existed. Best-effort, like tryRegisterRepo.
 *
 * @returns true if a repo was newly registered
 */
export async function autoRegisterCurrentRepo(): Promise<boolean> {
  try {
    const { configPath } = await resolveConfigPaths();
    if (!configPath) return false;
    return await tryRegisterRepo(configPath.replace(/[/\\]\.gw[/\\]config\.json$/, ''));
  } catch {
    return false;
  }
}

/**
 * Split registered repos into those still present on disk and those that
 * were moved or deleted, dropping the missing ones from the registry.
 * Failing to rewrite the registry is ignored — the missing repos are still
 * excluded from the returned list.
 */
export async function pruneMissingRepos(): Promise<{
  existing: RegisteredRepo[];
  removed: RegisteredRepo[];
}> {
  const repos = await loadRegistry();
  const existing: RegisteredRepo[] = [];
  const removed: RegisteredRepo[] = [];

  for (const repo of repos) {
    if (await pathExists(repo.path)) {
      existing.push(repo);
    } else {
      removed.push(repo);
    }
  }

  if (removed.length > 0) {
    try {
      await saveRegistry(existing);
    } catch {
      // Registry is read-only or unwritable — skip persisting the prune
    }
  }

  return { existing, removed };
}
