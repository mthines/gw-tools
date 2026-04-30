# Plan: Fix nested worktree root regression in `gw checkout` / `gw add`

**Branch:** fix/nested-worktree-root
**Created:** 2026-04-30T00:00:00+00:00
**Mode:** Full
**Complexity:** Moderate

---

## Problem Statement

Running `gw add <branch>` (or `gw checkout <branch>`) from inside a worktree
directory (e.g. `/repo.git/main`) creates a _nested_ worktree at
`/repo.git/main/feat/branch` instead of a sibling worktree at
`/repo.git/feat/branch`.

### Root cause

`loadConfig()` in `packages/gw-tool/src/lib/config.ts` derives `gitRoot` from
the config file path by stripping `/.gw/config.json` from it:

```typescript
const gitRoot = configPath.replace(/[/\\]\.gw[/\\]config\.json$/, '');
```

After the recent refactor (`37edcf9`) that made `.gw/config.json` committable
and placed it _inside worktrees_ rather than at the bare-repo root, this
derivation now returns the _worktree directory_ (e.g. `/repo.git/main`) instead
of the _repository root_ (e.g. `/repo.git`). All subsequent `resolveWorktreePath`
calls use this wrong root, placing new worktrees as children of the current
worktree rather than siblings.

The fix is to call `findGitRoot(configDir)` after stripping the config path, so
the returned `gitRoot` is always the actual git/bare-repo root that is the
parent of all worktrees.

---

## Acceptance Criteria

1. **AC-1 (checkout — sibling path):** Running `executeCheckout` with a branch
   name from inside a worktree directory produces a `worktreePath` whose parent
   is the bare-repo root — not the current worktree directory.

2. **AC-2 (add alias — sibling path):** `gw add` is an alias for
   `gw checkout`; AC-1 transitively covers it. An explicit test documents this.

3. **AC-3 (non-regression — normal repo):** In a standard (non-bare, non-
   worktree) git repo, `loadConfig` still returns the repo directory as
   `gitRoot`.

4. **AC-4 (non-regression — existing tests pass):** All pre-existing tests in
   `config.test.ts` and `path-resolver.test.ts` continue to pass.

5. **AC-5 (lint + typecheck pass):** `nx run gw-tool:lint` and
   `nx run gw-tool:check` exit 0.

---

## Files to Change

| File                                      | Change                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/gw-tool/src/lib/config.ts`      | Fix `gitRoot` derivation to use `findGitRoot(configDir)`                                  |
| `packages/gw-tool/src/lib/config.test.ts` | Add failing tests (RED) that reproduce the nested-worktree bug, then turn GREEN after fix |

---

## Implementation Plan

### Phase 3 — Implementation (TDD, RED-GREEN-REFACTOR)

#### Step 1: Write failing tests (RED)

Add to `config.test.ts`:

1. **Test: `loadConfig` from inside a worktree returns bare-repo root as
   `gitRoot`**
   - Create a bare repo at a temp dir (`repo.git/`)
   - Add a worktree at `repo.git/main`
   - Write `.gw/config.json` in the worktree (`repo.git/main/.gw/config.json`)
   - Call `loadConfig()` with cwd = `repo.git/main`
   - Assert `gitRoot === path/repo.git` (bare root), not `path/repo.git/main`

2. **Test: worktree path is a sibling (not nested child) when running from
   inside a worktree**
   - Using the same setup, verify that
     `resolveWorktreePath(gitRoot, "feat/branch")` produces
     `path/repo.git/feat/branch`, not `path/repo.git/main/feat/branch`

#### Step 2: Fix implementation (GREEN)

In `config.ts`, replace the single-line `gitRoot` derivation:

```typescript
// Before (broken):
const gitRoot = configPath.replace(/[/\\]\.gw[/\\]config\.json$/, '');

// After (fixed):
const configDir = configPath.replace(/[/\\]\.gw[/\\]config\.json$/, '');
const gitRoot = await findGitRoot(configDir);
```

This uses the already-imported `findGitRoot` to walk up from the config's
directory to the actual git root (bare repo root in a worktree setup, repo
root in a regular setup).

#### Step 3: Refactor (REFACTOR)

No structural refactoring needed — the change is minimal and self-contained.
Verify all existing tests still pass.

### Phase 4 — Testing

Run `nx run gw-tool:test` and confirm:

- New tests turn GREEN
- All pre-existing tests still pass

### Phase 5 — Documentation

- This is a bug fix that restores expected behavior. No user-visible behavior
  changes.
- `CLAUDE.md` does not need updating.
- Help text does not need updating.
- Check README and SKILL.md for any mention of worktree placement — none
  expected to reference internal path logic.

### Phase 6 — PR

- `Skill("review-changes")` → `Skill("create-pr")`

---

## Risk Assessment

**Low risk.** The change is two lines in `config.ts`. `findGitRoot` is already
imported and tested. The function correctly handles bare repos, regular repos,
and worktrees. Existing tests already cover `findGitRoot` behavior.

The only edge case is a regular (non-bare) repo where the config file lives at
the repo root — `findGitRoot(repoRoot)` returns `repoRoot`, so behavior is
identical to before.
