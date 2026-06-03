/**
 * Branch protection utilities
 * Centralizes logic for determining which branches should never be removed
 */

/**
 * Canonical trunk branch names that git itself treats as default-branch
 * conventions. These are protected unconditionally — even when
 * `config.defaultBranch` points elsewhere — to prevent the user from
 * accidentally destroying the historical trunk of a repository when their
 * configured default branch has been renamed or set to something else.
 */
export const CANONICAL_TRUNK_BRANCHES: readonly string[] = ['main', 'master'];

/**
 * Determine if a branch is protected from automatic removal
 *
 * Protected branches:
 * - defaultBranch (e.g., "main", "master", "develop")
 * - "main" and "master" — git's canonical trunk names, protected even when
 *   they are not the currently configured default branch
 * - gw_root (special root worktree for gw operations)
 *
 * @param branch The branch name to check (may be undefined for bare repos)
 * @param defaultBranch The configured default branch name
 * @returns true if the branch is protected, false otherwise
 */
export function isProtectedBranch(branch: string | undefined, defaultBranch: string): boolean {
  if (!branch) {
    return false;
  }

  // Protect the configured default branch
  if (branch === defaultBranch) {
    return true;
  }

  // Protect gw_root special branch
  if (branch === 'gw_root') {
    return true;
  }

  // Protect git's canonical trunk names regardless of configured default.
  // Without this, a repo with defaultBranch="master" would treat a leftover
  // local `main` branch as a deletable orphan (and vice versa).
  if (CANONICAL_TRUNK_BRANCHES.includes(branch)) {
    return true;
  }

  return false;
}
