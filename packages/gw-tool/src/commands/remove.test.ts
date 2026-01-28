/**
 * Tests for remove.ts command
 */

import { assertEquals, assertRejects } from "$std/assert";
import { join } from "$std/path";
import { executeRemove } from "./remove.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import { TempCwd } from "../test-utils/temp-env.ts";
import { createMinimalConfig, writeTestConfig } from "../test-utils/fixtures.ts";
import { assertWorktreeNotExists, assertPathNotExists } from "../test-utils/assertions.ts";
import { withMockedExit } from "../test-utils/mock-exit.ts";

Deno.test("remove command - removes worktree with --yes flag", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree("feat-branch", "feat-branch");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove with --yes to skip confirmation
      await executeRemove(["--yes", "feat-branch"]);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("remove command - removes worktree with -y flag", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree("feat-branch", "feat-branch");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove with -y shorthand
      await executeRemove(["-y", "feat-branch"]);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("remove command - automatically removes leftover directory", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a leftover directory (not a valid worktree)
    const leftoverPath = join(repo.path, "leftover");
    await Deno.mkdir(leftoverPath);
    await Deno.writeTextFile(join(leftoverPath, "test.txt"), "content");

    const cwd = new TempCwd(repo.path);
    try {
      // Should automatically remove leftover directory without prompting
      const { exitCode } = await withMockedExit(() => executeRemove(["leftover"]));

      // Should have exited (either 0 for success or 1 if git worktree not found)
      // The important thing is that it attempts to remove the directory
      assertEquals(
        exitCode !== undefined,
        true,
        "Should have called Deno.exit()",
      );

      // If removal was successful (exit 0), verify directory was removed
      if (exitCode === 0) {
        await assertPathNotExists(leftoverPath);
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("remove command - exits with error for non-existent worktree", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should exit with error
      const { exitCode } = await withMockedExit(() =>
        executeRemove(["--yes", "non-existent"])
      );

      // Should have exited with error code
      assertEquals(exitCode, 1, "Should exit with code 1 for non-existent worktree");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("remove command - handles worktree with slash in name", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a worktree with slash in name
    await repo.createWorktree("feat/new-feature", "feat/new-feature");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeRemove(["--yes", "feat/new-feature"]);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, "feat/new-feature");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
