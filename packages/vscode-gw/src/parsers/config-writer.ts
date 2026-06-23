/**
 * JSONC-safe writer for .gw/config.json
 *
 * Zero-dependency text-splice implementation that preserves all existing
 * comments and formatting in the config file. Does NOT use jsonc-parser.
 *
 * # Supported array shapes
 *
 * The following shapes are handled correctly:
 *   - Multi-line array (most common):
 *       "autoCopyFiles": [
 *         ".env",
 *         "secrets.json"
 *       ]
 *   - Empty array on one line:  "autoCopyFiles": []
 *   - Array with trailing comma on last element
 *   - Inline // comments between elements
 *   - Single-line non-empty array: "autoCopyFiles": [".env", "secrets.json"]
 *
 * # Deliberately unsupported (document here, not in code)
 *   - Block comments (/* ... *\/) inside the array — preserved as text but
 *     the closing ] search may be confused if the comment contains `]`.
 *     Normal configs never have block comments inside arrays.
 *   - Nested arrays / objects as array elements — not used in .gw/config.json.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Result of an addToAutoCopyFiles operation.
 */
export interface AddToAutoCopyResult {
  /** Paths that were appended to autoCopyFiles. */
  added: string[];
  /** Paths that were already present and therefore skipped. */
  alreadyPresent: string[];
}

/**
 * Detect the indentation string used for array elements.
 *
 * Strategy: find the first non-empty line inside the array brackets and
 * measure its leading whitespace. Falls back to two spaces if no indented
 * line is found.
 */
function detectIndent(arrayContent: string): string {
  const lines = arrayContent.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\s+)\S/);
    if (match) {
      return match[1];
    }
  }
  return '  ';
}

/**
 * Extract the string values already present in a JSON/JSONC array body.
 *
 * The `arrayContent` is the text between `[` and `]` (exclusive).
 * Inline // comments are stripped per line before matching.
 */
function extractStringValues(arrayContent: string): string[] {
  const values: string[] = [];
  // Strip // comments per line, then find all double-quoted strings.
  const stripped = arrayContent
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    values.push(m[1]);
  }
  return values;
}

/**
 * Quote a string value for inclusion in a JSON array element.
 * Always uses double quotes and JSON-encodes the inner value.
 */
function jsonQuote(value: string): string {
  return JSON.stringify(value);
}

/**
 * Build a new array body by appending `newEntries` to the existing array
 * text, preserving all existing content (comments, formatting).
 *
 * @param openBracketPos  Index of `[` in the full file text
 * @param closeBracketPos Index of `]` in the full file text
 * @param fullText        The entire file text
 * @param newEntries      New string values to append
 * @returns The mutated full text
 */
function spliceIntoArray(
  fullText: string,
  openBracketPos: number,
  closeBracketPos: number,
  newEntries: string[]
): string {
  if (newEntries.length === 0) return fullText;

  const beforeClose = fullText.slice(0, closeBracketPos);
  const afterClose = fullText.slice(closeBracketPos); // starts with `]`

  const arrayContent = fullText.slice(openBracketPos + 1, closeBracketPos);
  const indent = detectIndent(arrayContent);

  // Check whether the array is currently empty (only whitespace/newlines between [ and ])
  const isEmpty = arrayContent.trim() === '';

  // Check for a trailing comma on the last non-comment, non-whitespace token.
  // We look at the text backwards from closeBracketPos for the last meaningful char.
  const insertionBase = beforeClose;

  if (isEmpty) {
    // Empty array: insert all entries as indented lines.
    const entries = newEntries.map((v) => `${indent}${jsonQuote(v)}`).join(',\n');
    return `${fullText.slice(0, openBracketPos + 1)}\n${entries}\n${fullText.slice(closeBracketPos)}`;
  }

  // Non-empty array: we need to append after the last element.
  // Find the position just before `]` stripping trailing whitespace.
  const trimmedBase = insertionBase.trimEnd();

  // If the last meaningful character is NOT a comma, add one.
  const lastMeaningfulChar = trimmedBase.slice(-1);
  const needsComma = lastMeaningfulChar !== ',';

  const suffix = newEntries.map((v) => `${indent}${jsonQuote(v)}`).join(',\n');

  if (needsComma) {
    // e.g. "  .env"\n  --> "  .env",\n  "secrets.json"\n
    return `${trimmedBase},\n${suffix}\n${afterClose}`;
  } else {
    // Already has trailing comma — just append on new lines.
    return `${trimmedBase}\n${suffix}\n${afterClose}`;
  }
}

