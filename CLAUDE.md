<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

# gw-tools Development Guidelines

## Documentation Requirements

When adding, changing, or removing features in the gw CLI tool, always update the relevant documentation:

1. **README files:**
   - `packages/gw-tool/README.md` - Main CLI documentation
   - `README.md` - Root repo overview (if applicable)

2. **Skills documentation:**
   - `skills/config-management/SKILL.md` - Configuration-related features
   - `skills/git-worktree-workflows/SKILL.md` - Worktree workflow features
   - `skills/autonomous-workflow/SKILL.md` - Autonomous workflow features (@gw-autonomous-workflow)

3. **Example files** (in `skills/*/examples/`):
   - Update relevant examples that reference the changed feature
   - Check troubleshooting guides for outdated information

4. **Help text:**
   - Update CLI help text in `packages/gw-tool/src/lib/cli.ts`

## Config Migration System

The `.gw/config.json` file uses a versioned migration system for schema changes. When the config structure changes, add a migration instead of backwards compatibility code.

### How It Works

1. Config files have a `configVersion` field (defaults to 0 if missing)
2. On load, `loadConfig()` runs migrations from current version to `CURRENT_CONFIG_VERSION`
3. If migrations were applied, the config is automatically saved

### Adding a New Migration

1. **Increment the version** in `packages/gw-tool/src/lib/config-migrations.ts`:

   ```typescript
   export const CURRENT_CONFIG_VERSION = 2; // was 1
   ```

2. **Add a migration** to the `MIGRATIONS` array:

   ```typescript
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
   }
   ```

3. **Update types** in `packages/gw-tool/src/lib/types.ts` to reflect the new schema

4. **Remove old field handling** from commands - migrations handle backwards compat

### Migration Guidelines

- Migrations run in order from config's version to current
- Always set `config.configVersion` at the end of your migration
- Handle missing fields gracefully (check `!== undefined`)
- Delete old fields after migrating to keep config clean
- Add tests for migrations in `config-migrations.test.ts`

### Example: hooks.add -> hooks.checkout Migration

```typescript
{
  version: 1,
  description: 'Rename hooks.add to hooks.checkout (command rename)',
  migrate: (config) => {
    const hooks = config.hooks as Record<string, unknown> | undefined;
    if (hooks?.add && !hooks?.checkout) {
      hooks.checkout = hooks.add;
      delete hooks.add;
    }
    config.configVersion = 1;
    return config;
  },
}
```

## Autonomous Workflow Guidelines

When the user requests autonomous feature development or end-to-end implementation:

1. **Use the @gw-autonomous-workflow skill** - It provides complete procedures for autonomous execution
2. **Phase 0 is MANDATORY** - Always start by asking clarifying questions and validating understanding
3. **Iterate continuously** - Self-validate and refine at every step, no hard iteration limits
4. **Follow the 8 phases**:
   - Phase 0: Validation & Questions (MANDATORY)
   - Phase 1: Task Intake & Planning
   - Phase 2: Worktree Setup
   - Phase 3: Implementation
   - Phase 4: Testing & Iteration
   - Phase 5: Documentation
   - Phase 6: PR Creation & Delivery
   - Phase 7: Cleanup (Optional)

5. **Quality gates** - Don't proceed to next phase until current phase is validated
6. **Stop and ask** when encountering fundamental blockers or ambiguities
