/**
 * PR resolver chain — translates a user-supplied identifier into
 * structured PR metadata for `gw pr`.
 *
 * Public API:
 *   - `DEFAULT_PR_RESOLVERS`: the chain used when config has no `prResolvers`.
 *   - `parseGithubIdentifier(input)`: fast pure-string parse for numbers and
 *     github.com/.../pull/N URLs. Used by the github builtin AND for early
 *     repo-mismatch validation.
 *   - `resolvePrIdentifier(input, opts)`: runs the chain, returns the first
 *     successful `ResolvedPr` or `null`.
 *   - `enrichWithGh(resolved)`: fills missing branch/owner/repo via gh CLI.
 *   - `isGhInstalled()`: existence check for the github builtin path.
 *
 * Resolver contract (mirrored in `lib/types.ts`):
 *   - stdin: identifier
 *   - $1:    identifier (safe positional, via `sh -c "$cmd" gw-resolver "$in"`)
 *   - cwd:   git root
 *   - env:   parent env, with .gw/.env as defaults
 *   - stdout: JSON `{ prNumber, branch?, owner?, repo?, isCrossRepository?, remote? }`
 *   - exit 0 + parseable JSON + prNumber > 0 → success
 *   - any other outcome → "pass, try next resolver"
 */

import type { PrResolver, ResolvedPr } from './types.ts';
import { loadResolverEnv } from './dotenv.ts';

/** Default chain used when config does not define `prResolvers`. */
export const DEFAULT_PR_RESOLVERS: PrResolver[] = [{ name: 'gh', builtin: 'github' }];

/** Default per-resolver timeout. */
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Parse a PR identifier as a bare number or a github.com PR URL.
 * Pure-string; no I/O. Returns null when the input is not a recognizable
 * GitHub identifier.
 */
export function parseGithubIdentifier(identifier: string): { prNumber: number; owner?: string; repo?: string } | null {
  if (!identifier) return null;

  // Bare positive integer.
  const trimmed = identifier.trim();
  const asNumber = parseInt(trimmed, 10);
  if (!isNaN(asNumber) && asNumber > 0 && String(asNumber) === trimmed) {
    return { prNumber: asNumber };
  }

  // GitHub PR URL (with or without protocol; tolerates trailing path / hash).
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
 * Check whether `gh` is available on PATH. Used by the github builtin.
 */
export async function isGhInstalled(): Promise<boolean> {
  try {
    const cmd = new Deno.Command('gh', {
      args: ['--version'],
      stdout: 'null',
      stderr: 'null',
    });
    const { code } = await cmd.output();
    return code === 0;
  } catch {
    return false;
  }
}

interface RawGhPrView {
  number: number;
  headRefName: string;
  headRepository: { name: string };
  headRepositoryOwner: { login: string };
  isCrossRepository: boolean;
}

/**
 * Run `gh pr view <identifier>` and project the result into ResolvedPr shape.
 * Returns null when gh can't resolve the identifier (e.g. for Linear URLs).
 */
async function ghPrView(identifier: string): Promise<ResolvedPr | null> {
  try {
    const cmd = new Deno.Command('gh', {
      args: [
        'pr',
        'view',
        identifier,
        '--json',
        'number,headRefName,headRepository,headRepositoryOwner,isCrossRepository',
      ],
      stdout: 'piped',
      stderr: 'piped',
    });
    const { code, stdout, stderr } = await cmd.output();

    if (code !== 0) {
      const err = new TextDecoder().decode(stderr);
      if (err.includes('Could not resolve') || err.includes('not found') || err.includes('no pull requests')) {
        return null;
      }
      // Unknown gh failure: bubble up as "I didn't handle this" so the chain
      // can continue. The original behavior was to throw, but with a chain
      // model we prefer graceful pass-through.
      return null;
    }

    const data: RawGhPrView = JSON.parse(new TextDecoder().decode(stdout));
    return {
      prNumber: data.number,
      branch: data.headRefName,
      owner: data.headRepositoryOwner.login,
      repo: data.headRepository.name,
      isCrossRepository: data.isCrossRepository,
      remote: 'origin',
    };
  } catch {
    return null;
  }
}

/**
 * Built-in github resolver. Mirrors `parseGithubIdentifier` semantics for
 * validation, then defers to `gh pr view` for full metadata.
 */
async function runGithubBuiltin(identifier: string): Promise<ResolvedPr | null> {
  const parsed = parseGithubIdentifier(identifier);
  if (!parsed) return null;
  if (!(await isGhInstalled())) return null;
  return await ghPrView(String(parsed.prNumber));
}

/**
 * Spawn a shell-command resolver. Returns the resolved PR or null.
 * Safe against shell injection because the identifier is passed as a
 * positional argv element (`$1`), never spliced into the command string.
 */
async function runShellResolver(
  resolver: PrResolver,
  input: string,
  env: Record<string, string>,
  cwd: string
): Promise<ResolvedPr | null> {
  if (!resolver.command) return null;

  // Windows: `cmd /c` does not support the safe positional-argv trick.
  // We choose to disable shell resolvers on Windows rather than fall back
  // to an unsafe substitution. Built-in resolvers still work.
  if (Deno.build.os === 'windows') {
    return null;
  }

  const timeoutMs = resolver.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const cmd = new Deno.Command('sh', {
      // sh -c '<cmd>' gw-resolver '<input>'   →  $0=gw-resolver, $1=<input>
      args: ['-c', resolver.command, 'gw-resolver', input],
      stdin: 'piped',
      stdout: 'piped',
      stderr: 'piped',
      env,
      cwd,
      signal: controller.signal,
    });

    const child = cmd.spawn();

    // Write the identifier to stdin too, for scripts that prefer reading from cat.
    const writer = child.stdin.getWriter();
    try {
      await writer.write(new TextEncoder().encode(input));
    } finally {
      await writer.close();
    }

    const { code, stdout } = await child.output();
    if (code !== 0) return null;

    const text = new TextDecoder().decode(stdout).trim();
    if (!text) return null;

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return null;
    }

    return validateResolvedPr(json);
  } catch (error) {
    // AbortError (timeout) or spawn failure — treat as "did not handle".
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validate and narrow an unknown JSON value into ResolvedPr.
 * Returns null if `prNumber` is missing or not a positive integer.
 */
function validateResolvedPr(value: unknown): ResolvedPr | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  const prNumber = v.prNumber;
  if (typeof prNumber !== 'number' || !Number.isInteger(prNumber) || prNumber <= 0) {
    return null;
  }

  const out: ResolvedPr = { prNumber };
  if (typeof v.branch === 'string') out.branch = v.branch;
  if (typeof v.owner === 'string') out.owner = v.owner;
  if (typeof v.repo === 'string') out.repo = v.repo;
  if (typeof v.isCrossRepository === 'boolean') {
    out.isCrossRepository = v.isCrossRepository;
  }
  if (typeof v.remote === 'string') out.remote = v.remote;
  return out;
}

