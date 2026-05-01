# gw-tool

Deno CLI for git worktree management with auto-copy, hooks, and sync features.

## Commands

```bash
# Development
nx run gw-tool:dev -- <args>     # Run with watch mode
nx run gw-tool:run -- <args>     # Run once

# Quality
nx run gw-tool:check             # Type check (deno check)
nx run gw-tool:lint              # Lint
nx run gw-tool:fmt               # Format
nx run gw-tool:test              # Run tests

# Build
nx run gw-tool:compile           # Compile binary (current platform)
nx run gw-tool:compile-all       # Compile for all platforms
nx run gw-tool:release           # Automated release
```

## Code Style

- **Files**: kebab-case (`install-shell.ts`, not `installShell.ts`)
- **Imports**: Always include `.ts` extension, use `@std/` for Deno stdlib (via JSR)
- **Formatting**: 2 spaces, double quotes, semicolons required, 80 char line width
- **Types**: Define in `src/lib/types.ts` with JSDoc comments
- **Output**: Use `* as output from '../lib/output.ts'` for colored CLI messages

## Architecture

```
src/
├── main.ts              # CLI entry point, command dispatcher
├── commands/            # One file per command
│   ├── checkout.ts      # Custom: create worktree + auto-copy
│   ├── sync.ts          # Custom: sync files between worktrees
│   └── list.ts          # Proxy: wraps `git worktree list`
└── lib/                 # Shared utilities
    ├── types.ts         # All TypeScript interfaces
    ├── config.ts        # Config loading with migrations
    ├── config-migrations.ts  # Schema migration system
    └── output.ts        # Colored output formatting

schemas/
└── gw-config.schema.json # JSON Schema for .gw/config.json (IDE validation)
```

## Key Patterns

### Adding New Commands

1. Create `src/commands/<name>.ts` with `execute<Name>()` export
2. Register in `src/main.ts` COMMANDS map
3. Update help in `src/lib/cli.ts`

### Config Migrations (IMPORTANT)

When changing `.gw/config.json` schema, add a migration in `config-migrations.ts`:

1. Increment `CURRENT_CONFIG_VERSION`
2. Add migration to `MIGRATIONS` array
3. Update types in `types.ts`
4. Update `schemas/gw-config.schema.json` to match the new `Config` shape (properties, defaults, `configVersion` default). The schema is `additionalProperties: false`, so any drift causes IDE validation errors.

Never add backwards-compatibility code in commands - migrations handle it.

## Documentation Requirements

When adding/changing features, update:

1. `packages/gw-tool/README.md` - User-facing docs
2. Help text in command file's `show<Name>Help()` function
3. Root `CLAUDE.md` if it affects the overall project
4. `packages/gw-tool/schemas/gw-config.schema.json` - if any change touches the `Config` shape

## References

@.claude/README.md
