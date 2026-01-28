/**
 * Tests for path-resolver.ts
 */

import { assertEquals, assertRejects } from "$std/assert";
import { join, normalize } from "$std/path";
import {
  resolveWorktreePath,
  validatePathExists,
  pathExists,
  isDirectory,
} from "./path-resolver.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";

Deno.test("resolveWorktreePath - resolves relative worktree name", () => {
  const repoPath = "/Users/test/repo";
  const worktreeName = "feat-branch";
  const result = resolveWorktreePath(repoPath, worktreeName);
  assertEquals(result, normalize("/Users/test/repo/feat-branch"));
});

Deno.test("resolveWorktreePath - preserves path with slashes", () => {
  const repoPath = "/Users/test/repo";
  const worktreeName = "feat/foo-bar";
  const result = resolveWorktreePath(repoPath, worktreeName);
  assertEquals(result, normalize("/Users/test/repo/feat/foo-bar"));
});

Deno.test("resolveWorktreePath - handles absolute path within repo", () => {
  const repoPath = "/Users/test/repo";
  const worktreeName = "/Users/test/repo/feat-branch";
  const result = resolveWorktreePath(repoPath, worktreeName);
  assertEquals(result, normalize("/Users/test/repo/feat-branch"));
});

Deno.test("resolveWorktreePath - handles absolute path outside repo", () => {
  const repoPath = "/Users/test/repo";
  const worktreeName = "/Users/test/other/worktree";
  const result = resolveWorktreePath(repoPath, worktreeName);
  assertEquals(result, normalize("/Users/test/other/worktree"));
});

Deno.test("resolveWorktreePath - normalizes paths", () => {
  const repoPath = "/Users/test/repo";
  const worktreeName = "feat/../main/worktree";
  const result = resolveWorktreePath(repoPath, worktreeName);
  assertEquals(result, normalize("/Users/test/repo/main/worktree"));
});

Deno.test("validatePathExists - succeeds for existing file", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createFile("test.txt", "content");

    const filePath = join(repo.path, "test.txt");
    await validatePathExists(filePath, "file"); // Should not throw
  } finally {
    await repo.cleanup();
  }
});

Deno.test("validatePathExists - succeeds for existing directory", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    await validatePathExists(repo.path, "directory"); // Should not throw
  } finally {
    await repo.cleanup();
  }
});

Deno.test("validatePathExists - throws for non-existent path", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const nonExistentPath = join(repo.path, "does-not-exist");
    await assertRejects(
      () => validatePathExists(nonExistentPath, "file"),
      Error,
      "File not found",
    );
  } finally {
    await repo.cleanup();
  }
});

Deno.test("validatePathExists - throws when path is wrong type (file vs directory)", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createFile("test.txt", "content");

    const filePath = join(repo.path, "test.txt");
    await assertRejects(
      () => validatePathExists(filePath, "directory"),
      Error,
      "Path exists but is not a directory",
    );
  } finally {
    await repo.cleanup();
  }
});

Deno.test("validatePathExists - throws when directory expected but file exists", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // repo.path is a directory
    await assertRejects(
      () => validatePathExists(repo.path, "file"),
      Error,
      "Path exists but is not a file",
    );
  } finally {
    await repo.cleanup();
  }
});

Deno.test("pathExists - returns true for existing file", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createFile("test.txt", "content");

    const filePath = join(repo.path, "test.txt");
    const exists = await pathExists(filePath);
    assertEquals(exists, true);
  } finally {
    await repo.cleanup();
  }
});

Deno.test("pathExists - returns true for existing directory", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const exists = await pathExists(repo.path);
    assertEquals(exists, true);
  } finally {
    await repo.cleanup();
  }
});

Deno.test("pathExists - returns false for non-existent path", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const nonExistentPath = join(repo.path, "does-not-exist");
    const exists = await pathExists(nonExistentPath);
    assertEquals(exists, false);
  } finally {
    await repo.cleanup();
  }
});

Deno.test("isDirectory - returns true for directory", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const result = await isDirectory(repo.path);
    assertEquals(result, true);
  } finally {
    await repo.cleanup();
  }
});

Deno.test("isDirectory - returns false for file", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createFile("test.txt", "content");

    const filePath = join(repo.path, "test.txt");
    const result = await isDirectory(filePath);
    assertEquals(result, false);
  } finally {
    await repo.cleanup();
  }
});

Deno.test("isDirectory - returns false for non-existent path", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const nonExistentPath = join(repo.path, "does-not-exist");
    const result = await isDirectory(nonExistentPath);
    assertEquals(result, false);
  } finally {
    await repo.cleanup();
  }
});
