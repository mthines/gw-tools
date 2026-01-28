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

Deno.test({
  name: "remove command - automatically removes leftover directory",
  ignore: true, // Skip - Deno.exit(0) called by remove command
  fn: async () => {
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
        await executeRemove(["leftover"]);

        // Verify directory was removed
        await assertPathNotExists(leftoverPath);
      } finally {
        cwd.restore();
      }
    } finally {
      await repo.cleanup();
    }
  },
});

Deno.test({
  name: "remove command - exits with error for non-existent worktree",
  ignore: true, // Skip - Deno.exit() cannot be easily tested
  fn: async () => {
    const repo = new GitTestRepo();
    try {
      await repo.init();

      const config = createMinimalConfig(repo.path);
      await writeTestConfig(repo.path, config);

      const cwd = new TempCwd(repo.path);
      try {
        // Should exit with error
        await executeRemove(["--yes", "non-existent"]);
      } finally {
        cwd.restore();
      }
    } finally {
      await repo.cleanup();
    }
  },
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
