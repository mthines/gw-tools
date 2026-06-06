/**
 * Configuration management for the gw CLI tool
 * Config is stored at .gw/config.json (searched walking up from cwd)
 */

import { join, resolve } from '@std/path';
import { parse as parseJsonc } from '@std/jsonc';
import type { Config } from './types.ts';
import { findGitRoot, getWorktreeRoot, pathExists } from './path-resolver.ts';
import { CURRENT_CONFIG_VERSION, runMigrations } from './config-migrations.ts';

/**
 * URL to the JSON Schema for .gw/config.json
 * Provides IDE autocompletion and validation
 */
const CONFIG_SCHEMA_URL =
  'https://raw.githubusercontent.com/mthines/gw-tools/main/packages/gw-tool/schemas/gw-config.schema.json';

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
 * Content for .gw/.gitignore — keeps artifacts and state out of git
 * while allowing config.json to be committed.
 */
const CONFIG_LOCAL_FILE_NAME = 'config.local.json';

const GW_GITIGNORE_CONTENT = `# Workflow artifacts (per-developer, not committed)
*/

# Local config overrides and runtime state
config.local.json
state.json
`;

/**
 * Ensure the config directory exists and has a .gitignore
 * @param dir Directory where .gw should be created
 */
export async function ensureConfigDir(dir: string): Promise<void> {
  const configDir = getConfigDir(dir);
  try {
    await Deno.mkdir(configDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create config directory: ${message}`);
    }
  }

  // Create .gitignore if it doesn't exist — keeps artifacts/state ignored
  // while allowing config.json to be committed
  const gitignorePath = join(configDir, '.gitignore');
  try {
    await Deno.stat(gitignorePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      await Deno.writeTextFile(gitignorePath, GW_GITIGNORE_CONTENT);
    }
  }
}

/**
 * Create a default configuration
 */
function createDefaultConfig(): Config {
  return {
    $schema: CONFIG_SCHEMA_URL,
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

  if (config.$schema !== undefined && typeof config.$schema !== 'string') {
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

  if (config.updateStrategy !== undefined) {
    if (
      typeof config.updateStrategy !== 'string' ||
      (config.updateStrategy !== 'merge' && config.updateStrategy !== 'rebase')
    ) {
      return false;
    }
  }

  if (config.telemetry !== undefined) {
    if (typeof config.telemetry !== 'object' || config.telemetry === null || Array.isArray(config.telemetry)) {
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

      // Derive git root from the config file path.
      // Strip /.gw/config.json to get the directory containing the config,
      // then walk up to the actual git/bare-repo root. This is necessary for
      // bare-repo worktree setups where config lives inside a worktree
      // (e.g. repo.git/main/.gw/config.json) — we must return the bare root
      // (repo.git), not the worktree dir (repo.git/main).
      const worktreeDir = configPath.replace(/[/\\]\.gw[/\\]config\.json$/, '');
      const gitRoot = await findGitRoot(worktreeDir);

      // Save migrated config if migrations were applied
      if (migrated) {
        await saveConfig(worktreeDir, migratedData);
        console.log(
          `Config automatically updated (${appliedMigrations.length} migration${
            appliedMigrations.length > 1 ? 's' : ''
          } applied)\n`
        );
      }

      // Load local overrides (.gw/config.local.json) if present
      const configDir = configPath.replace(/[/\\]config\.json$/, '');
      const localConfigPath = join(configDir, CONFIG_LOCAL_FILE_NAME);
      try {
        const localContent = await Deno.readTextFile(localConfigPath);
        const localData = parseJsonc(localContent) as Record<string, unknown>;
        // Merge: local overrides base (shallow merge)
        Object.assign(migratedData, localData);
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          // Only ignore "not found" — other errors should surface
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`Warning: Failed to load ${CONFIG_LOCAL_FILE_NAME}: ${msg}`);
        }
      }

      return { config: migratedData, gitRoot };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load config: ${message}`);
    }
  }

  // No config file found - try auto-detection
  try {
    const gitRoot = await findGitRoot();

    // Save config in the worktree root (committable by default)
    // Falls back to git root if not inside a worktree
    const configDir = await getWorktreeRoot();
    const config = createDefaultConfig();

    await saveConfig(configDir, config);

    console.log(`Created config at ${getConfigPath(configDir)}`);
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
  lines.push(`  "$schema": ${JSON.stringify(CONFIG_SCHEMA_URL)},`);
  lines.push('');
  lines.push('  // ============================================================================');
  lines.push('  // gw Configuration File');
  lines.push('  // ============================================================================');
  lines.push('  // Documentation: https://github.com/mthines/gw-tools');
  lines.push('  // This file is safe to commit to your repository.');
  lines.push('  // All fields are optional.');
  lines.push('  // Supports JSONC: comments (// and /* */) and trailing commas are allowed.');
  lines.push('  // ============================================================================');
  lines.push('');

  // Config version (managed automatically)
  lines.push(`  "configVersion": ${CURRENT_CONFIG_VERSION},`);
  lines.push('');

  // Core Settings Section
  lines.push('  // Core Settings');
  lines.push('  // ----------------------------------------------------------------------------');

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
    lines.push('  // Silently clean stale worktrees in background (older than cleanThreshold)');
  } else {
    lines.push('  // "autoClean": false,  // Silently clean stale worktrees in background');
  }

  // updateStrategy
  if (config.updateStrategy !== undefined) {
    lines.push(`  "updateStrategy": ${JSON.stringify(config.updateStrategy)},`);
    lines.push('  // Default update strategy: "merge" or "rebase"');
  } else {
    lines.push('  // "updateStrategy": "merge",  // Default: "merge" or "rebase"');
  }

  lines.push('');

  // Telemetry Section (opt-in)
  lines.push('  // Telemetry (OpenTelemetry / Dash0) — opt-in, disabled by default');
  lines.push('  // ----------------------------------------------------------------------------');
  lines.push('  // Emits one span + log per command (and lets the release pipeline send a');
  lines.push('  // deployment event) so deployments can be correlated with errors in Dash0.');
  lines.push('  // Recommended: point "endpoint" at a local OpenTelemetry Collector that holds');
  lines.push('  // your Dash0 token. Keep secrets out of this committed file — put OTLP auth');
  lines.push('  // headers in .gw/config.local.json (gitignored) or OTEL_EXPORTER_OTLP_HEADERS.');

  if (config.telemetry) {
    lines.push(`  "telemetry": ${JSON.stringify(config.telemetry, null, 2).replace(/\n/g, '\n  ')},`);
  } else {
    lines.push('  // "telemetry": {');
    lines.push('  //   "enabled": true,');
    lines.push('  //   "endpoint": "http://localhost:4318",  // local OTel Collector');
    lines.push('  //   "environment": "production"           // deployment.environment.name');
    lines.push('  // },');
  }

  lines.push('');

  // Footer
  lines.push('  // Internal fields (managed automatically — do not edit):');
  lines.push('  // - configVersion: Schema version for config migrations');

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

/**
 * Ensure the config file at the given path has a $schema property.
 * Inserts it right after the opening brace if missing, preserving
 * existing JSONC formatting and comments. No-op if already present
 * or the file doesn't exist.
 * @param configPath Absolute path to the .gw/config.json file
 */
export async function ensureSchemaInConfig(configPath: string): Promise<void> {
  let content: string;
  try {
    content = await Deno.readTextFile(configPath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }

  if (content.includes('"$schema"')) {
    return;
  }

  const braceIndex = content.indexOf('{');
  if (braceIndex === -1) {
    return;
  }

  const before = content.slice(0, braceIndex + 1);
  const after = content.slice(braceIndex + 1);
  const schemaLine = `\n  "$schema": ${JSON.stringify(CONFIG_SCHEMA_URL)},`;
  await Deno.writeTextFile(configPath, before + schemaLine + after);
}
