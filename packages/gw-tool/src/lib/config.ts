/**
 * Configuration management for the gw CLI tool
 * Config is stored at .gw/config.json (searched walking up from cwd)
 */

import { join, resolve } from "$std/path";
import type { Config } from "./types.ts";
import { findGitRoot, pathExists } from "./path-resolver.ts";

const CONFIG_DIR_NAME = ".gw";
const CONFIG_FILE_NAME = "config.json";

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

    const parentPath = resolve(currentPath, "..");

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
    defaultBranch: "main",
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

  if (config.root !== undefined && typeof config.root !== "string") {
    return false;
  }

  if (
    config.defaultBranch !== undefined &&
    typeof config.defaultBranch !== "string"
  ) {
    return false;
  }

  if (config.autoCopyFiles !== undefined) {
    if (!Array.isArray(config.autoCopyFiles)) {
      return false;
    }
    // Validate that all items are strings
    if (!config.autoCopyFiles.every((item) => typeof item === "string")) {
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
      const data = JSON.parse(content);

      if (!validateConfig(data)) {
        throw new Error("Invalid configuration file format");
      }

      // If config has root, use it
      if (data.root) {
        return { config: data, gitRoot: data.root };
      }

      // Config exists but no root - try auto-detection and update config
      try {
        const detectedRoot = await findGitRoot();
        data.root = detectedRoot;
        await saveConfig(detectedRoot, data);
        console.log(`Detected git root and updated config: ${detectedRoot}\n`);
        return { config: data, gitRoot: detectedRoot };
      } catch {
        throw new Error(
          "Could not auto-detect git root. Please run 'gw init --root <path>' to specify the repository root manually.",
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
      "Could not auto-detect git root. Please run 'gw init --root <path>' to specify the repository root manually.",
    );
  }
}

/**
 * Save configuration to disk
 * @param dir Directory where .gw/config.json should be saved (typically the git root)
 * @param config Configuration to save
 */
export async function saveConfig(
  dir: string,
  config: Config,
): Promise<void> {
  await ensureConfigDir(dir);
  const configPath = getConfigPath(dir);
  const content = JSON.stringify(config, null, 2);
  await Deno.writeTextFile(configPath, content);
}
