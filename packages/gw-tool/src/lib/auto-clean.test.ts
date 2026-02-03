/**
 * Tests for auto-clean.ts
 */

import { assertEquals } from "$std/assert";
import { join } from "$std/path";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import {
  createConfigWithAutoClean,
  writeTestConfig,
  readTestConfig,
} from "../test-utils/fixtures.ts";
import { TempCwd } from "../test-utils/temp-env.ts";
import { withMockedPrompt } from "../test-utils/mock-prompt.ts";
import { executeAutoClean, promptAndRunAutoClean } from "./auto-clean.ts";

/**
 * Helper to make a worktree appear old by backdating its .git file
 * @param worktreePath Path to the worktree
 * @param daysOld How many days old to make it
 */
async function makeWorktreeOld(
  worktreePath: string,
  daysOld: number,
): Promise<void> {
  const gitFilePath = join(worktreePath, ".git");
  const oldTime = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  await Deno.utime(gitFilePath, oldTime, oldTime);
}

Deno.test("executeAutoClean - returns 0 when auto-clean is disabled", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create config with auto-clean disabled (default)
    const config = {
      root: repo.path,
      defaultBranch: "main",
      cleanThreshold: 7,
      autoClean: false,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const removedCount = await executeAutoClean();
      assertEquals(removedCount, 0);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("executeAutoClean - respects cooldown period", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create config with auto-clean enabled and recent lastAutoCleanTime
    const config = {
      root: repo.path,
      defaultBranch: "main",
      cleanThreshold: 7,
      autoClean: true,
      lastAutoCleanTime: Date.now() - 1000, // 1 second ago (within 24h cooldown)
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const removedCount = await executeAutoClean();
      assertEquals(removedCount, 0);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("executeAutoClean - never removes defaultBranch worktree", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a worktree for the defaultBranch (main is already the main worktree)
    // The main worktree IS on the defaultBranch

    // Create config with auto-clean enabled
    const config = createConfigWithAutoClean(repo.path, 1); // 1 day threshold
    await writeTestConfig(repo.path, config);

    // Make the main worktree "old" (but it should still not be cleaned)
    await makeWorktreeOld(repo.path, 10);

    const cwd = new TempCwd(repo.path);
    try {
      const removedCount = await executeAutoClean();
      // Should not remove main worktree even though it's old
      assertEquals(removedCount, 0);

      // Verify the worktree still exists
      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(repo.path), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("executeAutoClean - removes old non-defaultBranch worktrees", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature worktree
    const featureWorktreePath = await repo.createWorktree(
      "feat-old-branch",
      "feat-old-branch",
    );

    // Make the feature worktree old
    await makeWorktreeOld(featureWorktreePath, 10);

    // Create config with auto-clean enabled (1 day threshold)
    const config = createConfigWithAutoClean(repo.path, 1);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const removedCount = await executeAutoClean();
      // Should remove the old feature worktree
      assertEquals(removedCount, 1);

      // Verify the worktree was removed
      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(featureWorktreePath), false);

      // Main worktree should still exist
      assertEquals(worktrees.includes(repo.path), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("executeAutoClean - updates lastAutoCleanTime after running", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create config with auto-clean enabled and no lastAutoCleanTime
    const config = createConfigWithAutoClean(repo.path, 7);
    await writeTestConfig(repo.path, config);

    const beforeTime = Date.now();

    const cwd = new TempCwd(repo.path);
    try {
      await executeAutoClean();

      // Verify lastAutoCleanTime was updated
      const savedConfig = await readTestConfig(repo.path);
      assertEquals(typeof savedConfig.lastAutoCleanTime, "number");
      assertEquals(savedConfig.lastAutoCleanTime! >= beforeTime, true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("executeAutoClean - does not remove worktrees younger than threshold", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a feature worktree (will be "young" - just created)
    const featureWorktreePath = await repo.createWorktree(
      "feat-young-branch",
      "feat-young-branch",
    );

    // Create config with auto-clean enabled (7 day threshold)
    const config = createConfigWithAutoClean(repo.path, 7);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const removedCount = await executeAutoClean();
      // Should not remove the young worktree
      assertEquals(removedCount, 0);

      // Verify the worktree still exists
      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(featureWorktreePath), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("executeAutoClean - protects custom defaultBranch", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a develop worktree (creates branch automatically)
    const developWorktreePath = await repo.createWorktree("develop", "develop");

    // Make it old
    await makeWorktreeOld(developWorktreePath, 10);

    // Create config with develop as defaultBranch
    const config = {
      root: repo.path,
      defaultBranch: "develop",
      cleanThreshold: 1,
      autoClean: true,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const removedCount = await executeAutoClean();
      // Should NOT remove the develop worktree (it's the defaultBranch)
      assertEquals(removedCount, 0);

      // Verify the develop worktree still exists
      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(developWorktreePath), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

// Tests for promptAndRunAutoClean()

Deno.test("promptAndRunAutoClean - removes worktrees when user accepts (y)", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create an old worktree
    const oldWorktreePath = await repo.createWorktree("old-branch", "old-branch");
    await makeWorktreeOld(oldWorktreePath, 10);

    // Create config with auto-clean enabled
    const config = createConfigWithAutoClean(repo.path, 7);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Mock prompt response: "y"
      await withMockedPrompt(["y"], async () => {
        await promptAndRunAutoClean();

        // Verify worktree was removed
        const worktrees = await repo.listWorktrees();
        assertEquals(worktrees.includes(oldWorktreePath), false);
      });
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("promptAndRunAutoClean - removes worktrees when user accepts (empty/default)", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create an old worktree
    const oldWorktreePath = await repo.createWorktree("old-branch", "old-branch");
    await makeWorktreeOld(oldWorktreePath, 10);

    // Create config with auto-clean enabled
    const config = createConfigWithAutoClean(repo.path, 7);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Mock prompt response: "" (empty/Enter = default yes)
      await withMockedPrompt([""], async () => {
        await promptAndRunAutoClean();

        // Verify worktree was removed
        const worktrees = await repo.listWorktrees();
        assertEquals(worktrees.includes(oldWorktreePath), false);
      });
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("promptAndRunAutoClean - does NOT remove worktrees when user declines", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create an old worktree
    const oldWorktreePath = await repo.createWorktree("old-branch", "old-branch");
    await makeWorktreeOld(oldWorktreePath, 10);

    // Create config with auto-clean enabled
    const config = createConfigWithAutoClean(repo.path, 7);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Mock prompt response: "n"
      await withMockedPrompt(["n"], async () => {
        await promptAndRunAutoClean();

        // Verify worktree still exists
        const worktrees = await repo.listWorktrees();
        assertEquals(worktrees.includes(oldWorktreePath), true);
      });
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("promptAndRunAutoClean - updates timestamp even when user declines", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create an old worktree
    const oldWorktreePath = await repo.createWorktree("old-branch", "old-branch");
    await makeWorktreeOld(oldWorktreePath, 10);

    // Create config with auto-clean enabled and no lastAutoCleanTime
    const config = createConfigWithAutoClean(repo.path, 7);
    await writeTestConfig(repo.path, config);

    const beforeTime = Date.now();

    const cwd = new TempCwd(repo.path);
    try {
      // Mock prompt response: "n" (decline)
      await withMockedPrompt(["n"], async () => {
        await promptAndRunAutoClean();

        // Verify timestamp was updated even though user declined
        const savedConfig = await readTestConfig(repo.path);
        assertEquals(typeof savedConfig.lastAutoCleanTime, "number");
        assertEquals(savedConfig.lastAutoCleanTime! >= beforeTime, true);
      });
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("promptAndRunAutoClean - no prompt when cooldown hasn't passed", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create an old worktree
    const oldWorktreePath = await repo.createWorktree("old-branch", "old-branch");
    await makeWorktreeOld(oldWorktreePath, 10);

    // Create config with recent lastAutoCleanTime (within cooldown)
    const config = {
      root: repo.path,
      defaultBranch: "main",
      cleanThreshold: 7,
      autoClean: true,
      lastAutoCleanTime: Date.now() - 1000, // 1 second ago
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should not prompt (and should not call mock prompt)
      await promptAndRunAutoClean();

      // Verify worktree still exists (no cleanup happened)
      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(oldWorktreePath), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("promptAndRunAutoClean - no prompt when autoClean is disabled", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create an old worktree
    const oldWorktreePath = await repo.createWorktree("old-branch", "old-branch");
    await makeWorktreeOld(oldWorktreePath, 10);

    // Create config with autoClean disabled
    const config = {
      root: repo.path,
      defaultBranch: "main",
      cleanThreshold: 7,
      autoClean: false,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should not prompt (and should not call mock prompt)
      await promptAndRunAutoClean();

      // Verify worktree still exists (no cleanup happened)
      const worktrees = await repo.listWorktrees();
      assertEquals(worktrees.includes(oldWorktreePath), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("promptAndRunAutoClean - no prompt when no cleanable worktrees exist", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a young worktree (not old enough)
    await repo.createWorktree("young-branch", "young-branch");

    // Create config with auto-clean enabled
    const config = createConfigWithAutoClean(repo.path, 7);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Should not prompt because no worktrees are cleanable
      await promptAndRunAutoClean();

      // Verify timestamp was updated
      const savedConfig = await readTestConfig(repo.path);
      assertEquals(typeof savedConfig.lastAutoCleanTime, "number");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
