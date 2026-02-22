/**
 * Test fixtures for creating configs and test data
 */

import { join } from '$std/path';
import { parse as parseJsonc } from '$std/jsonc';
import type { Config } from '../lib/types.ts';

/**
 * Create a minimal valid config
 */
export function createMinimalConfig(root: string): Config {
  return {
    root,
    defaultBranch: 'main',
    cleanThreshold: 7,
  };
}

/**
 * Create a config with auto-copy files
 */
export function createConfigWithAutoCopy(root: string, files: string[]): Config {
  return {
    root,
    defaultBranch: 'main',
    autoCopyFiles: files,
    cleanThreshold: 7,
  };
}

/**
 * Create a config with hooks
 */
export function createConfigWithHooks(root: string, preCheckout?: string[], postCheckout?: string[]): Config {
  const config: Config = {
    root,
    defaultBranch: 'main',
    cleanThreshold: 7,
  };

  if (preCheckout || postCheckout) {
    config.hooks = {
      checkout: {},
    };
    if (preCheckout) {
      config.hooks.checkout!.pre = preCheckout;
    }
    if (postCheckout) {
      config.hooks.checkout!.post = postCheckout;
    }
  }

  return config;
}

/**
 * Create a config with auto-clean enabled
 */
export function createConfigWithAutoClean(root: string, cleanThreshold?: number): Config {
  return {
    root,
    defaultBranch: 'main',
    cleanThreshold: cleanThreshold ?? 7,
    autoClean: true,
  };
}

/**
 * Create a config with custom default branch
 */
export function createConfigWithDefaultBranch(root: string, defaultBranch: string): Config {
  return {
    root,
    defaultBranch,
    cleanThreshold: 7,
  };
}

/**
 * Write config to .gw/config.json
 */
export async function writeTestConfig(repoPath: string, config: Config): Promise<void> {
  const configDir = join(repoPath, '.gw');
  await Deno.mkdir(configDir, { recursive: true });
  const configPath = join(configDir, 'config.json');
  await Deno.writeTextFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Read config from .gw/config.json
 * Supports both JSON and JSONC formats
 */
export async function readTestConfig(repoPath: string): Promise<Config> {
  const configPath = join(repoPath, '.gw', 'config.json');
  const content = await Deno.readTextFile(configPath);
  return parseJsonc(content) as Config;
}
