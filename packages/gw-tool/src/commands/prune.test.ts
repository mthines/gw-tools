/**
 * Tests for prune command
 */

import { assertEquals } from "$std/assert";
import { getCurrentWorktreePath, listWorktrees } from "../lib/git-utils.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import { join } from "$std/path";

Deno.test("getCurrentWorktreePath - should return empty string when not in a worktree", async () => {
  const testRepo = new GitTestRepo();
  try {
    await testRepo.initBare();

    // Save the original cwd
    const originalCwd = Deno.cwd();

    try {
      // Change to the bare repo directory
      Deno.chdir(testRepo.path);

      // Should return empty string instead of throwing
      const path = await getCurrentWorktreePath();
      assertEquals(path, "");
    } finally {
      // Restore original cwd
      Deno.chdir(originalCwd);
    }
  } finally {
    await testRepo.cleanup();
  }
});

Deno.test("getCurrentWorktreePath - should return path when in a worktree", async () => {
  const testRepo = new GitTestRepo();
  try {
    await testRepo.init();

    // Save the original cwd
    const originalCwd = Deno.cwd();

    try {
      // Change to the worktree directory
      Deno.chdir(testRepo.path);

      // Should return the worktree path
      const path = await getCurrentWorktreePath();
      assertEquals(path, testRepo.path);
    } finally {
      // Restore original cwd
      Deno.chdir(originalCwd);
    }
  } finally {
    await testRepo.cleanup();
  }
});

Deno.test("listWorktrees should work from bare repo", async () => {
  // This verifies that worktree operations work from a bare repo root,
  // which is the scenario described in the bug report

  const bareRepo = new GitTestRepo();
  try {
    // Initialize as a bare repo
    await bareRepo.initBare();

    // Save the original cwd
    const originalCwd = Deno.cwd();

    try {
      // Change to the bare repo directory (simulating being in ~/Workspace/dash0.git)
      Deno.chdir(bareRepo.path);

      // Get current path from bare repo - should return empty string (not an error)
      const currentPath = await getCurrentWorktreePath();
      assertEquals(currentPath, "");

      // List worktrees - should work from bare repo without errors
      const worktrees = await listWorktrees();
      // Should have at least the bare repo entry
      assertEquals(worktrees.length >= 1, true);
    } finally {
      // Restore original cwd
      Deno.chdir(originalCwd);
    }
  } finally {
    await bareRepo.cleanup();
  }
});
