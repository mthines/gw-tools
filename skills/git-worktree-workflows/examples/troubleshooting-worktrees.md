# Troubleshooting Git Worktrees

Common problems and their solutions when working with Git worktrees and gw.

##Table of Contents

1. [Worktree Already Exists](#1-worktree-already-exists)
2. [Branch Already Checked Out](#2-branch-already-checked-out)
3. [Git Ref Conflicts (Hierarchical Branch Names)](#3-git-ref-conflicts-hierarchical-branch-names)
4. [Locked Worktree](#4-locked-worktree)
5. [Corrupted Worktree State](#5-corrupted-worktree-state)
6. [Permission Denied Errors](#6-permission-denied-errors)
7. [Cannot Remove Worktree](#7-cannot-remove-worktree)
8. [Stale Worktree References](#8-stale-worktree-references)
9. [Git Index Corruption](#9-git-index-corruption)
10. [Worktree Not Found](#10-worktree-not-found)
11. [Auto-Copy Files Not Working](#11-auto-copy-files-not-working)

---

## 1. Worktree Already Exists

### Problem

```bash
$ gw add feature-auth
fatal: 'feature-auth' already exists
```

### Diagnostic Commands

```bash
# Check if worktree exists
$ gw list | grep feature-auth

# Check if directory exists
$ ls -la ../feature-auth/
```

### Solutions

**Solution A: Remove existing worktree**

```bash
$ gw remove feature-auth
$ gw add feature-auth -b feature-auth
```

**Solution B: Use different name**

```bash
$ gw add feature-auth-v2 -b feature-auth-v2 feature-auth
```

**Solution C: Navigate to existing worktree**

```bash
$ gw cd feature-auth
```

---

## 2. Branch Already Checked Out

### Problem

```bash
$ gw add feature-x
fatal: 'feature-x' is already checked out at '/projects/repo.git/other-worktree'
```

Git prevents checking out the same branch in multiple worktrees to avoid conflicts.

### Diagnostic Commands

```bash
# Find where branch is checked out
$ gw list | grep "feature-x"
/projects/repo.git/other-worktree  abc123f [feature-x]
```

### Solutions

**Solution A: Navigate to existing worktree**

```bash
$ gw cd feature-x
# You're now in /projects/repo.git/other-worktree
```

**Solution B: Create new branch from existing branch**

```bash
$ gw add feature-x-continued -b feature-x-continued feature-x
```

**Solution C: Force checkout (dangerous!)**

Only use if you understand the implications:

```bash
$ gw add feature-x-copy --force -b feature-x-copy feature-x
```

**When to use `--force`:**
- Testing the same code in multiple environments (different Node versions)
- Read-only operations (you won't commit in both)
- You know what you're doing

**When NOT to use `--force`:**
- You plan to commit in both worktrees
- You don't understand why Git prevented it

---

## 3. Git Ref Conflicts (Hierarchical Branch Names)

### Problem

```bash
$ gw add test
Cannot create branch test because it conflicts with existing branch test/foo

Git doesn't allow both refs/heads/test and refs/heads/test/foo
```

Or the reverse:

```bash
$ gw add test/bar
Cannot create branch test/bar because it conflicts with existing branch test

Git doesn't allow both refs/heads/test and refs/heads/test/bar
```

### Why It Happens

Git stores branches as files in the `.git/refs/heads/` directory. Since you can't have both a file named `test` and a directory named `test/` in the same location, Git prevents creating branches with hierarchical naming conflicts.

This limitation exists because:
- Branch `test` would be stored as `.git/refs/heads/test` (a file)
- Branch `test/foo` would be stored as `.git/refs/heads/test/foo` (requiring `test` to be a directory)

These two structures are mutually exclusive in the filesystem.

### Diagnostic Commands

```bash
# List all local branches to see conflicts
$ git branch
  main
  test
  test/foo

# Check for hierarchical conflicts
$ git for-each-ref --format='%(refname:short)' refs/heads/ | grep "^test"
test
test/foo
```

### Solutions

The `gw add` command detects these conflicts automatically and provides helpful suggestions:

**Solution A: Use a different branch name**

```bash
# Instead of creating "test" when "test/foo" exists:
$ gw add test-new -b test-new

# Or use a different naming pattern:
$ gw add testing -b testing
```

**Solution B: Delete the conflicting branch**

If the conflicting branch is no longer needed:

```bash
# Delete local branch
$ git branch -d test/foo

# If branch has unmerged changes, force delete:
$ git branch -D test/foo

# Now you can create the desired branch:
$ gw add test
```

**Solution C: Use the existing conflicting branch**

If the conflicting branch is what you actually want:

```bash
# Instead of creating "test", use the existing "test/foo":
$ gw add test/foo
```

### Prevention

**Use consistent branch naming conventions:**

Good naming patterns that avoid conflicts:
- `feature/user-auth`, `feature/user-profile` ✅
- `fix/bug-123`, `fix/bug-456` ✅
- `test-migration`, `test-performance` ✅

Problematic naming patterns:
- Having both `test` and `test/integration` ❌
- Having both `feature` and `feature/new` ❌
- Having both `api` and `api/v2` ❌

**Team guidelines:**
```bash
# Good: All features use the same level
feature/auth
feature/checkout
feature/search

# Bad: Mixing levels creates conflicts
feature
feature/auth
feature/checkout
```

---

## 4. Locked Worktree

### Problem

```bash
$ gw remove production
fatal: 'production' is locked
fatal: use 'git worktree unlock production' to remove
```

### Why It Happens

Worktrees can be locked to prevent accidental removal (e.g., production deployments).

### Diagnostic Commands

```bash
# Check if worktree is locked
$ gw list
/projects/repo.git/production  abc123f [main] (locked)
```

### Solutions

**Solution: Unlock then remove**

```bash
$ gw unlock production
$ gw remove production
```

**Prevention:**

Only lock worktrees that should be protected:

```bash
$ gw lock production-deploy
```

---

## 5. Corrupted Worktree State

### Problem

```bash
$ gw cd feature-x
$ git status
fatal: 'feature-x' does not appear to be a git repository
```

### Diagnostic Commands

```bash
# Check if .git file exists
$ cat feature-x/.git
gitdir: /projects/repo.git/.git/worktrees/feature-x

# Check if worktree directory exists in main .git
$ ls /projects/repo.git/.git/worktrees/
```

### Solutions

**Solution A: Repair worktree**

```bash
$ gw repair

# Or repair specific worktree
$ git worktree repair feature-x
```

**Solution B: Remove and recreate**

```bash
# Remove corrupted worktree
$ gw remove feature-x --force

# Recreate from branch
$ gw add feature-x -b feature-x origin/feature-x
```

**Solution C: Manual cleanup**

```bash
# Remove directory
$ rm -rf /projects/repo.git/feature-x

# Remove Git reference
$ gw prune
```

---

## 6. Permission Denied Errors

### Problem

```bash
$ gw add feature-y
fatal: could not create work tree dir 'feature-y': Permission denied
```

### Diagnostic Commands

```bash
# Check permissions on parent directory
$ ls -la /projects/repo.git/
drwxr-xr-x  user  group  /projects/repo.git/

# Check if directory is owned by different user
$ stat /projects/repo.git/
```

### Solutions

**Solution A: Fix directory permissions**

```bash
$ chmod 755 /projects/repo.git/

# If needed, change ownership
$ sudo chown -R $USER:$GROUP /projects/repo.git/
```

**Solution B: Create worktree in accessible location**

```bash
# Create worktree in your home directory
$ gw add ~/worktrees/feature-y -b feature-y
```

**Solution C: Use sudo (not recommended)**

```bash
# Last resort, avoid if possible
$ sudo gw add feature-y
```

---

## 7. Cannot Remove Worktree

### Problem

```bash
$ gw remove feature-old
fatal: validation failed, cannot remove working tree:
  'feature-old' contains modified or untracked files
```

### Diagnostic Commands

```bash
# Check worktree status
$ gw cd feature-old
$ git status
Changes not staged for commit:
  modified:   src/app.ts
Untracked files:
  temp-data.json
```

### Solutions

**Solution A: Commit or stash changes**

```bash
$ gw cd feature-old
$ git add .
$ git commit -m "WIP: save work before removing worktree"
$ git push origin feature-old

# Now remove
$ gw remove feature-old
```

**Solution B: Force removal (loses changes!)**

```bash
$ gw remove feature-old --force
# All uncommitted work is lost!
```

**Solution C: Archive changes**

```bash
$ gw cd feature-old
$ git stash push -u -m "Archive feature-old changes"
$ gw cd main
$ gw remove feature-old

# Later, recreate and restore stash
$ gw add feature-old -b feature-old origin/feature-old
$ gw cd feature-old
$ git stash pop
```

---

## 8. Stale Worktree References

### Problem

Worktree shows in `gw list` but directory doesn't exist.

```bash
$ gw list
/projects/repo.git/main      abc123f [main]
/projects/repo.git/deleted   def456a [feature] (prunable)

$ ls /projects/repo.git/deleted
ls: cannot access 'deleted': No such file or directory
```

### Why It Happens

- Manually deleted worktree directory
- Worktree moved to different location
- Filesystem issues

### Solutions

**Solution: Prune stale references**

```bash
$ gw prune

# Verify
$ gw list
/projects/repo.git/main  abc123f [main]
```

---

## 9. Git Index Corruption

### Problem

```bash
$ git status
error: bad signature 0x00000000
fatal: index file corrupt
```

### Diagnostic Commands

```bash
# Check index file
$ file .git/index
.git/index: Git index, version 2, 42 entries
```

### Solutions

**Solution A: Rebuild index**

```bash
# Remove corrupted index
$ rm .git/index

# Rebuild
$ git reset

# Re-add files
$ git add .
```

**Solution B: Use repair**

```bash
$ gw repair
```

**Solution C: Force checkout**

```bash
# Reset to HEAD
$ git reset --hard HEAD
```

---

## 10. Worktree Not Found

### Problem

```bash
$ gw cd feature-x
Error: Worktree not found
```

### Diagnostic Commands

```bash
# List all worktrees
$ gw list

# Search for partial match
$ gw list | grep -i feature
```

### Solutions

**Solution A: Use correct worktree name**

```bash
# Check exact name
$ gw list
/projects/repo.git/feature-auth  abc123f [feature-auth]

# Use exact name
$ gw cd feature-auth
```

**Solution B: Create worktree if it doesn't exist**

```bash
$ gw add feature-x -b feature-x origin/feature-x
$ gw cd feature-x
```

---

## 11. Auto-Copy Files Not Working

### Problem

Files not automatically copied when creating worktree:

```bash
$ gw add feature-new
✓ Worktree created

# But .env file is missing!
$ ls .env
ls: .env: No such file or directory
```

### Diagnostic Commands

```bash
# Check configuration
$ cat .gw/config.json
{
  "root": "/projects/repo.git",
  "defaultBranch": "main"
  // No autoCopyFiles!
}

# Check if file exists in source
$ ls ../main/.env
.env
```

### Solutions

**Solution A: Configure auto-copy**

```bash
$ gw init --auto-copy-files .env,.env.local,secrets/

# Or edit .gw/config.json manually
{
  "root": "/projects/repo.git",
  "defaultBranch": "main",
  "autoCopyFiles": [
    ".env",
    ".env.local",
    "secrets/"
  ]
}
```

**Solution B: Manual sync**

```bash
# Sync all autoCopyFiles from config
$ gw sync feature-new
✓ Copied: .env
✓ Copied: .env.local

# Or sync specific files
$ gw sync feature-new .env .env.local
✓ Copied: .env
✓ Copied: .env.local
```

**Solution C: Copy files manually**

```bash
$ cp ../main/.env .env
$ cp ../main/.env.local .env.local
```

---

## Prevention Tips

### 1. Regular Cleanup

```bash
# Weekly: remove old worktrees
$ gw list | grep -E "(feature-old|test-)" | awk '{print $1}' | xargs gw remove
```

### 2. Use Configuration

```bash
# Set up auto-copy from the start
$ gw init --auto-copy-files .env,.env.local
```

### 3. Document Team Workflows

Create a team guide:

```markdown
## Worktree Workflow

- Create: `gw add feature-name -b feature-name`
- Navigate: `gw cd feature-name`
- Clean up: `gw remove feature-name`
- Never manually delete worktree directories!
```

### 4. Backup Before Major Operations

```bash
# Before forcing removal
$ gw cd risky-worktree
$ git stash -u
$ cd ..
$ gw remove risky-worktree --force
```

---

## Still Having Issues?

1. Check the [SKILL.md](../SKILL.md) for detailed documentation
2. Review [Getting Started](./getting-started.md) guide
3. Ask your AI agent with this skill loaded
4. Open an issue in the [gw-tools repository](../../../issues)

---

*Part of the [git-worktree-workflows skill](../README.md)*
