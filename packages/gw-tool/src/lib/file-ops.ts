/**
 * File and directory operations for copying secrets
 */

import { dirname, join } from '$std/path';
import { isDirectory, pathExists } from './path-resolver.ts';
import type { CopyResult } from './types.ts';

/**
 * Recursively copy a directory and all its contents
 *
 * @param sourcePath Source directory path
 * @param targetPath Target directory path
 */
async function copyDirectory(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  // Ensure target directory exists
  await Deno.mkdir(targetPath, { recursive: true });

  // Read all entries in the source directory
  for await (const entry of Deno.readDir(sourcePath)) {
    const sourceEntryPath = join(sourcePath, entry.name);
    const targetEntryPath = join(targetPath, entry.name);

    if (entry.isDirectory) {
      // Recursively copy subdirectory
      await copyDirectory(sourceEntryPath, targetEntryPath);
    } else if (entry.isFile) {
      // Ensure parent directory exists
      await Deno.mkdir(dirname(targetEntryPath), { recursive: true });
      // Copy file
      await Deno.copyFile(sourceEntryPath, targetEntryPath);
    }
  }
}

/**
 * Copy a single file or directory from source to target
 *
 * @param sourcePath Path to source file or directory
 * @param targetPath Path to target file or directory
 * @param dryRun If true, don't actually copy, just report what would be copied
 * @returns Result of the copy operation
 */
async function copyPath(
  sourcePath: string,
  targetPath: string,
  dryRun: boolean = false,
): Promise<CopyResult> {
  try {
    const isDir = await isDirectory(sourcePath);

    if (dryRun) {
      // In dry-run mode, just report what would be copied
      return {
        success: true,
        message: isDir
          ? `Would copy directory: ${sourcePath}`
          : `Would copy file: ${sourcePath}`,
        path: sourcePath,
      };
    }

    if (isDir) {
      // Copy directory recursively
      await copyDirectory(sourcePath, targetPath);
      return {
        success: true,
        message: `Copied directory: ${sourcePath}`,
        path: sourcePath,
      };
    } else {
      // Copy single file
      // Ensure parent directory exists
      await Deno.mkdir(dirname(targetPath), { recursive: true });
      await Deno.copyFile(sourcePath, targetPath);
      return {
        success: true,
        message: `Copied file: ${sourcePath}`,
        path: sourcePath,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to copy ${sourcePath}: ${message}`,
      path: sourcePath,
    };
  }
}

/**
 * Copy multiple files/directories from source root to target root
 * Preserves relative directory structure
 *
 * @param sourceRoot Root directory to copy from
 * @param targetRoot Root directory to copy to
 * @param relativePaths Array of relative paths to copy
 * @param dryRun If true, don't actually copy, just report what would be copied
 * @returns Array of results for each copy operation
 */
export async function copyFiles(
  sourceRoot: string,
  targetRoot: string,
  relativePaths: string[],
  dryRun: boolean = false,
): Promise<CopyResult[]> {
  const results: CopyResult[] = [];

  for (const relativePath of relativePaths) {
    const sourcePath = join(sourceRoot, relativePath);
    const targetPath = join(targetRoot, relativePath);

    // Check if source exists
    if (!(await pathExists(sourcePath))) {
      results.push({
        success: false,
        message: `Source not found: ${relativePath}`,
        path: relativePath,
      });
      continue;
    }

    // Attempt to copy (or simulate in dry-run mode)
    const result = await copyPath(sourcePath, targetPath, dryRun);
    // Modify message to show relative path instead of full path
    const prefix = dryRun ? 'Would copy' : 'Copied';
    results.push({
      ...result,
      message: result.success
        ? `${prefix}: ${relativePath}`
        : `Failed to copy ${relativePath}: ${result.message
            .split(': ')
            .slice(1)
            .join(': ')}`,
      path: relativePath,
    });
  }

  return results;
}
