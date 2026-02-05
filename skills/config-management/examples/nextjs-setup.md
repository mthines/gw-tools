# Setting Up gw for Next.js Projects

Step-by-step guide to configure gw for Next.js applications with Vercel deployment.

## Scenario

You have a Next.js application deployed on Vercel. When creating new worktrees for features, you need to copy:
- Environment variables (`.env`, `.env.local`)
- Vercel configuration (`.vercel/`)
- Any uploaded assets (`public/uploads/`)

## Prerequisites

- gw CLI installed
- A Next.js project with Vercel deployment
- Existing `.env` files in your main worktree

## Step-by-Step Setup

### 1. Initialize gw in Your Project

```bash
cd /path/to/your/nextjs-app
gw init
```

Output:
```
Repository root detected: /Users/you/projects/nextjs-app.git
Default branch detected: main
Configuration created at .gw/config.json
```

### 2. Configure Auto-Copy Files

```bash
gw init --auto-copy-files .env,.env.local,.vercel/,public/uploads/
```

Or manually edit `.gw/config.json`:

```json
{
  "root": "/Users/you/projects/nextjs-app.git",
  "defaultBranch": "main",
  "autoCopyFiles": [
    ".env",
    ".env.local",
    ".env.development",
    ".vercel/",
    "public/uploads/"
  ]
}
```

### 3. Test the Configuration

```bash
# Create a test worktree
gw checkout test-config

# Check if files were copied
ls -la test-config/.env
ls -la test-config/.vercel/

# Clean up
gw remove test-config
```

### 4. Commit Configuration (Optional but Recommended)

```bash
git add .gw/config.json
git commit -m "chore: add gw configuration for team"
```

---

## Understanding Each File

### `.env` and `.env.local`

```
# .env - Shared environment variables
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_ANALYTICS_ID=UA-XXXXX

# .env.local - Local secrets (not in git)
DATABASE_URL=postgresql://localhost/myapp
NEXTAUTH_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_test_xxx
```

**Why copy:** Each worktree needs access to the same API keys and secrets.

### `.vercel/` Directory

```
.vercel/
├── project.json    # Vercel project configuration
└── README.txt      # Vercel CLI info
```

**Why copy:** Links the worktree to your Vercel project for `vercel dev` and deployments.

### `public/uploads/`

```
public/uploads/
├── user-avatars/
└── product-images/
```

**Why copy:** Local development may need access to uploaded assets.

---

## Common Patterns

### Pattern 1: Development vs Production Environments

```json
{
  "autoCopyFiles": [
    ".env",
    ".env.local",
    ".env.development"
  ]
}
```

Don't copy `.env.production` - that should only exist in CI/CD.

### Pattern 2: With Prisma

```json
{
  "autoCopyFiles": [
    ".env",
    ".env.local",
    "prisma/.env"
  ]
}
```

### Pattern 3: With Multiple Vercel Projects (Monorepo)

```json
{
  "autoCopyFiles": [
    ".env",
    "apps/web/.vercel/",
    "apps/admin/.vercel/",
    "packages/ui/.env"
  ]
}
```

---

## Workflow Example

```bash
# 1. Create feature worktree
gw checkout feat/new-checkout

# Output:
# Branch feat/new-checkout doesn't exist, creating from main
# Creating worktree: feat/new-checkout
# Copying files to new worktree...
#   ✓ Copied: .env
#   ✓ Copied: .env.local
#   ✓ Copied: .vercel/
#   ⚠ Skipped: public/uploads/ (not found)
# Worktree created successfully

# 2. Navigate and start development
gw cd feat/new-checkout
npm install
npm run dev

# 3. Work on feature, commit, push
git add .
git commit -m "feat: implement new checkout flow"
git push origin feat/new-checkout

# 4. Clean up after merge
gw remove feat/new-checkout
```

---

## Troubleshooting

### Files Not Being Copied

**Problem:** `.env.local` exists but wasn't copied

**Check:**
```bash
cat .gw/config.json
# Verify .env.local is in autoCopyFiles
```

**Solution:** Add missing file to config:
```bash
gw init --auto-copy-files .env,.env.local
```

### Vercel CLI Not Working in Worktree

**Problem:** `vercel dev` fails in new worktree

**Check:**
```bash
ls -la .vercel/
# Should contain project.json
```

**Solution:** If `.vercel/` wasn't copied, run:
```bash
gw sync feat/new-checkout .vercel/
```

---

## Next Steps

- Review [Monorepo Setup](./monorepo-setup.md) for multi-package Next.js projects
- Check [Troubleshooting Guide](./troubleshooting-config.md) for more issues

---

*Part of the [config-management skill](../README.md)*
