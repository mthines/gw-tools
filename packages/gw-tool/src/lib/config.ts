/**
 * Configuration management for the gw CLI tool
 * Config is stored at .gw/config.json (searched walking up from cwd)
 */

import { join, resolve } from '$std/path';
import { parse as parseJsonc } from '$std/jsonc';
import type { Config } from './types.ts';
import { findGitRoot, pathExists } from './path-resolver.ts';
import { runMigrations, CURRENT_CONFIG_VERSION } from './config-migrations.ts';

const CONFIG_DIR_NAME = '.gw';
const CONFIG_FILE_NAME = 'config.json';

/**
 * Get the path to the config directory for a given directory
 * @param dir Directory path
 */
function getConfigDir(dir: string): string {
  return join(dir, CONFIG_DIR_NAME);
}

/**
 * Get the full path to the config file
 * @param dir Directory path
 */
function getConfigPath(dir: string): string {
  return join(getConfigDir(dir), CONFIG_FILE_NAME);
}

/**
 * Find the config file by walking up from the current directory
 * @param startPath Starting directory path (defaults to current working directory)
 * @returns Path to config file if found, null otherwise
 */
async function findConfigFile(startPath?: string): Promise<string | null> {
  let currentPath = startPath ? resolve(startPath) : Deno.cwd();

  while (true) {
    const configPath = getConfigPath(currentPath);

    if (await pathExists(configPath)) {
      return configPath;
    }

    const parentPath = resolve(currentPath, '..');

    // If we've reached the root without finding config
    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

/**
 * Ensure the config directory exists
 * @param dir Directory where .gw should be created
 */
async function ensureConfigDir(dir: string): Promise<void> {
  const configDir = getConfigDir(dir);
  try {
    await Deno.mkdir(configDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create config directory: ${message}`);
    }
  }
}

/**
 * Create a default configuration
 */
function createDefaultConfig(): Config {
  return {
    configVersion: CURRENT_CONFIG_VERSION,
    defaultBranch: 'main',
    cleanThreshold: 7,
  };
}

/**
 * Validate the config structure
 */
function validateConfig(data: unknown): data is Config {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const config = data as Partial<Config>;

  if (config.root !== undefined && typeof config.root !== 'string') {
    return false;
  }

  if (config.defaultBranch !== undefined && typeof config.defaultBranch !== 'string') {
    return false;
  }

  if (config.autoCopyFiles !== undefined) {
    if (!Array.isArray(config.autoCopyFiles)) {
      return false;
    }
    // Validate that all items are strings
    if (!config.autoCopyFiles.every((item) => typeof item === 'string')) {
      return false;
    }
  }

  if (config.cleanThreshold !== undefined) {
    if (typeof config.cleanThreshold !== 'number' || config.cleanThreshold < 0) {
      return false;
    }
  }

  if (config.autoClean !== undefined) {
    if (typeof config.autoClean !== 'boolean') {
      return false;
    }
  }

  if (config.lastAutoCleanTime !== undefined) {
    if (typeof config.lastAutoCleanTime !== 'number' || config.lastAutoCleanTime < 0) {
      return false;
    }
  }

  if (config.updateStrategy !== undefined) {
    if (
      typeof config.updateStrategy !== 'string' ||
      (config.updateStrategy !== 'merge' && config.updateStrategy !== 'rebase')
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Load configuration
 * 1. Look for .gw/config.json walking up from cwd
 * 2. If found and has root, use it
 * 3. If not found, try auto-detection with findGitRoot()
 * 4. On auto-detection success, create config with detected root
 * 5. On failure, throw error with instruction to run gw init
 *
 * @returns Config and git root path
 */
export async function loadConfig(): Promise<{
  config: Config;
  gitRoot: string;
}> {
  // Try to find existing config file
  const configPath = await findConfigFile();

  if (configPath) {
    // Config file exists, load it
    try {
      const content = await Deno.readTextFile(configPath);
      const rawData = parseJsonc(content) as Record<string, unknown>;

      // Run migrations if needed
      const { config: migratedData, migrated, appliedMigrations } = runMigrations(rawData);

      if (!validateConfig(migratedData)) {
        throw new Error('Invalid configuration file format');
      }

      // Save migrated config and notify user if migrations were applied
      if (migrated && migratedData.root) {
        await saveConfig(migratedData.root, migratedData);
        console.log(
          `Config automatically updated (${appliedMigrations.length} migration${appliedMigrations.length > 1 ? 's' : ''} applied)\n`
        );
      }

      // If config has root, use it
      if (migratedData.root) {
        return { config: migratedData, gitRoot: migratedData.root };
      }

      // Alias for the rest of the function
      const data = migratedData;

      // Config exists but no root - try auto-detection and update config
      try {
        const detectedRoot = await findGitRoot();
        data.root = detectedRoot;
        await saveConfig(detectedRoot, data);
        console.log(`Detected git root and updated config: ${detectedRoot}\n`);
        return { config: data, gitRoot: detectedRoot };
      } catch {
        throw new Error(
          "Could not auto-detect git root. Please run 'gw init --root <path>' to specify the repository root manually."
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load config: ${message}`);
    }
  }

  // No config file found - try auto-detection
  try {
    const gitRoot = await findGitRoot();

    // Create config with detected root
    const config = createDefaultConfig();
    config.root = gitRoot;

    // Save config in the detected git root
    await saveConfig(gitRoot, config);

    console.log(`Created config at ${getConfigPath(gitRoot)}`);
    console.log(`Detected git root: ${gitRoot}`);
    console.log(`Default source worktree: ${config.defaultBranch}\n`);

    return { config, gitRoot };
  } catch {
    throw new Error(
      "Could not auto-detect git root. Please run 'gw init --root <path>' to specify the repository root manually."
    );
  }
}

/**
 * Save configuration to disk
 * @param dir Directory where .gw/config.json should be saved (typically the git root)
 * @param config Configuration to save
 */
export async function saveConfig(dir: string, config: Config): Promise<void> {
  await ensureConfigDir(dir);
  const configPath = getConfigPath(dir);
  const content = JSON.stringify(config, null, 2);
  await Deno.writeTextFile(configPath, content);
}

/**
 * Generate a comprehensive JSONC template from config
 * Shows all available options with inline documentation
 * @param config Configuration object
 * @returns JSONC template string
 */
function generateConfigTemplate(config: Config): string {
  const lines: string[] = [];

  // Header
  lines.push('{');
  lines.push('  // ============================================================================');
  lines.push('  // gw Configuration File');
  lines.push('  // ============================================================================');
  lines.push('  // Documentation: https://github.com/mthines/gw-tools');
  lines.push('  // All fields except "root" are optional.');
  lines.push('  // ============================================================================');
  lines.push('');

  // Core Settings Section
  lines.push('  // Core Settings');
  lines.push('  // ----------------------------------------------------------------------------');

  // root (always required if present)
  if (config.root) {
    lines.push(`  "root": ${JSON.stringify(config.root)},`);
  } else {
    lines.push('  // "root": "/path/to/your/repository",');
  }

  // defaultBranch
  if (config.defaultBranch !== undefined) {
    lines.push(`  "defaultBranch": ${JSON.stringify(config.defaultBranch)},`);
  } else {
    lines.push('  // "defaultBranch": "main",  // Default source branch for new worktrees');
  }

  // cleanThreshold
  if (config.cleanThreshold !== undefined) {
    lines.push(`  "cleanThreshold": ${config.cleanThreshold},`);
  } else {
    lines.push('  // "cleanThreshold": 7,  // Days before worktrees are eligible for cleanup');
  }

  lines.push('');

  // Auto-Copy Files Section
  lines.push('  // Auto-Copy Files');
  lines.push('  // ----------------------------------------------------------------------------');
  lines.push('  // Files/directories to automatically copy when creating new worktrees.');
  lines.push('  // Useful for environment files, secrets, and local configuration.');

  if (config.autoCopyFiles && config.autoCopyFiles.length > 0) {
    // Active auto-copy configuration
    lines.push('  "autoCopyFiles": [');
    config.autoCopyFiles.forEach((file, index) => {
      const comma = index < config.autoCopyFiles!.length - 1 ? ',' : '';
      lines.push(`    ${JSON.stringify(file)}${comma}`);
    });
    lines.push('  ],');
  } else {
    // Show commented examples
    lines.push('  // "autoCopyFiles": [');
    lines.push('  //   ".env",              // Environment variables');
    lines.push('  //   ".env.local",        // Local overrides');
    lines.push('  //   "config/secrets/",   // Secrets directory');
    lines.push('  //   "node_modules/"      // Dependencies (if not using symlinks)');
    lines.push('  // ],');
  }

  lines.push('');

  // Hooks Section
  lines.push('  // Hooks');
  lines.push('  // ----------------------------------------------------------------------------');
  lines.push('  // Commands to run before/after gw operations.');
  lines.push('  // Available variables: {worktree}, {worktreePath}, {gitRoot}, {branch}');

  if (config.hooks && Object.keys(config.hooks).length > 0) {
    // Active hooks configuration
    lines.push('  "hooks": {');

    if (config.hooks.checkout) {
      lines.push('    "checkout": {');

      const preHooks = config.hooks.checkout.pre;
      if (preHooks && preHooks.length > 0) {
        lines.push('      "pre": [');
        preHooks.forEach((cmd, index) => {
          const comma = index < preHooks.length - 1 ? ',' : '';
          lines.push(`        ${JSON.stringify(cmd)}${comma}`);
        });
        const hasPost = config.hooks.checkout.post && config.hooks.checkout.post.length > 0;
        lines.push(`      ]${hasPost ? ',' : ''}`);
      }

      const postHooks = config.hooks.checkout.post;
      if (postHooks && postHooks.length > 0) {
        lines.push('      "post": [');
        postHooks.forEach((cmd, index) => {
          const comma = index < postHooks.length - 1 ? ',' : '';
          lines.push(`        ${JSON.stringify(cmd)}${comma}`);
        });
        lines.push('      ]');
      }

      lines.push('    }');
    }

    lines.push('  },');
  } else {
    // Show commented examples
    lines.push('  // "hooks": {');
    lines.push('  //   "checkout": {');
    lines.push('  //     "pre": [');
    lines.push('  //       "echo \'Creating worktree: {worktree}\'"');
    lines.push('  //     ],');
    lines.push('  //     "post": [');
    lines.push('  //       "cd {worktreePath} && npm install",');
    lines.push('  //       "cd {worktreePath} && npm run build"');
    lines.push('  //     ]');
    lines.push('  //   }');
    lines.push('  // },');
  }

  lines.push('');

  // Advanced Options Section
  lines.push('  // Advanced Options');
  lines.push('  // ----------------------------------------------------------------------------');

  // autoClean
  if (config.autoClean !== undefined) {
    lines.push(`  "autoClean": ${config.autoClean},`);
    lines.push('  // Automatically clean stale worktrees (older than cleanThreshold)');
  } else {
    lines.push('  // "autoClean": false,  // Automatically clean stale worktrees');
  }

  // updateStrategy
  if (config.updateStrategy !== undefined) {
    lines.push(`  "updateStrategy": ${JSON.stringify(config.updateStrategy)}`);
    lines.push('  // Default update strategy: "merge" or "rebase"');
  } else {
    lines.push('  // "updateStrategy": "merge",  // Default: "merge" or "rebase"');
  }

  lines.push('');

  // Footer
  lines.push('  // Internal fields (managed automatically):');
  lines.push('  // - lastAutoCleanTime: Unix timestamp of last auto-cleanup run');

  lines.push('}');

  return lines.join('\n');
}

/**
 * Save config as comprehensive JSONC template
 * Used by init command for self-documenting configs
 * @param dir Directory where .gw/config.json should be saved (typically the git root)
 * @param config Configuration to save
 */
export async function saveConfigTemplate(dir: string, config: Config): Promise<void> {
  await ensureConfigDir(dir);
  const configPath = getConfigPath(dir);
  const content = generateConfigTemplate(config);
  await Deno.writeTextFile(configPath, content);
}
