/**
 * Shared PR utility functions used by both `pr` and `update` commands.
 */

/**
 * Parse a PR identifier (number or URL) to extract PR number.
 *
 * Accepts:
 *   - Bare numbers:  "42"
 *   - GitHub URLs:   "https://github.com/owner/repo/pull/42"
 *                    "http://github.com/owner/repo/pull/42"
 *                    "github.com/owner/repo/pull/42"
 *   - URLs with trailing path segments or fragments:
 *                    "https://github.com/owner/repo/pull/42/files"
 *                    "https://github.com/owner/repo/pull/42#discussion_r123"
 *
 * Returns null for any input that cannot be resolved to a positive integer.
 */
export function parsePrIdentifier(identifier: string): { prNumber: number; owner?: string; repo?: string } | null {
  if (!identifier) return null;

  // Try parsing as a bare number first
  const trimmed = identifier.trim();
  const asNumber = parseInt(trimmed, 10);
  if (!isNaN(asNumber) && asNumber > 0 && String(asNumber) === trimmed) {
    return { prNumber: asNumber };
  }

  // Try parsing as a GitHub URL.
  // Handles optional protocol, optional trailing path segments, and fragments.
  const urlPattern = /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/;
  const match = identifier.match(urlPattern);

  if (match) {
    const [, owner, repo, prNumberStr] = match;
    const prNumber = parseInt(prNumberStr, 10);
    if (!isNaN(prNumber) && prNumber > 0) {
      return { prNumber, owner, repo };
    }
  }

  return null;
}

/**
 * Extract the hostname from a git remote URL.
 *
 * Handles:
 *   - HTTPS:  "https://github.com/owner/repo.git"  → "github.com"
 *   - SCP:    "git@github.com:owner/repo.git"       → "github.com"
 *   - SSH:    "ssh://git@github.com/owner/repo.git" → "github.com"
 *   - Local filesystem paths                         → null
 *
 * Returns null when the host cannot be determined (local path, empty string, etc.).
 */
export function extractRemoteHost(remoteUrl: string): string | null {
  if (!remoteUrl) return null;

  // HTTPS or SSH URL: protocol://[user@]host/...
  const protocolMatch = remoteUrl.match(/^(?:https?|ssh|git):\/\/(?:[^@]+@)?([^/:]+)/);
  if (protocolMatch) {
    return protocolMatch[1];
  }

  // SCP-style: git@host:path
  const scpMatch = remoteUrl.match(/^[^@]+@([^:]+):/);
  if (scpMatch) {
    return scpMatch[1];
  }

  // Local path (no scheme, no @) → not a remote host
  return null;
}

/**
 * Force-fetch a PR head ref into a stable remote-tracking ref.
 *
 * Runs:
 *   git fetch <remote> +refs/pull/<n>/head:refs/remotes/<remote>/pr/<n>
 *
 * The `+` prefix forces the update even if the PR branch was force-pushed.
 *
 * @param prNumber  The PR number to fetch
 * @param remote    The remote name (e.g. "origin")
 * @param cwd       Optional working directory; defaults to process cwd
 * @returns Object with the local ref path on success, or error message on failure
 */
export async function fetchPrRef(
  prNumber: number,
  remote: string,
  cwd?: string
): Promise<{ ref: string; success: boolean; message?: string }> {
  const localRef = `refs/remotes/${remote}/pr/${prNumber}`;
  const refspec = `+refs/pull/${prNumber}/head:${localRef}`;

  const cmd = new Deno.Command('git', {
    args: ['fetch', remote, refspec],
    stdout: 'piped',
    stderr: 'piped',
    ...(cwd ? { cwd } : {}),
  });

  const { code, stderr } = await cmd.output();

  if (code !== 0) {
    const message = new TextDecoder().decode(stderr).trim();
    return { ref: localRef, success: false, message };
  }

  return { ref: localRef, success: true };
}
