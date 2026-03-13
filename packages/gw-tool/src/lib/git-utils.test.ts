/**
 * Tests for git-utils.ts
 */

import { assertEquals, assertRejects } from '$std/assert';
import { join } from '$std/path';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import {
  getStagedFiles,
  getStagedFileContent,
  copyStagedFiles,
} from './git-utils.ts';

// =============================================================================
// getStagedFiles tests
// =============================================================================

Deno.test('getStagedFiles - returns empty array when no files staged', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const stagedFiles = await getStagedFiles(repo.path);
    assertEquals(stagedFiles, []);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('getStagedFiles - returns added files', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create and stage a new file
    await repo.createFile('new-file.txt', 'new content');
    await repo.runCommand('git', ['add', 'new-file.txt'], repo.path);

    const stagedFiles = await getStagedFiles(repo.path);
    assertEquals(stagedFiles.length, 1);
    assertEquals(stagedFiles[0].path, 'new-file.txt');
    assertEquals(stagedFiles[0].status, 'A');
  } finally {
    await repo.cleanup();
  }
});

Deno.test('getStagedFiles - returns modified files', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create, commit, modify, and stage a file
    await repo.createFile('existing-file.txt', 'original content');
    await repo.runCommand('git', ['add', 'existing-file.txt'], repo.path);
    await repo.createCommit('Add existing file');

    await repo.createFile('existing-file.txt', 'modified content');
    await repo.runCommand('git', ['add', 'existing-file.txt'], repo.path);

    const stagedFiles = await getStagedFiles(repo.path);
    assertEquals(stagedFiles.length, 1);
    assertEquals(stagedFiles[0].path, 'existing-file.txt');
    assertEquals(stagedFiles[0].status, 'M');
  } finally {
    await repo.cleanup();
  }
});

Deno.test('getStagedFiles - returns deleted files', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create and commit a file
    await repo.createFile('to-delete.txt', 'content');
    await repo.runCommand('git', ['add', 'to-delete.txt'], repo.path);
    await repo.createCommit('Add file to delete');

    // Delete and stage deletion
    await Deno.remove(join(repo.path, 'to-delete.txt'));
    await repo.runCommand('git', ['add', 'to-delete.txt'], repo.path);

    const stagedFiles = await getStagedFiles(repo.path);
    assertEquals(stagedFiles.length, 1);
    assertEquals(stagedFiles[0].path, 'to-delete.txt');
    assertEquals(stagedFiles[0].status, 'D');
  } finally {
    await repo.cleanup();
  }
});

Deno.test('getStagedFiles - returns renamed files with originalPath', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create and commit a file
    await repo.createFile('old-name.txt', 'content');
    await repo.runCommand('git', ['add', 'old-name.txt'], repo.path);
    await repo.createCommit('Add file to rename');

    // Rename with git mv
    await repo.runCommand('git', ['mv', 'old-name.txt', 'new-name.txt'], repo.path);

    const stagedFiles = await getStagedFiles(repo.path);
    assertEquals(stagedFiles.length, 1);
    assertEquals(stagedFiles[0].status, 'R');
    assertEquals(stagedFiles[0].originalPath, 'old-name.txt');
    assertEquals(stagedFiles[0].path, 'new-name.txt');
  } finally {
    await repo.cleanup();
  }
});

Deno.test('getStagedFiles - returns multiple files', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create and stage multiple files
    await repo.createFile('file1.txt', 'content 1');
    await repo.createFile('file2.txt', 'content 2');
    await repo.createFile('subdir/file3.txt', 'content 3');
    await repo.runCommand('git', ['add', '.'], repo.path);

    const stagedFiles = await getStagedFiles(repo.path);
    assertEquals(stagedFiles.length, 3);

    const paths = stagedFiles.map((f) => f.path).sort();
    assertEquals(paths, ['file1.txt', 'file2.txt', 'subdir/file3.txt']);
  } finally {
    await repo.cleanup();
  }
});

// =============================================================================
// getStagedFileContent tests
// =============================================================================

