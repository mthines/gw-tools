/**
 * Branch protection utilities
 * Centralizes logic for determining which branches should never be removed
 */

/**
 * Determine if a branch is protected from automatic removal
 *
 * Protected branches:
 * - defaultBranch (e.g., "main", "master", "develop")
 * - gw_root (special root worktree for gw operations)
 *
 * @param branch The branch name to check (may be undefined for bare repos)
 * @param defaultBranch The configured default branch name
 * @returns true if the branch is protected, false otherwise
 */
export function isProtectedBranch(
  branch: string | undefined,
  defaultBranch: string,
): boolean {
  if (!branch) {
    return false;
  }

  // Protect the configured default branch
  if (branch === defaultBranch) {
    return true;
  }

  // Protect gw_root special branch
  if (branch === "gw_root") {
    return true;
  }

  return false;
}
