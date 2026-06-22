/**
 * JSONC-safe writer for .gw/config.json
 *
 * Uses jsonc-parser to apply minimal AST-based edits that preserve all
 * existing comments and formatting in the config file.
 */

import * as fs from 'fs';
import * as jsonc from 'jsonc-parser';

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
 * Append one or more repo-root-relative file paths to the `autoCopyFiles`
 * array in `.gw/config.json`, preserving JSONC comments.
 *
 * Duplicate paths (already present in the array) are silently skipped and
 * reported in `result.alreadyPresent`.
 *
 * @param configPath Absolute path to `.gw/config.json`
 * @param filePaths  Repo-root-relative paths to add (no leading `./`)
 * @returns Result describing which paths were added vs already present
 * @throws {Error} If the config file cannot be read, parsed, or written
 */
export async function addToAutoCopyFiles(configPath: string, filePaths: string[]): Promise<AddToAutoCopyResult> {
  if (filePaths.length === 0) {
    return { added: [], alreadyPresent: [] };
  }

  const rawText = await fs.promises.readFile(configPath, 'utf-8');

  const errors: jsonc.ParseError[] = [];
  const parsed = jsonc.parse(rawText, errors, { allowTrailingComma: true }) as Record<string, unknown>;

  if (errors.length > 0) {
    throw new Error(
      `Failed to parse ${configPath}: ${errors.map((e) => jsonc.printParseErrorCode(e.error)).join(', ')}`
    );
  }

  const existing: string[] = Array.isArray(parsed.autoCopyFiles) ? (parsed.autoCopyFiles as string[]) : [];

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

  // Apply each new path as a separate modify+applyEdits pass so that the
  // array length is always accurate when computing the insertion index.
  let text = rawText;
  let currentLength = existing.length;

  for (const filePath of added) {
    const edits = jsonc.modify(text, ['autoCopyFiles', currentLength], filePath, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
      isArrayInsertion: true,
    });
    text = jsonc.applyEdits(text, edits);
    currentLength += 1;
  }

  await fs.promises.writeFile(configPath, text, 'utf-8');

  return { added, alreadyPresent };
}
