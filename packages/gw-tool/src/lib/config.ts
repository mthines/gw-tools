/**
 * Configuration management for the gw CLI tool
 * Config is stored at <git-root>/.gw/config.json
 */

import { join } from "$std/path";
import type { Config } from "./types.ts";
import { findGitRoot } from "./path-resolver.ts";

const CONFIG_DIR_NAME = ".gw";
const CONFIG_FILE_NAME = "config.json";

/**
 * Get the path to the config directory for the current git repository
 * @param gitRoot Git repository root path
 */
function getConfigDir(gitRoot: string): string {
  return join(gitRoot, CONFIG_DIR_NAME);
}

/**
 * Get the full path to the config file
 * @param gitRoot Git repository root path
 */
function getConfigPath(gitRoot: string): string {
  return join(getConfigDir(gitRoot), CONFIG_FILE_NAME);
}

/**
 * Ensure the config directory exists
 * @param gitRoot Git repository root path
 */
async function ensureConfigDir(gitRoot: string): Promise<void> {
  const configDir = getConfigDir(gitRoot);
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
    defaultSource: "main",
  };
}

/**
 * Validate the config structure
 */
function validateConfig(data: unknown): data is Config {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const config = data as Partial<Config>;

  if (
    config.defaultSource !== undefined &&
    typeof config.defaultSource !== "string"
  ) {
    return false;
  }

  return true;
}

/**
 * Load configuration from the current git repository
 * Creates a default config if the file doesn't exist
 *
 * @returns Config and git root path
 */
export async function loadConfig(): Promise<{
  config: Config;
  gitRoot: string;
}> {
  // Find git root
  const gitRoot = await findGitRoot();
  const configPath = getConfigPath(gitRoot);

  try {
    const content = await Deno.readTextFile(configPath);
    const data = JSON.parse(content);

    if (!validateConfig(data)) {
      throw new Error("Invalid configuration file format");
    }

    return { config: data, gitRoot };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // Config file doesn't exist, create default
      const defaultConfig = createDefaultConfig();
      await saveConfig(gitRoot, defaultConfig);

      console.log(`Created config at ${configPath}`);
      console.log(`Default source worktree: ${defaultConfig.defaultSource}\n`);

      return { config: defaultConfig, gitRoot };
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config: ${message}`);
  }
}

/**
 * Save configuration to disk
 * @param gitRoot Git repository root path
 * @param config Configuration to save
 */
export async function saveConfig(
  gitRoot: string,
  config: Config,
): Promise<void> {
  await ensureConfigDir(gitRoot);
  const configPath = getConfigPath(gitRoot);
  const content = JSON.stringify(config, null, 2);
  await Deno.writeTextFile(configPath, content);
}