Deno.test('getStagedFileContent - returns content of staged file', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const expectedContent = 'Hello, World!';
    await repo.createFile('test.txt', expectedContent);
    await repo.runCommand('git', ['add', 'test.txt'], repo.path);

    const content = await getStagedFileContent('test.txt', repo.path);
    const textContent = new TextDecoder().decode(content);
    assertEquals(textContent, expectedContent);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('getStagedFileContent - returns staged version not working tree version', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create and stage a file
    await repo.createFile('test.txt', 'staged content');
    await repo.runCommand('git', ['add', 'test.txt'], repo.path);

    // Modify the file in working tree (but don't stage)
    await repo.createFile('test.txt', 'modified working tree content');

    // Should return staged content, not working tree
    const content = await getStagedFileContent('test.txt', repo.path);
    const textContent = new TextDecoder().decode(content);
    assertEquals(textContent, 'staged content');
  } finally {
    await repo.cleanup();
  }
});

Deno.test('getStagedFileContent - handles binary content', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a file with binary content
    const binaryContent = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);
    await Deno.writeFile(join(repo.path, 'binary.bin'), binaryContent);
    await repo.runCommand('git', ['add', 'binary.bin'], repo.path);

    const content = await getStagedFileContent('binary.bin', repo.path);
    assertEquals(content, binaryContent);
  } finally {
    await repo.cleanup();
  }
});

Deno.test('getStagedFileContent - throws for non-staged file', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    await assertRejects(
      () => getStagedFileContent('nonexistent.txt', repo.path),
      Error,
      "Failed to get staged file content for 'nonexistent.txt'"
    );
  } finally {
    await repo.cleanup();
  }
});

// =============================================================================
// copyStagedFiles tests
// =============================================================================

Deno.test('copyStagedFiles - copies all staged files to target', async () => {
  const sourceRepo = new GitTestRepo();
  const targetRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await targetRepo.init();

    // Stage files in source
    await sourceRepo.createFile('file1.txt', 'content 1');
    await sourceRepo.createFile('file2.txt', 'content 2');
    await sourceRepo.runCommand('git', ['add', '.'], sourceRepo.path);

    // Copy staged files
    const results = await copyStagedFiles(sourceRepo.path, targetRepo.path);

    assertEquals(results.length, 2);
    assertEquals(results.every((r) => r.success), true);

    // Verify files were copied
    const file1Content = await targetRepo.readFile('file1.txt');
    const file2Content = await targetRepo.readFile('file2.txt');
    assertEquals(file1Content, 'content 1');
    assertEquals(file2Content, 'content 2');
  } finally {
    await sourceRepo.cleanup();
    await targetRepo.cleanup();
  }
});

Deno.test('copyStagedFiles - copies only specified files', async () => {
  const sourceRepo = new GitTestRepo();
  const targetRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await targetRepo.init();

    // Stage multiple files in source
    await sourceRepo.createFile('file1.txt', 'content 1');
    await sourceRepo.createFile('file2.txt', 'content 2');
    await sourceRepo.createFile('file3.txt', 'content 3');
    await sourceRepo.runCommand('git', ['add', '.'], sourceRepo.path);

    // Copy only specific files
    const results = await copyStagedFiles(sourceRepo.path, targetRepo.path, ['file1.txt', 'file3.txt']);

    assertEquals(results.length, 2);
    assertEquals(results.every((r) => r.success), true);

    // Verify only specified files were copied
    assertEquals(await targetRepo.fileExists('file1.txt'), true);
    assertEquals(await targetRepo.fileExists('file2.txt'), false);
    assertEquals(await targetRepo.fileExists('file3.txt'), true);
  } finally {
    await sourceRepo.cleanup();
    await targetRepo.cleanup();
  }
});

