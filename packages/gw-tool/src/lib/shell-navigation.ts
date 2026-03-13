/**
 * Shell navigation utilities
 * Enables shell integration to navigate to worktrees without buffering output
 */

import { join } from '$std/path';
import type { EnvGetter } from './types.ts';

/**
 * Signal to shell integration that it should navigate to a path
 * This writes to a temp file instead of stdout to avoid buffering
 *
 * @param targetPath Path to navigate to
 * @param env Environment variable getter (defaults to Deno.env for production)
 */
export async function signalNavigation(
  targetPath: string,
  env: EnvGetter = Deno.env
): Promise<void> {
  const home = env.get('HOME') || env.get('USERPROFILE') || '';
  const navFile = join(home, '.gw', 'tmp', 'last-nav');

  // Ensure directory exists
  const navDir = join(home, '.gw', 'tmp');
  try {
    await Deno.mkdir(navDir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  // Write navigation target to file
  await Deno.writeTextFile(navFile, targetPath);
}
