/**
 * Configuration migration system for .gw/config.json
 *
 * This module handles automatic migration of config files when the schema changes.
 * Each migration transforms the config from one version to the next.
 *
 * ## Adding a new migration:
 *
 * 1. Increment CURRENT_CONFIG_VERSION
 * 2. Add a new Migration object to the MIGRATIONS array
 * 3. The migrate function receives the config and a warnings array (mutate it)
 *    and returns the transformed config
 * 4. Always set configVersion in your migration
 *
 * ## Example migration:
 *
 * ```typescript
 * {
 *   version: 2,
 *   description: 'Rename someOldField to someNewField',
 *   migrate: (config, _warnings) => {
 *     if (config.someOldField !== undefined) {
 *       config.someNewField = config.someOldField;
 *       delete config.someOldField;
 *     }
 *     config.configVersion = 2;
 *     return config;
 *   },
 * }
 * ```
 */

import type { Config } from './types.ts';

/**
 * Current config version - increment when adding migrations
 */
export const CURRENT_CONFIG_VERSION = 4;

/**
 * Migration definition
 */
export interface Migration {
  /** Target version after this migration runs */
  version: number;
  /** Human-readable description of what this migration does */
  description: string;
  /**
   * Transform function that migrates the config.
   * May push non-fatal warning strings into the `warnings` array.
   */
  migrate: (config: Record<string, unknown>, warnings: string[]) => Record<string, unknown>;
}

/**
 * All migrations in order. Each migration transforms config from (version-1) to (version).
 * Migrations are run sequentially from the config's current version to CURRENT_CONFIG_VERSION.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Rename hooks.add to hooks.checkout (command rename)',
    migrate: (config, _warnings) => {
      // Migration: hooks.add -> hooks.checkout
      const hooks = config.hooks as Record<string, unknown> | undefined;
      if (hooks?.add && !hooks?.checkout) {
        hooks.checkout = hooks.add;
        delete hooks.add;
      }
      config.configVersion = 1;
      return config;
    },
  },
  {
    version: 2,
    description: 'Remove machine-specific fields to make config committable',
    migrate: (config, _warnings) => {
      delete config.root;
      delete config.lastAutoCleanTime;
      config.configVersion = 2;
      return config;
    },
  },
  {
    version: 3,
    description: 'Add opt-in telemetry configuration support',
    migrate: (config, _warnings) => {
      // `telemetry` is a new optional field — no data transformation is
      // needed. Bump the version so the schema default stays in sync and
      // existing configs adopt the current version on next load.
      config.configVersion = 3;
      return config;
    },
  },
  {
    version: 4,
    description: 'Strip telemetry.enabled from committed config (per-machine opt-in)',
    migrate: (config, warnings) => {
      const telemetry = config.telemetry as Record<string, unknown> | undefined;
      if (telemetry && 'enabled' in telemetry) {
        delete telemetry.enabled;
        warnings.push(
          'telemetry.enabled was removed from .gw/config.json — ' +
            'it has no effect in the committed config. ' +
            'Run `gw telemetry on` to opt in on this machine.'
        );
      }
      config.configVersion = 4;
      return config;
    },
  },
];

/**
 * Result of running migrations
 */
export interface MigrationResult {
  /** The migrated config */
  config: Config;
  /** Whether any migrations were applied */
  migrated: boolean;
  /** List of migrations that were applied */
  appliedMigrations: string[];
  /** Non-fatal warnings produced during migration (e.g. deprecated field notices). */
  warnings: string[];
}

/**
 * Run all necessary migrations on a config object.
 *
 * @param rawConfig - The raw config object loaded from file
 * @returns Migration result with the migrated config and info about what changed
 */
export function runMigrations(rawConfig: Record<string, unknown>): MigrationResult {
  const currentVersion = (rawConfig.configVersion as number) ?? 0;
  const appliedMigrations: string[] = [];
  const warnings: string[] = [];

  // If already at current version, no migrations needed
  if (currentVersion >= CURRENT_CONFIG_VERSION) {
    return {
      config: rawConfig as Config,
      migrated: false,
      appliedMigrations: [],
      warnings: [],
    };
  }

  // Apply each migration in sequence
  let config = { ...rawConfig };

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      config = migration.migrate(config, warnings);
      appliedMigrations.push(`v${migration.version}: ${migration.description}`);
    }
  }

  return {
    config: config as Config,
    migrated: appliedMigrations.length > 0,
    appliedMigrations,
    warnings,
  };
}

/**
 * Check if a config needs migration
 *
 * @param config - The config to check
 * @returns true if the config version is below current
 */
export function needsMigration(config: Record<string, unknown>): boolean {
  const currentVersion = (config.configVersion as number) ?? 0;
  return currentVersion < CURRENT_CONFIG_VERSION;
}
