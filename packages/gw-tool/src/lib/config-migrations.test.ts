/**
 * Tests for config-migrations.ts
 */

import { assertEquals } from '@std/assert';
import { CURRENT_CONFIG_VERSION, MIGRATIONS, needsMigration, runMigrations } from './config-migrations.ts';

Deno.test('runMigrations - returns config unchanged when already at current version', () => {
  const config = {
    configVersion: CURRENT_CONFIG_VERSION,
    defaultBranch: 'main',
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, false);
  assertEquals(result.appliedMigrations, []);
  assertEquals(result.config.configVersion, CURRENT_CONFIG_VERSION);
});

Deno.test('runMigrations - migrates hooks.add to hooks.checkout (v0 -> v1)', () => {
  const config = {
    root: '/test/path',
    defaultBranch: 'main',
    hooks: {
      add: {
        pre: ['echo pre'],
        post: ['npm install'],
      },
    },
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  // v1, v2, and v3 are all applied starting from v0
  assertEquals(result.appliedMigrations.length, 3);
  assertEquals(result.appliedMigrations[0], 'v1: Rename hooks.add to hooks.checkout (command rename)');
  assertEquals(result.appliedMigrations[1], 'v2: Remove machine-specific fields to make config committable');
  assertEquals(result.appliedMigrations[2], 'v3: Add protectedBranches field (no-op — new optional field)');
  assertEquals(result.config.configVersion, 3);
  assertEquals(result.config.hooks?.checkout?.pre, ['echo pre']);
  assertEquals(result.config.hooks?.checkout?.post, ['npm install']);
  assertEquals((result.config.hooks as Record<string, unknown>).add, undefined);
  // root should have been removed by v2
  assertEquals((result.config as Record<string, unknown>).root, undefined);
});

Deno.test('runMigrations - does not overwrite existing hooks.checkout', () => {
  const config = {
    root: '/test/path',
    defaultBranch: 'main',
    hooks: {
      add: {
        pre: ['echo old'],
      },
      checkout: {
        pre: ['echo new'],
        post: ['npm install'],
      },
    },
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  // Should keep existing checkout hooks, not overwrite with add
  assertEquals(result.config.hooks?.checkout?.pre, ['echo new']);
  assertEquals(result.config.hooks?.checkout?.post, ['npm install']);
});

Deno.test('runMigrations - handles config without hooks', () => {
  const config = {
    root: '/test/path',
    defaultBranch: 'main',
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  assertEquals(result.config.configVersion, 3);
  assertEquals(result.config.hooks, undefined);
  assertEquals((result.config as Record<string, unknown>).root, undefined);
});

Deno.test('runMigrations - handles config with empty hooks', () => {
  const config = {
    root: '/test/path',
    defaultBranch: 'main',
    hooks: {},
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  assertEquals(result.config.configVersion, 3);
});

Deno.test('needsMigration - returns true for config without version', () => {
  const config = {
    root: '/test/path',
    defaultBranch: 'main',
  };

  assertEquals(needsMigration(config), true);
});

Deno.test('needsMigration - returns true for config with old version', () => {
  const config = {
    configVersion: 0,
    root: '/test/path',
    defaultBranch: 'main',
  };

  assertEquals(needsMigration(config), true);
});

Deno.test('needsMigration - returns false for config at current version', () => {
  const config = {
    configVersion: CURRENT_CONFIG_VERSION,
    root: '/test/path',
    defaultBranch: 'main',
  };

  assertEquals(needsMigration(config), false);
});

Deno.test('MIGRATIONS array is properly ordered', () => {
  // Migrations should be in ascending version order
  for (let i = 1; i < MIGRATIONS.length; i++) {
    assertEquals(MIGRATIONS[i].version > MIGRATIONS[i - 1].version, true);
  }
});

Deno.test('All migrations have required fields', () => {
  for (const migration of MIGRATIONS) {
    assertEquals(typeof migration.version, 'number');
    assertEquals(typeof migration.description, 'string');
    assertEquals(typeof migration.migrate, 'function');
    assertEquals(migration.version > 0, true);
    assertEquals(migration.description.length > 0, true);
  }
});

Deno.test('runMigrations - v2: removes root and lastAutoCleanTime fields', () => {
  const config = {
    configVersion: 1,
    root: '/some/absolute/path',
    lastAutoCleanTime: 1234567890,
    defaultBranch: 'main',
    cleanThreshold: 7,
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  // v2 and v3 are both applied starting from v1
  assertEquals(result.appliedMigrations.length, 2);
  assertEquals(result.appliedMigrations[0], 'v2: Remove machine-specific fields to make config committable');
  assertEquals(result.appliedMigrations[1], 'v3: Add protectedBranches field (no-op — new optional field)');
  assertEquals(result.config.configVersion, 3);
  assertEquals((result.config as Record<string, unknown>).root, undefined);
  assertEquals((result.config as Record<string, unknown>).lastAutoCleanTime, undefined);
  // Other fields should be preserved
  assertEquals(result.config.defaultBranch, 'main');
  assertEquals(result.config.cleanThreshold, 7);
});

Deno.test('runMigrations - v2: safe when root and lastAutoCleanTime are already absent', () => {
  const config = {
    configVersion: 1,
    defaultBranch: 'develop',
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  assertEquals(result.config.configVersion, 3);
  assertEquals((result.config as Record<string, unknown>).root, undefined);
  assertEquals((result.config as Record<string, unknown>).lastAutoCleanTime, undefined);
  assertEquals(result.config.defaultBranch, 'develop');
});

Deno.test('runMigrations - v3: no-op migration — preserves all existing fields', () => {
  const config = {
    configVersion: 2,
    defaultBranch: 'main',
    cleanThreshold: 14,
    autoClean: true,
    autoCopyFiles: ['.env'],
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  assertEquals(result.appliedMigrations.length, 1);
  assertEquals(result.appliedMigrations[0], 'v3: Add protectedBranches field (no-op — new optional field)');
  assertEquals(result.config.configVersion, 3);
  // All other fields preserved unchanged
  assertEquals(result.config.defaultBranch, 'main');
  assertEquals(result.config.cleanThreshold, 14);
  assertEquals(result.config.autoClean, true);
  assertEquals(result.config.autoCopyFiles, ['.env']);
});

Deno.test('runMigrations - v3: does not overwrite existing protectedBranches', () => {
  // If somehow a config at v2 already has protectedBranches, v3 must not wipe it
  const config = {
    configVersion: 2,
    defaultBranch: 'main',
    protectedBranches: ['staging', 'develop'],
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  assertEquals(result.config.configVersion, 3);
  assertEquals(result.config.protectedBranches, ['staging', 'develop']);
});

// ---------------------------------------------------------------------------
// futureVersion flag — binary is older than the committed config
// ---------------------------------------------------------------------------

Deno.test('runMigrations - futureVersion is false when config is at current version', () => {
  const config = {
    configVersion: CURRENT_CONFIG_VERSION,
    defaultBranch: 'main',
  };

  const result = runMigrations(config);

  assertEquals(result.futureVersion, false);
  assertEquals(result.migrated, false);
});

Deno.test('runMigrations - futureVersion is false when config needs migration (older version)', () => {
  const config = {
    configVersion: CURRENT_CONFIG_VERSION - 1,
    defaultBranch: 'main',
  };

  const result = runMigrations(config);

  assertEquals(result.futureVersion, false);
  assertEquals(result.migrated, true);
});

Deno.test('runMigrations - futureVersion is true when config version exceeds current', () => {
  const futureVersion = CURRENT_CONFIG_VERSION + 1;
  const config = {
    configVersion: futureVersion,
    defaultBranch: 'main',
    someNewField: 'value-from-the-future',
  };

  const result = runMigrations(config);

  assertEquals(result.futureVersion, true);
  assertEquals(result.migrated, false);
  assertEquals(result.appliedMigrations, []);
  // Config must be returned as-is — the binary should not strip unknown fields
  assertEquals((result.config as Record<string, unknown>).someNewField, 'value-from-the-future');
  assertEquals((result.config as Record<string, unknown>).configVersion, futureVersion);
});
