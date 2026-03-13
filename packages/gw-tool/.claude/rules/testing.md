---
paths: src/**/*.test.ts
---

# Testing Guidelines

## Running Tests

```bash
nx run gw-tool:test              # Run all tests
deno test --allow-all src/lib/config.test.ts  # Run specific test file
```

## Test Structure

Tests are colocated with source files:

- `src/lib/config.ts` → `src/lib/config.test.ts`
- `src/commands/checkout.ts` → `src/commands/checkout.test.ts`

## Test Utilities

Use test utilities from `src/test-utils/`:

```typescript
import { createTempGitRepo, cleanupTempDir } from '../test-utils/git.ts';

Deno.test('my test', async () => {
  const { repoPath, cleanup } = await createTempGitRepo();
  try {
    // test code
  } finally {
    await cleanup();
  }
});
```

## Assertions

Use Deno's standard assertions:

```typescript
import { assertEquals, assertExists, assertRejects } from '@std/assert';
```

## Config Migration Tests

When adding a migration to `config-migrations.ts`, add corresponding tests in `config-migrations.test.ts`:

```typescript
Deno.test('migration v1 to v2: renames oldField to newField', async () => {
  const oldConfig = { configVersion: 1, oldField: 'value' };
  const migrated = migrateConfig(oldConfig);
  assertEquals(migrated.newField, 'value');
  assertEquals(migrated.oldField, undefined);
  assertEquals(migrated.configVersion, 2);
});
```