Deno.test('copyStagedFiles - skips deleted files', async () => {
  const sourceRepo = new GitTestRepo();
  const targetRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await targetRepo.init();

    // Create and commit a file
    await sourceRepo.createFile('to-delete.txt', 'content');
    await sourceRepo.runCommand('git', ['add', 'to-delete.txt'], sourceRepo.path);
    await sourceRepo.createCommit('Add file');

    // Delete and stage deletion
    await Deno.remove(join(sourceRepo.path, 'to-delete.txt'));
    await sourceRepo.runCommand('git', ['add', 'to-delete.txt'], sourceRepo.path);

    // Also stage a new file
    await sourceRepo.createFile('new-file.txt', 'new content');
    await sourceRepo.runCommand('git', ['add', 'new-file.txt'], sourceRepo.path);

    const results = await copyStagedFiles(sourceRepo.path, targetRepo.path);

    assertEquals(results.length, 2);

    // Find the skipped deleted file
    const deletedResult = results.find((r) => r.path === 'to-delete.txt');
    assertEquals(deletedResult?.success, true);
    assertEquals(deletedResult?.message.includes('Skipped'), true);

    // The new file should be copied
    const newFileResult = results.find((r) => r.path === 'new-file.txt');
    assertEquals(newFileResult?.success, true);
    assertEquals(newFileResult?.message.includes('Copied'), true);

    // Verify only new file exists in target
    assertEquals(await targetRepo.fileExists('to-delete.txt'), false);
    assertEquals(await targetRepo.fileExists('new-file.txt'), true);
  } finally {
    await sourceRepo.cleanup();
    await targetRepo.cleanup();
  }
});

Deno.test('copyStagedFiles - creates nested directories', async () => {
  const sourceRepo = new GitTestRepo();
  const targetRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await targetRepo.init();

    // Stage a deeply nested file
    await sourceRepo.createFile('a/b/c/deep-file.txt', 'deep content');
    await sourceRepo.runCommand('git', ['add', '.'], sourceRepo.path);

    const results = await copyStagedFiles(sourceRepo.path, targetRepo.path);

    assertEquals(results.length, 1);
    assertEquals(results[0].success, true);

    // Verify file was copied with full path
    const content = await targetRepo.readFile('a/b/c/deep-file.txt');
    assertEquals(content, 'deep content');
  } finally {
    await sourceRepo.cleanup();
    await targetRepo.cleanup();
  }
});

Deno.test('copyStagedFiles - throws when no staged files', async () => {
  const sourceRepo = new GitTestRepo();
  const targetRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await targetRepo.init();

    await assertRejects(() => copyStagedFiles(sourceRepo.path, targetRepo.path), Error, 'No staged files to copy');
  } finally {
    await sourceRepo.cleanup();
    await targetRepo.cleanup();
  }
});

Deno.test('copyStagedFiles - throws when specified files not staged', async () => {
  const sourceRepo = new GitTestRepo();
  const targetRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await targetRepo.init();

    // Stage one file
    await sourceRepo.createFile('staged.txt', 'content');
    await sourceRepo.runCommand('git', ['add', 'staged.txt'], sourceRepo.path);

    // Try to copy a file that isn't staged
    await assertRejects(
      () => copyStagedFiles(sourceRepo.path, targetRepo.path, ['not-staged.txt']),
      Error,
      'None of the specified files are staged'
    );
  } finally {
    await sourceRepo.cleanup();
    await targetRepo.cleanup();
  }
});

Deno.test('copyStagedFiles - uses staged content not working tree', async () => {
  const sourceRepo = new GitTestRepo();
  const targetRepo = new GitTestRepo();
  try {
    await sourceRepo.init();
    await targetRepo.init();

    // Stage a file
    await sourceRepo.createFile('test.txt', 'staged version');
    await sourceRepo.runCommand('git', ['add', 'test.txt'], sourceRepo.path);

    // Modify in working tree (don't stage)
    await sourceRepo.createFile('test.txt', 'working tree version');

    const results = await copyStagedFiles(sourceRepo.path, targetRepo.path);

    assertEquals(results.length, 1);
    assertEquals(results[0].success, true);

    // Should have staged content, not working tree
    const content = await targetRepo.readFile('test.txt');
    assertEquals(content, 'staged version');
  } finally {
    await sourceRepo.cleanup();
    await targetRepo.cleanup();
  }
});
