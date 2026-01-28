/**
 * Tests for add.ts command - the most critical command
 */

import { assertEquals, assertRejects } from "$std/assert";
import { join } from "$std/path";
import { executeAdd } from "./add.ts";
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

Deno.test("add command - creates worktree with auto-branch creation", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(["feat-branch"]);

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

Deno.test("add command - creates worktree with slash in name", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(["feat/new-feature"]);

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

Deno.test("add command - copies auto-copy files from config", async () => {
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
      await executeAdd(["feat-branch"]);

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

Deno.test("add command - explicit files override auto-copy config", async () => {
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
      await executeAdd(["feat-branch", "custom.txt"]);

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

Deno.test("add command - handles leftover directories gracefully", async () => {
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
      // Should automatically clean up leftover and create worktree
      await executeAdd(["feat-branch"]);

      // Verify worktree was created successfully
      await assertWorktreeExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("add command - creates worktree with explicit -b flag", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Create worktree with explicit branch name different from worktree name
      await executeAdd(["worktree-name", "-b", "custom-branch"]);

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

Deno.test("add command - detects ref conflicts (branch vs branch/foo)", async () => {
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
      const { exitCode } = await withMockedExit(() => executeAdd(["test"]));

      // Should have exited with error code
      assertEquals(exitCode, 1, "Should exit with code 1 on ref conflict");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("add command - detects ref conflicts (branch/foo vs branch)", async () => {
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
      const { exitCode } = await withMockedExit(() => executeAdd(["test/foo"]));

      // Should have exited with error code
      assertEquals(exitCode, 1, "Should exit with code 1 on ref conflict");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("add command - executes pre-add hooks successfully", async () => {
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
      await executeAdd(["feat-branch"]);

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

Deno.test("add command - aborts on pre-add hook failure", async () => {
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
        executeAdd(["feat-branch"])
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

Deno.test("add command - executes post-add hooks successfully", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a hook that creates a marker file in the new worktree
    const hook = 'echo "Post hook ran" > post-hook.txt';

    const config = createConfigWithHooks(repo.path, undefined, [hook]);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeAdd(["feat-branch"]);

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

Deno.test("add command - continues on post-add hook failure", async () => {
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
      await executeAdd(["feat-branch"]);

      // Verify worktree was still created (post-add hook failure doesn't abort)
      await assertWorktreeExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("add command - uses existing branch if it exists", async () => {
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
      await executeAdd(["existing-branch"]);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, "existing-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("add command - uses existing branch with slashes correctly", async () => {
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
      await executeAdd(["test/sb-vite"]);

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

Deno.test("add command - respects custom defaultBranch in config", async () => {
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
      await executeAdd(["feat-branch"]);

      // Verify worktree was created
      await assertWorktreeExists(repo.path, "feat-branch");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
