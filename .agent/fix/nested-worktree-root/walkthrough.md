# Walkthrough: Fix nested worktree root regression

**Branch:** fix/nested-worktree-root
**PR:** (see PR link below)
**Created:** 2026-04-30T12:57:00+00:00
**Mode:** Full (TDD)

---

## What was broken

Running `gw add <branch>` or `gw checkout <branch>` from inside a worktree
directory (e.g. `/repo.git/main`) created nested worktrees instead of siblings:

- **Expected:** `/repo.git/feat/my-feature`
- **Actual:** `/repo.git/main/feat/my-feature`

---

## Root cause

`loadConfig()` in `packages/gw-tool/src/lib/config.ts` derived `gitRoot` by
stripping `/.gw/config.json` from the config file path:

```typescript
const gitRoot = configPath.replace(/[/\\]\.gw[/\\]config\.json$/, '');
```

After the refactor that made `.gw/config.json` committable and placed it inside
worktrees (commit `37edcf9`), this derivation now returns the _worktree
directory_ (`repo.git/main`) as `gitRoot` instead of the _bare repo root_
(`repo.git`). All subsequent `resolveWorktreePath(gitRoot, ...)` calls used
this wrong root.

---

## The fix (2 lines in config.ts)

```typescript
// Before:
const gitRoot = configPath.replace(/[/\\]\.gw[/\\]config\.json$/, '');

// After:
const worktreeDir = configPath.replace(/[/\\]\.gw[/\\]config\.json$/, '');
const gitRoot = await findGitRoot(worktreeDir);
```

`findGitRoot` was already imported. It correctly handles:

- **Bare repo worktrees:** reads the `.git` file, parses `gitdir:` path, walks
  up to the bare repo root.
- **Regular repos:** returns the directory containing `.git/`.
- **Nested subdirectories:** walks up until it finds `.git`.

The `saveConfig` call during migration is intentionally kept pointing at
`worktreeDir` (where the config was found), not `gitRoot` (the bare root) —
migrations write back to the same location they read from.

---

## TDD cycle

### RED — two failing tests added first

```
loadConfig - returns bare-repo root as gitRoot when config lives inside a worktree ... FAILED
loadConfig - new worktree path is a sibling of the bare-repo root, not nested ... FAILED
```

Error showed exactly the bug:

```
Actual:   .../repo.git/main      (worktree dir — wrong)
Expected: .../repo.git           (bare repo root — correct)
```

### GREEN — fix applied

Both tests passed immediately after the two-line change.

### REFACTOR

No structural refactoring needed. The change is minimal and self-contained.

---

## Test results

- **New tests added:** 2 (both cover the bare-repo worktree scenario)
- **Total tests:** 311 passed, 0 failed
- **Lint:** clean
- **Typecheck:** clean
- **Build:** clean

---

## Acceptance criteria coverage

| AC                                 | Test                                                                             | Status |
| ---------------------------------- | -------------------------------------------------------------------------------- | ------ |
| AC-1 (checkout sibling path)       | `loadConfig - new worktree path is a sibling...`                                 | PASS   |
| AC-2 (add alias)                   | `gw add` aliases `gw checkout` via same `executeCheckout` — transitively covered | PASS   |
| AC-3 (non-regression regular repo) | All 24 pre-existing config tests — regular git repos only                        | PASS   |
| AC-4 (pre-existing tests pass)     | 311/311                                                                          | PASS   |
| AC-5 (lint + typecheck)            | `nx run gw-tool:lint`, `nx run gw-tool:check`                                    | PASS   |

---

## Files changed

| File                                      | Change                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| `packages/gw-tool/src/lib/config.ts`      | Fix `gitRoot` derivation (+4 lines, renamed variable) |
| `packages/gw-tool/src/lib/config.test.ts` | 2 new regression tests + helper function              |
