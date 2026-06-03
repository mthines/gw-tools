/**
 * Tiny .env loader for resolver subprocesses.
 *
 * Supports the common 12-factor dotenv subset:
 *   KEY=value
 *   KEY="quoted value"
 *   KEY='single quoted'
 *   export KEY=value
 *   # comments (line-leading only)
 *
 * Inline comments (TOKEN=abc # comment) are NOT stripped — the # and everything
 * after it is included in the value. This differs from bash but matches
 * dotenv-java / dotenv-go. To avoid surprises, wrap values in quotes:
 *   TOKEN="abc123"  # the comment lives outside the quoted value here
 * Note: `"abc123" # comment` does NOT strip quotes because the value does not
 * end with `"` — use TOKEN="abc123" without a trailing inline comment.
 *
 * Multiline values, variable expansion (${OTHER}), and shell interpolation
 * are intentionally NOT supported — resolvers should keep their .env files
 * simple and use real shell config for anything more complex.
 */

import { join } from '@std/path';

/**
 * Parse the contents of a .env file into a flat string map.
 *
 * Lines that do not match `KEY=value` are silently skipped. Surrounding
 * single- or double-quotes on the value are stripped (matched pair only).
 */
export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Split on any line ending; CRLF, LF, or CR.
  const lines = text.split(/\r\n|\n|\r/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;

    // Strip optional `export ` prefix.
    const stripped = line.startsWith('export ') ? line.slice('export '.length).trim() : line;

    const eq = stripped.indexOf('=');
    if (eq <= 0) continue; // no key, or `=value` with empty key

    const key = stripped.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = stripped.slice(eq + 1).trim();

    // Strip a single matched pair of surrounding quotes.
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

/**
 * Load `.gw/.env` (relative to gitRoot) and merge it with the parent
 * process env. The parent env takes precedence, so shell-exported values
 * always win over committed defaults — this is the standard 12-factor
 * behavior and matches what users expect from direnv-style flows.
 *
 * Missing file is not an error; an empty object is returned for the
 * dotenv portion, and the parent env is still included in the result.
 */
export async function loadResolverEnv(gitRoot: string): Promise<Record<string, string>> {
  const envPath = join(gitRoot, '.gw', '.env');

  let dotenvVars: Record<string, string> = {};
  try {
    const text = await Deno.readTextFile(envPath);
    dotenvVars = parseDotenv(text);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      // Permission or IO error — surface it to the caller. A missing file
      // is the common case and is handled above.
      throw error;
    }
  }

  // Parent env wins.
  return { ...dotenvVars, ...Deno.env.toObject() };
}
