/**
 * Tests for file-ops.ts
 */

import { assertEquals } from "$std/assert";
import { join } from "$std/path";
import { copyFiles } from "./file-ops.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import { assertFileExists, assertFileContent } from "../test-utils/assertions.ts";

Deno.test("copyFiles - copies single file", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create source file
    await repo.createFile("source/.env", "SECRET=test123");

    // Create target directory
    const targetDir = join(repo.path, "target");
    await Deno.mkdir(targetDir);

    const sourceRoot = join(repo.path, "source");
    const results = await copyFiles(sourceRoot, targetDir, [".env"]);

    // Verify result
    assertEquals(results.length, 1);
    assertEquals(results[0].success, true);
    assertEquals(results[0].path, ".env");

    // Verify file was copied
    await assertFileExists(join(targetDir, ".env"));
    await assertFileContent(join(targetDir, ".env"), "SECRET=test123");
  } finally {
    await repo.cleanup();
  }
});

Deno.test("copyFiles - copies multiple files", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create source files
    await repo.createFile("source/.env", "SECRET=test123");
    await repo.createFile("source/config.json", '{"key": "value"}');

    // Create target directory
    const targetDir = join(repo.path, "target");
    await Deno.mkdir(targetDir);

    const sourceRoot = join(repo.path, "source");
    const results = await copyFiles(sourceRoot, targetDir, [".env", "config.json"]);

    // Verify results
    assertEquals(results.length, 2);
    assertEquals(results[0].success, true);
    assertEquals(results[1].success, true);

    // Verify files were copied
    await assertFileExists(join(targetDir, ".env"));
    await assertFileExists(join(targetDir, "config.json"));
  } finally {
    await repo.cleanup();
  }
});

Deno.test("copyFiles - copies directory recursively", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create source directory with nested files
    await repo.createFile("source/secrets/key1.txt", "secret1");
    await repo.createFile("source/secrets/nested/key2.txt", "secret2");

    // Create target directory
    const targetDir = join(repo.path, "target");
    await Deno.mkdir(targetDir);

    const sourceRoot = join(repo.path, "source");
    const results = await copyFiles(sourceRoot, targetDir, ["secrets/"]);

    // Verify result
    assertEquals(results.length, 1);
    assertEquals(results[0].success, true);

    // Verify directory structure was preserved
    await assertFileExists(join(targetDir, "secrets/key1.txt"));
    await assertFileExists(join(targetDir, "secrets/nested/key2.txt"));
    await assertFileContent(join(targetDir, "secrets/key1.txt"), "secret1");
    await assertFileContent(join(targetDir, "secrets/nested/key2.txt"), "secret2");
  } finally {
    await repo.cleanup();
  }
});

Deno.test("copyFiles - handles non-existent source file", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create target directory
    const targetDir = join(repo.path, "target");
    await Deno.mkdir(targetDir);

    const sourceRoot = join(repo.path, "source");
    const results = await copyFiles(sourceRoot, targetDir, ["nonexistent.txt"]);

    // Verify result shows failure
    assertEquals(results.length, 1);
    assertEquals(results[0].success, false);
    assertEquals(results[0].path, "nonexistent.txt");
    assertEquals(results[0].message.includes("Source not found"), true);
  } finally {
    await repo.cleanup();
  }
});

Deno.test("copyFiles - dry run mode doesn't copy files", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create source file
    await repo.createFile("source/.env", "SECRET=test123");

    // Create target directory
    const targetDir = join(repo.path, "target");
    await Deno.mkdir(targetDir);

    const sourceRoot = join(repo.path, "source");
    const results = await copyFiles(sourceRoot, targetDir, [".env"], true); // dry run

    // Verify result shows success
    assertEquals(results.length, 1);
    assertEquals(results[0].success, true);
    assertEquals(results[0].message.includes("Would copy"), true);

    // Verify file was NOT actually copied
    try {
      await Deno.stat(join(targetDir, ".env"));
      throw new Error("File should not exist in dry run mode");
    } catch (error) {
      assertEquals(error instanceof Deno.errors.NotFound, true);
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("copyFiles - dry run mode shows what would be copied for directory", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create source directory
    await repo.createFile("source/secrets/key.txt", "secret");

    // Create target directory
    const targetDir = join(repo.path, "target");
    await Deno.mkdir(targetDir);

    const sourceRoot = join(repo.path, "source");
    const results = await copyFiles(sourceRoot, targetDir, ["secrets/"], true); // dry run

    // Verify result
    assertEquals(results.length, 1);
    assertEquals(results[0].success, true);
    assertEquals(results[0].message.includes("Would copy"), true);

    // Verify directory was NOT actually copied
    try {
      await Deno.stat(join(targetDir, "secrets"));
      throw new Error("Directory should not exist in dry run mode");
    } catch (error) {
      assertEquals(error instanceof Deno.errors.NotFound, true);
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("copyFiles - preserves relative directory structure", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create source files with nested structure
    await repo.createFile("source/dir1/file1.txt", "content1");
    await repo.createFile("source/dir2/nested/file2.txt", "content2");

    // Create target directory
    const targetDir = join(repo.path, "target");
    await Deno.mkdir(targetDir);

    const sourceRoot = join(repo.path, "source");
    const results = await copyFiles(sourceRoot, targetDir, [
      "dir1/file1.txt",
      "dir2/nested/file2.txt",
    ]);

    // Verify results
    assertEquals(results.length, 2);
    assertEquals(results[0].success, true);
    assertEquals(results[1].success, true);

    // Verify directory structure was preserved
    await assertFileExists(join(targetDir, "dir1/file1.txt"));
    await assertFileExists(join(targetDir, "dir2/nested/file2.txt"));
  } finally {
    await repo.cleanup();
  }
});

Deno.test("copyFiles - handles mix of successful and failed copies", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create only one of two source files
    await repo.createFile("source/.env", "SECRET=test123");

    // Create target directory
    const targetDir = join(repo.path, "target");
    await Deno.mkdir(targetDir);

    const sourceRoot = join(repo.path, "source");
    const results = await copyFiles(sourceRoot, targetDir, [
      ".env",
      "nonexistent.txt",
    ]);

    // Verify results
    assertEquals(results.length, 2);
    assertEquals(results[0].success, true); // .env should succeed
    assertEquals(results[1].success, false); // nonexistent.txt should fail

    // Verify .env was copied
    await assertFileExists(join(targetDir, ".env"));
  } finally {
    await repo.cleanup();
  }
});

Deno.test("copyFiles - creates parent directories as needed", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create source file
    await repo.createFile("source/nested/deep/file.txt", "content");

    // Create target directory (without nested structure)
    const targetDir = join(repo.path, "target");
    await Deno.mkdir(targetDir);

    const sourceRoot = join(repo.path, "source");
    const results = await copyFiles(sourceRoot, targetDir, ["nested/deep/file.txt"]);

    // Verify result
    assertEquals(results.length, 1);
    assertEquals(results[0].success, true);

    // Verify parent directories were created
    await assertFileExists(join(targetDir, "nested/deep/file.txt"));
  } finally {
    await repo.cleanup();
  }
});
