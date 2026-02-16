# Getting Started with Git Worktrees and gw

A complete walkthrough for first-time worktree users.

## Scenario

You're working on a web application in the `main` branch. A critical bug needs fixing, but you're in the middle of developing a new feature with uncommitted changes. You don't want to stash or commit incomplete work.

## Prerequisites

- `gw` CLI tool installed ([install guide](../../../packages/gw-tool/README.md#installation))
- A Git repository (we'll use an example app called `myapp`)
- Basic Git knowledge (commits, branches)

## Step-by-Step Walkthrough

### Step 1: Check Your Current State

```bash
# You're in the main worktree with uncommitted changes
$ cd ~/projects/myapp
$ git status
On branch main
Changes not staged for commit:
  modified:   src/components/Dashboard.tsx
  modified:   src/styles/theme.css

# You have work in progress
```

### Step 2: Initialize gw Configuration (First Time Only)

```bash
# Let gw auto-detect your repository structure
$ gw init

Repository root detected: /Users/you/projects/myapp.git
Default branch detected: main

Configuration created at .gw/config.json

# This creates:
{
  "root": "/Users/you/projects/myapp.git",
  "defaultBranch": "main"
}
```

### Step 3: Create Your First Worktree

```bash
# Create a worktree for the hotfix
$ gw add hotfix-login -b hotfix-login main

Creating worktree hotfix-login...
✓ Branch 'hotfix-login' set up to track 'origin/main'
✓ Worktree created: /Users/you/projects/myapp.git/hotfix-login

Done! Navigate with: gw cd hotfix-login
```

**What happened:**

- New directory created: `~/projects/myapp.git/hotfix-login/`
- New branch created: `hotfix-login` based on `main`
- Your original work in `main` worktree is untouched

### Step 4: Navigate to the New Worktree

```bash
# Use gw cd to navigate
$ gw cd hotfix-login

# Verify you're in the new worktree
$ pwd
/Users/you/projects/myapp.git/hotfix-login

$ git status
On branch hotfix-login
nothing to commit, working tree clean
```

**Your main worktree still has uncommitted changes in Dashboard.tsx and theme.css!**

### Step 5: Fix the Bug

```bash
# Work on the hotfix
$ vim src/auth/login.ts
# Fix the bug...

$ git add src/auth/login.ts
$ git commit -m "fix: resolve login timeout issue"
$ git push origin hotfix-login
```

### Step 6: Navigate Back to Main Work

```bash
# Return to main worktree
$ gw cd main

$ pwd
/Users/you/projects/myapp.git/main

$ git status
On branch main
Changes not staged for commit:
  modified:   src/components/Dashboard.tsx
  modified:   src/styles/theme.css

# Your uncommitted changes are still here!
```

### Step 7: List All Worktrees

```bash
$ gw list

/Users/you/projects/myapp.git/main          abc123f [main]
/Users/you/projects/myapp.git/hotfix-login  def456a [hotfix-login]
```

### Step 8: Clean Up When Done

```bash
# After hotfix is merged, remove the worktree
$ gw remove hotfix-login

✓ Worktree removed: hotfix-login

$ gw list
/Users/you/projects/myapp.git/main  abc123f [main]
```

---

## Expected Outcome

You've successfully:

- ✅ Created your first Git worktree
- ✅ Worked on a hotfix without interrupting feature development
- ✅ Navigated between worktrees seamlessly
- ✅ Cleaned up when finished

## Common Pitfalls

### Pitfall 1: Forgetting to Install Dependencies

**Problem:** Worktree exists but app won't run

```bash
gw cd hotfix-login
npm run dev  # Error: Cannot find module...
```

**Solution:**

```bash
# Install dependencies in each worktree
npm install
```

### Pitfall 2: Trying to Check Out Same Branch Twice

**Problem:**

```bash
$ gw add feature-auth
fatal: 'feature-auth' is already checked out at '...'
```

**Solution:**

```bash
# Navigate to existing worktree instead
gw cd feature-auth

# Or create a new branch
gw add feature-auth-v2 -b feature-auth-v2 feature-auth
```

### Pitfall 3: Leaving Environment Files Behind

**Problem:** New worktree doesn't have `.env` file

**Solution:**

```bash
# If autoCopyFiles is configured, sync all configured files
gw sync hotfix-login

# Or manually copy specific file
gw sync hotfix-login .env

# Or configure auto-copy (recommended for future worktrees)
gw init --auto-copy-files .env,.env.local
```

---

## Next Steps

Now that you understand the basics:

1. **Configure auto-copy** - Set up automatic file copying with the [config-management skill](../../config-management/)
2. **Learn parallel development** - See [Parallel Development Example](./parallel-development.md)
3. **Explore autonomous workflows** - Check out the [autonomous-workflow skill](../../autonomous-workflow/)

---

## Key Takeaways

- Git worktrees let you work on multiple branches in parallel
- `gw add` creates worktrees with auto-copy support
- `gw cd` provides quick navigation with smart matching
- Each worktree is independent (needs its own node_modules, etc.)
- Clean up with `gw remove` when done
- Your original work remains untouched when creating worktrees

---

_Part of the [git-worktree-workflows skill](../README.md)_