/**
 * Run a single resolver. Dispatches between built-in handlers and
 * external shell commands.
 */
async function runResolver(
  resolver: PrResolver,
  input: string,
  env: Record<string, string>,
  cwd: string
): Promise<ResolvedPr | null> {
  if (resolver.builtin) {
    if (resolver.builtin === 'github') {
      return await runGithubBuiltin(input);
    }
    return null;
  }
  return await runShellResolver(resolver, input, env, cwd);
}

/**
 * Options for `resolvePrIdentifier`.
 */
export interface ResolvePrOptions {
  /** Resolver chain to run. Caller passes config.prResolvers ?? DEFAULT_PR_RESOLVERS. */
  resolvers: PrResolver[];
  /** Git root (used as cwd for shell resolvers and to locate .gw/.env). */
  gitRoot: string;
  /** Optional callback invoked when a resolver wins. */
  onResolved?: (resolver: PrResolver, result: ResolvedPr) => void;
}

/**
 * Run the resolver chain in order. Returns the first successful resolution,
 * or `null` if every resolver passed.
 */
export async function resolvePrIdentifier(
  input: string,
  opts: ResolvePrOptions
): Promise<{ resolver: PrResolver; result: ResolvedPr } | null> {
  if (opts.resolvers.length === 0) return null;

  const env = await loadResolverEnv(opts.gitRoot);

  for (const resolver of opts.resolvers) {
    const result = await runResolver(resolver, input, env, opts.gitRoot);
    if (result) {
      opts.onResolved?.(resolver, result);
      return { resolver, result };
    }
  }

  return null;
}

/**
 * Best-effort metadata enrichment for resolvers that returned only `prNumber`.
 * Calls `gh pr view <prNumber>` when fields are missing AND gh is installed.
 * Returns the input unchanged if enrichment is unnecessary or impossible.
 */
export async function enrichWithGh(resolved: ResolvedPr): Promise<ResolvedPr> {
  if (resolved.branch && resolved.owner && resolved.repo) return resolved;
  if (!(await isGhInstalled())) return resolved;
  const enriched = await ghPrView(String(resolved.prNumber));
  if (!enriched) return resolved;
  return {
    ...enriched,
    ...resolved,
    // Restore any keys the original resolver explicitly set to non-undefined values.
    branch: resolved.branch ?? enriched.branch,
    owner: resolved.owner ?? enriched.owner,
    repo: resolved.repo ?? enriched.repo,
    isCrossRepository: resolved.isCrossRepository ?? enriched.isCrossRepository,
    remote: resolved.remote ?? enriched.remote,
  };
}
