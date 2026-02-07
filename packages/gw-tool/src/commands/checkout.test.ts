/**
 * Tests for checkout.ts command - the most critical command
 */

import { assertEquals, assertRejects } from "$std/assert";
import { join } from "$std/path";
import { executeCheckout } from "./checkout.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import { TempCwd } from "../test-utils/temp-env.ts";
import {
  createConfigWithAutoCopy,
  createConfigWithHooks,
  createMinimalConfig,
  writeTestConfig,
} from "../test-utils/fixtures.ts";
import {
  assertBranchExists,
  assertFileContent,
  assertFileExists,
  assertWorktreeExists,
} from "../test-utils/assertions.ts";
import { withMockedExit } from "../test-utils/mock-exit.ts";
import { withMockedPrompt } from "../test-utils/mock-prompt.ts";

Deno.test("checkout command - creates worktree with auto-branch creation", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeCheckout(["feat-branch"]);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, "feat-branch");

      // Verify branch was created
      await assertBranchExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - creates worktree with slash in name", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeCheckout(["feat/new-feature"]);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, "feat/new-feature");

      // Verify branch was created
      await assertBranchExists(repo.path, "feat/new-feature");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - copies auto-copy files from config", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create files to auto-copy
    await repo.createFile(".env", "SECRET=test123");
    await repo.createFile("secrets/key.txt", "KEY=abc");
    await repo.createCommit("Add secrets");

    const config = createConfigWithAutoCopy(repo.path, [".env", "secrets/"]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeCheckout(["feat-branch"]);

      // Verify files were copied to new worktree
      const worktreePath = join(repo.path, "feat-branch");
      await assertFileExists(join(worktreePath, ".env"));
      await assertFileExists(join(worktreePath, "secrets/key.txt"));
      await assertFileContent(join(worktreePath, ".env"), "SECRET=test123");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - explicit files override auto-copy config", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create files but DON'T commit .env (so it won't be in git checkout)
    await repo.createFile("committed.txt", "in git");
    await repo.createCommit("Add committed file");

    // Create .env and custom.txt AFTER the commit (not in git)
    await repo.createFile(".env", "SECRET=test123");
    await repo.createFile("custom.txt", "custom content");

    const config = createConfigWithAutoCopy(repo.path, [".env"]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Pass explicit file, should ignore .env from config
      await executeCheckout(["feat-branch", "custom.txt"]);

      const worktreePath = join(repo.path, "feat-branch");

      // custom.txt should be copied
      await assertFileExists(join(worktreePath, "custom.txt"));
      await assertFileContent(
        join(worktreePath, "custom.txt"),
        "custom content",
      );

      // .env should NOT be copied (overridden by explicit file list)
      try {
        await Deno.stat(join(worktreePath, ".env"));
        throw new Error(".env should not have been copied");
      } catch (error) {
        assertEquals(error instanceof Deno.errors.NotFound, true);
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - handles leftover directories gracefully", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a leftover directory that's not a valid worktree
    const leftoverPath = join(repo.path, "feat-branch");
    await Deno.mkdir(leftoverPath);
    await Deno.writeTextFile(join(leftoverPath, "dummy.txt"), "test");

    const cwd = new TempCwd(repo.path);
    try {
      // Should error out when path exists but isn't a valid worktree
      const { exitCode } = await withMockedExit(() => executeCheckout(["feat-branch"]));

      // Should have exited with error code
      assertEquals(exitCode, 1, "Should exit with code 1 for leftover directory");

      // Worktree should NOT have been created
      try {
        await assertWorktreeExists(repo.path, "feat-branch");
        throw new Error("Expected worktree to not exist");
      } catch (e) {
        // Expected - worktree doesn't exist
        if (e instanceof Error && e.message === "Expected worktree to not exist") {
          throw e;
        }
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - creates worktree with explicit -b flag", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Create worktree with explicit branch name different from worktree name
      await executeCheckout(["worktree-name", "-b", "custom-branch"]);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, "worktree-name");

      // Verify custom branch was created
      await assertBranchExists(repo.path, "custom-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - detects ref conflicts (branch vs branch/foo)", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch that will conflict
    await repo.createBranch("test/foo");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to create "test" branch - should fail due to conflict with "test/foo"
      const { exitCode } = await withMockedExit(() => executeCheckout(["test"]));

      // Should have exited with error code
      assertEquals(exitCode, 1, "Should exit with code 1 on ref conflict");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - detects ref conflicts (branch/foo vs branch)", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch that will conflict
    await repo.createBranch("test");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to create "test/foo" branch - should fail due to conflict with "test"
      const { exitCode } = await withMockedExit(() => executeCheckout(["test/foo"]));

      // Should have exited with error code
      assertEquals(exitCode, 1, "Should exit with code 1 on ref conflict");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - executes pre-add hooks successfully", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a hook that creates a marker file
    const markerPath = join(repo.path, "hook-ran.txt");
    const hook = `echo "Hook executed" > "${markerPath}"`;

    const config = createConfigWithHooks(repo.path, [hook]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeCheckout(["feat-branch"]);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, "feat-branch");

      // Verify pre-add hook ran
      await assertFileExists(markerPath);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - aborts on pre-add hook failure", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a hook that fails
    const hook = "exit 1";

    const config = createConfigWithHooks(repo.path, [hook]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should abort due to hook failure
      const { exitCode } = await withMockedExit(() =>
        executeCheckout(["feat-branch"])
      );

      // Should have exited with error code
      assertEquals(exitCode, 1, "Should exit with code 1 on hook failure");

      // Verify worktree was NOT created
      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.some((wt) => wt.includes("feat-branch")), false);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - executes post-add hooks successfully", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a hook that creates a marker file in the new worktree
    const hook = 'echo "Post hook ran" > post-hook.txt';

    const config = createConfigWithHooks(repo.path, undefined, [hook]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeCheckout(["feat-branch"]);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, "feat-branch");

      // Verify post-add hook ran in the new worktree
      const worktreePath = join(repo.path, "feat-branch");
      await assertFileExists(join(worktreePath, "post-hook.txt"));
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - continues on post-add hook failure", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a hook that fails
    const hook = "exit 1";

    const config = createConfigWithHooks(repo.path, undefined, [hook]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should continue despite hook failure
      await executeCheckout(["feat-branch"]);

      // Verify worktree was still created (post-add hook failure doesn't abort)
      await assertWorktreeExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - uses existing branch if it exists", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch first
    await repo.createBranch("existing-branch");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should use existing branch instead of creating a new one
      await executeCheckout(["existing-branch"]);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, "existing-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - uses existing branch with slashes correctly", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch with slashes first
    await repo.createBranch("test/sb-vite");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should use existing branch "test/sb-vite", not infer "sb-vite" from path basename
      await executeCheckout(["test/sb-vite"]);

      // Verify worktree directory was created
      const worktreePath = join(repo.path, "test/sb-vite");
      const stat = await Deno.stat(worktreePath);
      assertEquals(stat.isDirectory, true, "Worktree directory should exist");

      // Verify the correct branch was checked out (test/sb-vite, not sb-vite)
      await assertBranchExists(repo.path, "test/sb-vite");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - respects custom defaultBranch in config", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a custom default branch
    await repo.createBranch("develop");

    const config = {
      root: repo.path,
      defaultBranch: "develop",
      cleanThreshold: 7,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should create new branch from "develop" instead of "main"
      await executeCheckout(["feat-branch"]);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - navigates to worktree when path already exists", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // First create the worktree
      await executeCheckout(["feat-branch"]);
      await assertWorktreeExists(repo.path, "feat-branch");

      const home = Deno.env.get("HOME") || "";
      const navFile = join(home, ".gw", "tmp", "last-nav");

      // Clean up any existing nav file
      try {
        await Deno.remove(navFile);
      } catch {
        // File might not exist
      }

      // Try to checkout again - should auto-navigate since branch is already checked out
      const { exitCode } = await withMockedExit(() =>
        executeCheckout(["feat-branch"])
      );

      // Should exit with code 0 (success - navigating)
      assertEquals(exitCode, 0, "Should exit with code 0 when navigating");

      // Verify navigation file was created
      const navFileExists = await Deno.stat(navFile).then(() => true).catch(() => false);
      assertEquals(navFileExists, true, "Should create navigation marker file");

      // Clean up
      try {
        await Deno.remove(navFile);
      } catch {
        // Ignore cleanup errors
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - automatically navigates when branch is already checked out", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // First create the worktree
      await executeCheckout(["feat-branch"]);
      await assertWorktreeExists(repo.path, "feat-branch");

      const home = Deno.env.get("HOME") || "";
      const navFile = join(home, ".gw", "tmp", "last-nav");

      // Clean up any existing nav file
      try {
        await Deno.remove(navFile);
      } catch {
        // File might not exist
      }

      // Try to checkout again - should automatically navigate (no prompt)
      const { exitCode } = await withMockedExit(() =>
        executeCheckout(["feat-branch"])
      );

      // Should exit with code 0 (success - navigating)
      assertEquals(exitCode, 0, "Should exit with code 0 when navigating");

      // Verify navigation file was created (automatic navigation)
      const navFileExists = await Deno.stat(navFile).then(() => true).catch(() => false);
      assertEquals(navFileExists, true, "Should create navigation marker file automatically");

      // Clean up
      try {
        await Deno.remove(navFile);
      } catch {
        // Ignore cleanup errors
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
