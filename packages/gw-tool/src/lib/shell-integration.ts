/**
 * Shell integration detection utilities
 */
import { join } from '@std/path';

/**
 * Check if shell integration is installed (eval-based or legacy file-based)
 *
 * Detects both:
 * - New eval-based format: `eval "$(gw install-shell)"` in shell config
 * - Legacy file-based format: ~/.gw/shell/integration.{zsh,bash} files
 *
 * @returns true if shell integration is detected
 */
export async function isShellIntegrationInstalled(): Promise<boolean> {
  const shell = Deno.env.get('SHELL') || '';
  const shellName = shell.split('/').pop() || '';
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

  if (!home) {
    return false;
  }

  // Check for new eval-based format in shell config
  let configFile: string;
  if (shellName === 'zsh') {
    configFile = join(home, '.zshrc');
  } else if (shellName === 'bash') {
    configFile = join(home, '.bashrc');
  } else if (shellName === 'fish') {
    configFile = join(home, '.config', 'fish', 'config.fish');
  } else {
    return false;
  }

  try {
    const content = await Deno.readTextFile(configFile);
    if (content.includes('gw install-shell')) {
      return true;
    }
  } catch {
    // File doesn't exist
  }

  // Check for legacy file-based format
  let legacyFile: string;
  if (shellName === 'zsh') {
    legacyFile = join(home, '.gw', 'shell', 'integration.zsh');
  } else if (shellName === 'bash') {
    legacyFile = join(home, '.gw', 'shell', 'integration.bash');
  } else if (shellName === 'fish') {
    legacyFile = join(home, '.config', 'fish', 'functions', 'gw.fish');
  } else {
    return false;
  }

  try {
    await Deno.stat(legacyFile);
    return true;
  } catch {
    return false;
  }
}
