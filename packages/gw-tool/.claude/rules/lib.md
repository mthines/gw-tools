---
paths: src/lib/**/*.ts
---

# Library Module Rules

## Module Organization

Each lib file should have a single responsibility:

- `config.ts` - Config loading/saving with migration support
- `config-migrations.ts` - Schema migration definitions
- `types.ts` - All TypeScript interfaces with JSDoc
- `output.ts` - Colored CLI output helpers
- `hooks.ts` - Hook execution with variable substitution
- `path-resolver.ts` - Worktree path resolution
- `git-proxy.ts` - Git command execution utilities

## Type Definitions (types.ts)

All interfaces go in `types.ts` with JSDoc comments:

```typescript
/**
 * Per-repository configuration stored at .gw/config.json
 *
 * Safe to commit. Machine-specific state is never written here.
 */
export interface Config {
  /** Config schema version for migrations (managed automatically) */
  configVersion?: number;
  /** Default source worktree name */
  defaultBranch?: string;
  /** Files to automatically copy when creating worktrees */
  autoCopyFiles?: string[];
  /** Command hooks configuration */
  hooks?: HooksConfig;
}
```

## Config Migrations (config-migrations.ts)

Never add backwards-compat code in commands. Add migrations instead:

```typescript
export const CURRENT_CONFIG_VERSION = 2; // increment this

export const MIGRATIONS: Migration[] = [
  {
    version: 2,
    description: 'Rename oldField to newField',
    migrate: (config) => {
      if (config.oldField !== undefined) {
        config.newField = config.oldField;
        delete config.oldField;
      }
      config.configVersion = 2;
      return config;
    },
  },
];
```

When you touch the `Config` interface or add a migration, you MUST also
update `packages/gw-tool/schemas/gw-config.schema.json` so the JSON Schema
matches the post-migration shape. The schema uses `additionalProperties:
false` and is referenced via `$schema` in committed configs — any drift
shows up as IDE validation errors. Bump the `configVersion` `default`
in the schema to the new `CURRENT_CONFIG_VERSION` and remove any
properties that the migration deletes.

## Output Module Usage

```typescript
import * as output from './output.ts';

// Status messages (with badges and newlines)
output.error('Failed'); // Red ERROR badge
output.success('Done'); // Green SUCCESS badge
output.warning('Caution'); // Yellow WARNING badge
output.info('Note'); // Blue INFO badge

// Inline formatting (no badges)
console.log(`Path: ${output.path('/path/to/file')}`);
console.log(`${output.checkmark()} Copied`);
```
