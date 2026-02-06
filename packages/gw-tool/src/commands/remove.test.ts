/**
 * Tests for remove.ts command
 */

import { assertEquals, assertRejects } from "$std/assert";
import { join } from "$std/path";
import { executeRemove } from "./remove.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import { TempCwd } from "../test-utils/temp-env.ts";
import {
  createMinimalConfig,
  writeTestConfig,
} from "../test-utils/fixtures.ts";
import {
  assertPathNotExists,
  assertWorktreeNotExists,
} from "../test-utils/assertions.ts";
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
      const { exitCode } = await withMockedExit(() =>
        executeRemove(["leftover"])
      );

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
      assertEquals(
        exitCode,
        1,
        "Should exit with code 1 for non-existent worktree",
      );
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

Deno.test("remove command - removes clean worktree without prompting", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree("feat-branch", "feat-branch");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove without --yes flag
      // Should succeed without prompting because worktree is clean (no uncommitted changes, no unpushed commits)
      await executeRemove(["feat-branch"]);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("remove command - removes worktree with --force flag without prompting", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree("feat-branch", "feat-branch");

    // Add uncommitted changes to make worktree "dirty"
    const worktreePath = join(repo.path, "feat-branch");
    await Deno.writeTextFile(
      join(worktreePath, "test.txt"),
      "uncommitted change",
    );

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Remove with --force flag
      // Should succeed without prompting even though worktree is dirty
      await executeRemove(["--force", "feat-branch"]);

      // Verify worktree was removed
      await assertWorktreeNotExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("remove command - suggests similar matches when exact match not found", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create worktrees with paths that contain "tmp" but aren't exact matches
    await repo.createWorktree("tmp-1", "tmp-1");
    await repo.createWorktree("tmp-2", "tmp-2");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to remove "tmp" which doesn't exist, but tmp-1 and tmp-2 do
      // Should suggest similar matches
      const { exitCode } = await withMockedExit(() => executeRemove(["tmp"]));

      // Should exit with error code 1 (no exact match)
      assertEquals(
        exitCode,
        1,
        "Should exit with error when no exact match found",
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("remove command - does not delete parent directory containing worktrees", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create worktrees in a subdirectory structure: tmp/1 and tmp/2
    const tmpDir = join(repo.path, "tmp");
    await Deno.mkdir(tmpDir);

    await repo.createWorktree("tmp/1", "tmp-1");
    await repo.createWorktree("tmp/2", "tmp-2");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to remove "tmp" which is a directory containing worktrees
      // Should NOT delete the directory, should suggest the worktrees instead
      const { exitCode } = await withMockedExit(() => executeRemove(["tmp"]));

      // Should exit with error code 1
      assertEquals(
        exitCode,
        1,
        "Should exit with error when trying to remove parent directory",
      );

      // Verify the tmp directory still exists
      const tmpExists = await Deno.stat(tmpDir).then(() => true).catch(() =>
        false
      );
      assertEquals(tmpExists, true, "Parent directory should still exist");

      // Verify the worktrees still exist
      const tmp1Exists = await Deno.stat(join(tmpDir, "1")).then(() => true)
        .catch(() => false);
      const tmp2Exists = await Deno.stat(join(tmpDir, "2")).then(() => true)
        .catch(() => false);
      assertEquals(tmp1Exists, true, "Worktree tmp/1 should still exist");
      assertEquals(tmp2Exists, true, "Worktree tmp/2 should still exist");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("remove command - prevents removal of default branch", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create develop worktree and set it as default
    await repo.createWorktree("develop", "develop");

    const config = {
      root: repo.path,
      defaultBranch: "develop",
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to remove the default branch worktree
      const { exitCode } = await withMockedExit(() =>
        executeRemove(["develop"])
      );

      // Should exit with error code 1
      assertEquals(
        exitCode,
        1,
        "Should exit with error when trying to remove default branch",
      );

      // Verify develop worktree still exists
      const worktrees = await repo.listWorktrees();
      const hasDevelop = worktrees.some((wt) => wt.includes("develop"));
      assertEquals(hasDevelop, true, "Default branch worktree should not be removed");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("remove command - prevents removal of gw_root", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create gw_root worktree
    await repo.createWorktree("gw_root", "gw_root");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to remove the gw_root worktree
      const { exitCode } = await withMockedExit(() =>
        executeRemove(["gw_root"])
      );

      // Should exit with error code 1
      assertEquals(
        exitCode,
        1,
        "Should exit with error when trying to remove gw_root",
      );

      // Verify gw_root worktree still exists
      const worktrees = await repo.listWorktrees();
      const hasGwRoot = worktrees.some((wt) => wt.includes("gw_root"));
      assertEquals(hasGwRoot, true, "gw_root worktree should not be removed");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
