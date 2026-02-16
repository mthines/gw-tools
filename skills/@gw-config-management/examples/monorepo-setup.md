# Setting Up gw for Monorepo Projects

Configure gw for monorepos using pnpm, Yarn, or npm workspaces.

## Scenario

You have a monorepo with multiple packages:

- Shared environment variables at the root
- Package-specific configurations
- Secrets that need to be available across all packages

## Prerequisites

- gw CLI installed
- A monorepo with workspace configuration
- Understanding of your package structure

## Example Monorepo Structure

```
my-monorepo/
├── .env                    # Root environment variables
├── .gw/
│   └── config.json        # gw configuration
├── pnpm-workspace.yaml    # or package.json workspaces
├── packages/
│   ├── api/
│   │   ├── .env           # API-specific secrets
│   │   └── package.json
│   ├── web/
│   │   ├── .env           # Web app config
│   │   ├── .vercel/       # Vercel deployment
│   │   └── package.json
│   └── shared/
│       └── package.json
└── apps/
    └── mobile/
        ├── .env
        └── package.json
```

## Step-by-Step Setup

### 1. Initialize gw at Monorepo Root

```bash
cd /path/to/my-monorepo
gw init
```

### 2. Configure Auto-Copy for All Packages

```bash
gw init --auto-copy-files \
  .env,\
  packages/api/.env,\
  packages/web/.env,\
  packages/web/.vercel/,\
  apps/mobile/.env
```

### 3. Final Configuration

`.gw/config.json`:

```json
{
  "root": "/Users/you/projects/my-monorepo.git",
  "defaultBranch": "main",
  "autoCopyFiles": [
    ".env",
    "packages/api/.env",
    "packages/api/secrets/",
    "packages/web/.env",
    "packages/web/.vercel/",
    "apps/mobile/.env",
    "apps/mobile/google-services.json"
  ]
}
```

---

## Package Manager Considerations

### pnpm Workspaces

pnpm shares dependencies efficiently, but each worktree still needs its own `node_modules`:

```bash
# After creating worktree
gw add feat/new-feature
gw cd feat/new-feature

# Install all workspace dependencies
pnpm install
```

**Tip:** pnpm's content-addressable store means shared packages don't duplicate on disk.

### Yarn Workspaces

```bash
gw add feat/new-feature
gw cd feat/new-feature
yarn install
```

### npm Workspaces

```bash
gw add feat/new-feature
gw cd feat/new-feature
npm install
```

---

## Common Patterns

### Pattern 1: Nx Monorepo

```json
{
  "autoCopyFiles": [".env", ".env.local", "apps/api/.env", "apps/web/.env", "libs/shared-config/.env"]
}
```

### Pattern 2: Turborepo

```json
{
  "autoCopyFiles": [".env", "apps/*/.env", "packages/config/.env"]
}
```

**Note:** Glob patterns aren't supported yet. List files explicitly.

### Pattern 3: Full-Stack (API + Web + Mobile)

```json
{
  "autoCopyFiles": [
    ".env",
    "apps/api/.env",
    "apps/api/ssl/",
    "apps/web/.env",
    "apps/web/.vercel/",
    "apps/mobile/.env",
    "apps/mobile/google-services.json",
    "apps/mobile/ios/GoogleService-Info.plist"
  ]
}
```

---

## Workflow Example

```bash
# 1. Create feature worktree
gw add feat/unified-auth

# Output:
# Creating worktree: feat/unified-auth
# Copying files to new worktree...
#   ✓ Copied: .env
#   ✓ Copied: packages/api/.env
#   ✓ Copied: packages/web/.env
#   ✓ Copied: packages/web/.vercel/
#   ✓ Copied: apps/mobile/.env

# 2. Navigate and install dependencies
gw cd feat/unified-auth
pnpm install

# 3. Start development (multiple packages)
# Terminal 1:
pnpm --filter api dev

# Terminal 2:
pnpm --filter web dev

# 4. Work across packages
# Changes in packages/shared/ are immediately available to api and web

# 5. Commit and push
git add .
git commit -m "feat: implement unified auth across all apps"
git push origin feat/unified-auth
```

---

## Handling Shared Dependencies

### Option 1: Symlink node_modules (Advanced)

Not recommended for monorepos - let your package manager handle it.

### Option 2: Use Post-Add Hooks

Configure automatic dependency installation:

```bash
gw init --post-add "pnpm install"
```

This runs `pnpm install` automatically after creating each worktree.

### Option 3: Turbo/Nx Caching

If using Turborepo or Nx, their caching works across worktrees:

```bash
# In feat/unified-auth worktree
pnpm turbo build  # Uses cache from other worktrees
```

---

## Team Configuration

### Commit Configuration

```bash
git add .gw/config.json
git commit -m "chore: configure gw for monorepo"
```

### Document for Team

Add to your README:

```markdown
## Development Setup

### Creating Feature Worktrees

gw add feat/your-feature
gw cd feat/your-feature
pnpm install

This automatically copies:

- Root `.env` (shared config)
- Package-specific `.env` files
- Vercel deployment configs
```

---

## Troubleshooting

### Package-Specific File Not Copied

**Problem:** `packages/api/.env` wasn't copied

**Solution:** Ensure exact path in config:

```json
{
  "autoCopyFiles": [
    "packages/api/.env" // Not "api/.env"
  ]
}
```

### Dependencies Not Resolving

**Problem:** After creating worktree, imports fail

**Solution:** Always run package manager install:

```bash
gw cd feat/new-feature
pnpm install  # or npm/yarn
```

### Different Package Versions Needed

**Problem:** Testing feature with different dependency versions

**Solution:** Each worktree has independent `node_modules`:

```bash
# In feat/test-react-19
cd packages/web
pnpm add react@19

# Doesn't affect main worktree
```

---

## Next Steps

- See [Troubleshooting Guide](./troubleshooting-config.md) for more issues
- Check [autonomous-workflow skill](../../autonomous-workflow/) for autonomous feature development

---

_Part of the [config-management skill](../README.md)_