/**
 * Find the position of the `autoCopyFiles` array in `text`.
 *
 * Returns `{ openBracket, closeBracket }` positions, or `null` if the key
 * does not exist.
 *
 * Handles:
 *   - Multi-line arrays
 *   - Single-line arrays
 *   - Arrays that start on the same line as the key
 *
 * Does NOT handle nested arrays as elements (not used in .gw/config.json).
 */
function findAutoCopyFilesArray(text: string): { openBracket: number; closeBracket: number } | null {
  // Match the "autoCopyFiles" key followed by optional whitespace/colon/whitespace
  // then the opening bracket.
  const keyRe = /"autoCopyFiles"\s*:\s*\[/;
  const keyMatch = keyRe.exec(text);
  if (!keyMatch) return null;

  const openBracket = keyMatch.index + keyMatch[0].length - 1; // position of `[`

  // Walk forward to find the matching `]`, skipping // comments and strings.
  let depth = 0;
  let i = openBracket;
  let inLineComment = false;
  let inString = false;
  let escape = false;

  while (i < text.length) {
    const ch = text[i];

    if (escape) {
      escape = false;
      i++;
      continue;
    }

    if (inString) {
      if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      i++;
      continue;
    }

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }

    if (ch === '/' && text[i + 1] === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '"') {
      inString = true;
      i++;
      continue;
    }

    if (ch === '[') {
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0) {
        return { openBracket, closeBracket: i };
      }
    }

    i++;
  }

  return null; // unmatched bracket — malformed file
}

/**
 * Create a new `autoCopyFiles` key at the end of the root JSON object,
 * preserving existing content.
 *
 * Inserts before the final `}` of the root object.
 */
function insertAutoCopyFilesKey(text: string, entries: string[]): string {
  // Find the last `}` in the file (root object close).
  const lastBrace = text.lastIndexOf('}');
  if (lastBrace === -1) {
    throw new Error('Malformed config: no closing } found');
  }

  const before = text.slice(0, lastBrace).trimEnd();
  const after = text.slice(lastBrace);

  // Determine whether we need a comma after the previous property.
  const needsComma = before.slice(-1) !== ',';
  const comma = needsComma ? ',' : '';

  const valueLines = entries.map((v) => `    ${jsonQuote(v)}`).join(',\n');
  const newKey = `\n  "autoCopyFiles": [\n${valueLines}\n  ]`;

  return `${before}${comma}${newKey}\n${after}`;
}

/**
 * Append one or more repo-root-relative file paths to the `autoCopyFiles`
 * array in `.gw/config.json`, preserving JSONC comments and formatting.
 *
 * Duplicate paths (already present in the array) are silently skipped and
 * reported in `result.alreadyPresent`.
 *
 * @param configPath Absolute path to `.gw/config.json`
 * @param filePaths  Repo-root-relative paths to add (no leading `./`)
 * @returns Result describing which paths were added vs already present
 * @throws {Error} If the config file cannot be read or written
 */
export async function addToAutoCopyFiles(configPath: string, filePaths: string[]): Promise<AddToAutoCopyResult> {
  if (filePaths.length === 0) {
    return { added: [], alreadyPresent: [] };
  }

  // Resolve configPath to absolute for error messages.
  const absPath = path.resolve(configPath);

  const rawText = await fs.promises.readFile(absPath, 'utf-8');

  const arrayBounds = findAutoCopyFilesArray(rawText);

  let existing: string[];
  if (arrayBounds) {
    const arrayContent = rawText.slice(arrayBounds.openBracket + 1, arrayBounds.closeBracket);
    existing = extractStringValues(arrayContent);
  } else {
    existing = [];
  }

  const added: string[] = [];
  const alreadyPresent: string[] = [];

  for (const filePath of filePaths) {
    if (existing.includes(filePath)) {
      alreadyPresent.push(filePath);
    } else {
      added.push(filePath);
    }
  }

  if (added.length === 0) {
    return { added, alreadyPresent };
  }

  let newText: string;
  if (arrayBounds) {
    newText = spliceIntoArray(rawText, arrayBounds.openBracket, arrayBounds.closeBracket, added);
  } else {
    newText = insertAutoCopyFilesKey(rawText, added);
  }

  await fs.promises.writeFile(absPath, newText, 'utf-8');

  return { added, alreadyPresent };
}
