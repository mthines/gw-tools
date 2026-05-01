/**
 * Tests for config-migrations.ts
 */

import { assertEquals } from "@std/assert";
import {
  CURRENT_CONFIG_VERSION,
  MIGRATIONS,
  needsMigration,
  runMigrations,
} from "./config-migrations.ts";

Deno.test("runMigrations - returns config unchanged when already at current version", () => {
  const config = {
    configVersion: CURRENT_CONFIG_VERSION,
    defaultBranch: "main",
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, false);
  assertEquals(result.appliedMigrations, []);
  assertEquals(result.config.configVersion, CURRENT_CONFIG_VERSION);
});

Deno.test("runMigrations - migrates hooks.add to hooks.checkout (v0 -> v1)", () => {
  const config = {
    root: "/test/path",
    defaultBranch: "main",
    hooks: {
      add: {
        pre: ["echo pre"],
        post: ["npm install"],
      },
    },
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  // Both v1 and v2 are applied starting from v0
  assertEquals(result.appliedMigrations.length, 2);
  assertEquals(
    result.appliedMigrations[0],
    "v1: Rename hooks.add to hooks.checkout (command rename)",
  );
  assertEquals(
    result.appliedMigrations[1],
    "v2: Remove machine-specific fields to make config committable",
  );
  assertEquals(result.config.configVersion, 2);
  assertEquals(result.config.hooks?.checkout?.pre, ["echo pre"]);
  assertEquals(result.config.hooks?.checkout?.post, ["npm install"]);
  assertEquals((result.config.hooks as Record<string, unknown>).add, undefined);
  // root should have been removed by v2
  assertEquals((result.config as Record<string, unknown>).root, undefined);
});

Deno.test("runMigrations - does not overwrite existing hooks.checkout", () => {
  const config = {
    root: "/test/path",
    defaultBranch: "main",
    hooks: {
      add: {
        pre: ["echo old"],
      },
      checkout: {
        pre: ["echo new"],
        post: ["npm install"],
      },
    },
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  // Should keep existing checkout hooks, not overwrite with add
  assertEquals(result.config.hooks?.checkout?.pre, ["echo new"]);
  assertEquals(result.config.hooks?.checkout?.post, ["npm install"]);
});

Deno.test("runMigrations - handles config without hooks", () => {
  const config = {
    root: "/test/path",
    defaultBranch: "main",
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  assertEquals(result.config.configVersion, 2);
  assertEquals(result.config.hooks, undefined);
  assertEquals((result.config as Record<string, unknown>).root, undefined);
});

Deno.test("runMigrations - handles config with empty hooks", () => {
  const config = {
    root: "/test/path",
    defaultBranch: "main",
    hooks: {},
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  assertEquals(result.config.configVersion, 2);
});

Deno.test("needsMigration - returns true for config without version", () => {
  const config = {
    root: "/test/path",
    defaultBranch: "main",
  };

  assertEquals(needsMigration(config), true);
});

Deno.test("needsMigration - returns true for config with old version", () => {
  const config = {
    configVersion: 0,
    root: "/test/path",
    defaultBranch: "main",
  };

  assertEquals(needsMigration(config), true);
});

Deno.test("needsMigration - returns false for config at current version", () => {
  const config = {
    configVersion: CURRENT_CONFIG_VERSION,
    root: "/test/path",
    defaultBranch: "main",
  };

  assertEquals(needsMigration(config), false);
});

Deno.test("MIGRATIONS array is properly ordered", () => {
  // Migrations should be in ascending version order
  for (let i = 1; i < MIGRATIONS.length; i++) {
    assertEquals(MIGRATIONS[i].version > MIGRATIONS[i - 1].version, true);
  }
});

Deno.test("All migrations have required fields", () => {
  for (const migration of MIGRATIONS) {
    assertEquals(typeof migration.version, "number");
    assertEquals(typeof migration.description, "string");
    assertEquals(typeof migration.migrate, "function");
    assertEquals(migration.version > 0, true);
    assertEquals(migration.description.length > 0, true);
  }
});

Deno.test("runMigrations - v2: removes root and lastAutoCleanTime fields", () => {
  const config = {
    configVersion: 1,
    root: "/some/absolute/path",
    lastAutoCleanTime: 1234567890,
    defaultBranch: "main",
    cleanThreshold: 7,
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  assertEquals(result.appliedMigrations.length, 1);
  assertEquals(
    result.appliedMigrations[0],
    "v2: Remove machine-specific fields to make config committable",
  );
  assertEquals(result.config.configVersion, 2);
  assertEquals((result.config as Record<string, unknown>).root, undefined);
  assertEquals(
    (result.config as Record<string, unknown>).lastAutoCleanTime,
    undefined,
  );
  // Other fields should be preserved
  assertEquals(result.config.defaultBranch, "main");
  assertEquals(result.config.cleanThreshold, 7);
});

Deno.test("runMigrations - v2: safe when root and lastAutoCleanTime are already absent", () => {
  const config = {
    configVersion: 1,
    defaultBranch: "develop",
  };

  const result = runMigrations(config);

  assertEquals(result.migrated, true);
  assertEquals(result.config.configVersion, 2);
  assertEquals((result.config as Record<string, unknown>).root, undefined);
  assertEquals(
    (result.config as Record<string, unknown>).lastAutoCleanTime,
    undefined,
  );
  assertEquals(result.config.defaultBranch, "develop");
});
