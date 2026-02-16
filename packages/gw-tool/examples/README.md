# gw Configuration Examples

This directory contains example `.gw/config.json` files for various project types and use cases. Copy and adapt these examples to fit your project's needs.

## Quick Start

1. Choose an example that matches your project type
2. Copy it to your project's root as `.gw/config.json`
3. Adjust the `root` path and other settings as needed
4. Test with `gw add test-worktree`

## Available Examples

### Basic Configurations

- **[config.minimal.json](./config.minimal.json)** - Bare minimum configuration
  - Good starting point for simple projects
  - Only sets the essential `root` and `defaultBranch`

- **[config.basic-auto-copy.json](./config.basic-auto-copy.json)** - Basic config with auto-copy
  - Automatically copies `.env` files to new worktrees
  - Good for most projects that use environment variables

### Framework-Specific

- **[config.nextjs.json](./config.nextjs.json)** - Next.js application
  - Copies environment files and Vercel configuration
  - Includes post-add hook for dependency installation
  - Suitable for Next.js apps deployed on Vercel

- **[config.nodejs-api.json](./config.nodejs-api.json)** - Node.js REST API
  - Copies database config and environment files
  - Includes hooks for database migrations
  - Good for Express, Fastify, or similar backends

- **[config.react-spa.json](./config.react-spa.json)** - React single-page app
  - Copies environment files and public assets
  - Post-add hook installs dependencies
  - Works with Create React App, Vite, etc.

### Advanced Configurations

- **[config.monorepo.json](./config.monorepo.json)** - Monorepo setup
  - Copies root-level config and shared dependencies
  - Configured for projects with multiple packages
  - Includes workspace-aware hooks

- **[config.full-featured.json](./config.full-featured.json)** - All features enabled
  - Demonstrates every available configuration option
  - Includes pre/post hooks for complex workflows
  - Custom clean threshold for worktree management

- **[config.ci-cd.json](./config.ci-cd.json)** - CI/CD integration
  - Hooks for running tests and linting
  - Database setup/teardown for testing
  - Good for teams with automated workflows

- **[config.team-collab.json](./config.team-collab.json)** - Team collaboration
  - Shared hooks for consistent setup across team
  - Documentation generation hooks
  - Code quality checks on worktree creation

## Configuration Options Reference

### Core Options

- **`root`** (string, required): Absolute path to the git repository root
- **`defaultBranch`** (string, optional): Default source branch, defaults to `"main"`
- **`cleanThreshold`** (number, optional): Days before worktrees are considered stale, defaults to `7`

### Auto-Copy Files

- **`autoCopyFiles`** (array of strings, optional): Files/directories to automatically copy when creating worktrees

Example:

```json
{
  "autoCopyFiles": [".env", ".env.local", "config/database.yml", "public/uploads/"]
}
```

### Hooks

- **`hooks.add.pre`** (array of strings, optional): Commands to run before creating a worktree
- **`hooks.add.post`** (array of strings, optional): Commands to run after creating a worktree

Available hook variables:

- `{worktree}` - The worktree name
- `{worktreePath}` - Full absolute path to the worktree
- `{gitRoot}` - The git repository root path
- `{branch}` - The branch name

Example:

```json
{
  "hooks": {
    "add": {
      "pre": ["echo 'Creating worktree: {worktree}'"],
      "post": ["cd {worktreePath} && pnpm install", "echo 'Worktree {worktree} is ready!'"]
    }
  }
}
```

## Tips

### Path Handling

- Use relative paths in `autoCopyFiles` (relative to repository root)
- The `root` field should always be an absolute path
- Directory paths in `autoCopyFiles` should end with `/`

### Testing Your Configuration

```bash
# Create a test worktree to verify config
gw add test-config-check

# Verify files were copied correctly
ls -la test-config-check/

# Clean up
gw remove test-config-check
```

### Committing Configuration

It's recommended to commit `.gw/config.json` to your repository so the entire team uses the same configuration:

```bash
git add .gw/config.json
git commit -m "chore: add gw configuration for team"
```

### Ignoring Copied Files

Add copied files to your `.gitignore` if they shouldn't be committed:

```gitignore
# Environment files copied by gw
.env.local
.env.development
```

## Need Help?

- See the main [README](../README.md) for full documentation
- Check the [config-management skill](../../../skills/config-management/) for detailed guides
- Run `gw init --help` for initialization options
