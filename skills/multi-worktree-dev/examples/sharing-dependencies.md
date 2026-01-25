# Sharing Dependencies Across Worktrees

Strategies for managing node_modules and other dependencies efficiently.

## Scenario

You have 5 worktrees, each with a 500MB `node_modules` directory. That's 2.5GB of mostly duplicated packages. This guide shows how to reduce that footprint.

## Strategy Comparison

| Strategy | Disk Usage | Isolation | Complexity | Best For |
|----------|------------|-----------|------------|----------|
| Full duplication | High | Full | Low | Different versions |
| pnpm | Low | Full | Low | Most projects |
| Symlinks | Very Low | None | Medium | Identical deps |
| Yarn PnP | Low | Full | High | Yarn projects |

---

## Strategy 1: Use pnpm (Recommended)

pnpm stores packages once and creates hard links:

### Setup

```bash
# Install pnpm globally
npm install -g pnpm

# Convert existing project (in main worktree)
gw cd main
rm -rf node_modules package-lock.json
pnpm import  # Convert from package-lock.json
pnpm install
```

### Usage in Worktrees

```bash
# Create worktree
gw add feat/new-feature
gw cd feat/new-feature

# Install with pnpm (reuses cached packages)
pnpm install
```

### Disk Usage Comparison

```bash
# Before (npm)
du -sh */node_modules/
# main/node_modules/          512M
# feat/user-auth/node_modules/ 512M
# feat/payments/node_modules/  512M
# Total: 1.5GB

# After (pnpm)
du -sh */node_modules/
# main/node_modules/          512M
# feat/user-auth/node_modules/  8M  # Hard links!
# feat/payments/node_modules/   8M
# Total: ~530MB
```

### Configure Post-Add Hook

```bash
gw init --post-add "pnpm install"
```

---

## Strategy 2: Symlink node_modules (Advanced)

**Warning:** Only use when all worktrees need identical dependencies.

### Setup

```bash
# Feature worktree
gw cd feat/user-auth

# Remove existing node_modules
rm -rf node_modules

# Create symlink to main's node_modules
ln -s ../main/node_modules node_modules
```

### Verification

```bash
ls -la node_modules
# lrwxr-xr-x  node_modules -> ../main/node_modules

# Test that imports work
node -e "require('express')"
```

### Risks and Limitations

1. **Version conflicts:** If feature needs different version, symlink breaks
2. **Native modules:** May have path issues
3. **Lockfile conflicts:** Changes to package.json can cause issues
4. **Hoisting problems:** Some packages expect specific paths

### When It Works

- ✅ Read-only testing of existing code
- ✅ All worktrees on identical dependencies
- ✅ No package.json changes planned
- ✅ Pure JavaScript (no native modules)

### When It Doesn't Work

- ❌ Different dependency versions needed
- ❌ Native modules (node-gyp, etc.)
- ❌ Active package development
- ❌ Monorepos with workspace dependencies

---

## Strategy 3: Selective Sharing

Share large, stable dependencies while keeping others isolated:

### Example: Share Specific Packages

```bash
# In feature worktree
gw cd feat/user-auth

# Install normally
npm install

# Replace large stable package with symlink
rm -rf node_modules/.pnpm
ln -s ../../main/node_modules/.pnpm node_modules/.pnpm
```

### Example: Share Dev Dependencies Only

```bash
# Keep production deps isolated
npm install --production

# Symlink dev deps
ln -s ../main/node_modules/.bin node_modules/.bin
```

---

## Strategy 4: Docker-Based Isolation

For complete isolation with shared cache:

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    volumes:
      - .:/app
      - node_modules:/app/node_modules  # Named volume
    working_dir: /app

volumes:
  node_modules:  # Shared across containers
```

### Usage

```bash
# Each worktree uses same volume
gw cd feat/user-auth
docker-compose up

gw cd feat/payments
docker-compose up  # Reuses node_modules volume
```

---

## Automation Script

### Auto-Setup for New Worktrees

Create `~/.local/bin/gw-setup`:

```bash
#!/bin/bash
# Auto-setup script for gw worktrees

# Detect package manager
if [ -f "pnpm-lock.yaml" ]; then
  echo "Installing with pnpm..."
  pnpm install
elif [ -f "yarn.lock" ]; then
  echo "Installing with yarn..."
  yarn install
else
  echo "Installing with npm..."
  npm install
fi

echo "Setup complete!"
```

Configure as post-add hook:

```bash
gw init --post-add "~/.local/bin/gw-setup"
```

---

## Troubleshooting

### Symlink Broken After npm install

**Problem:** `npm install` in main broke the symlink

**Solution:** Re-create symlink or use pnpm instead

### Package Not Found

**Problem:** `Error: Cannot find module 'express'`

**Check:**
```bash
ls -la node_modules
# Should show symlink or actual directory
```

**Solution:**
```bash
# If symlink broken, recreate
rm node_modules
ln -s ../main/node_modules node_modules

# Or install fresh
npm install
```

### Native Module Errors

**Problem:** `Error: Module did not self-register`

**Cause:** Native modules compiled for different path

**Solution:** Don't symlink, use pnpm or full install

---

## Recommendation Summary

1. **Use pnpm** for new projects - best balance of efficiency and isolation
2. **Accept duplication** for projects with complex native dependencies
3. **Use symlinks** only for temporary read-only testing
4. **Configure hooks** to automate dependency installation

---

*Part of the [multi-worktree-dev skill](../README.md)*
