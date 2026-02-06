/**
 * Tests for clean.ts command
 * Tests the cleanup of stale/safe worktrees with various flags
 */

import { assertEquals } from "$std/assert";
import { join } from "$std/path";
import { executeClean } from "./clean.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import { TempCwd } from "../test-utils/temp-env.ts";
import {
  createMinimalConfig,
  writeTestConfig,
} from "../test-utils/fixtures.ts";
import { withMockedExit } from "../test-utils/mock-exit.ts";

/**
 * Helper to mock stdin for confirmation prompts
 */
function mockStdin(response: string): () => void {
  const originalRead = Deno.stdin.read;

  // @ts-ignore - Intentionally replacing for testing
  Deno.stdin.read = async (_buffer: Uint8Array): Promise<number | null> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(response + "\n");
    _buffer.set(data);
    return data.length;
  };

  return () => {
    Deno.stdin.read = originalRead;
  };
}

/**
 * Helper to run function with mocked stdin
 */
async function withMockedStdin<T>(
  response: string,
  fn: () => Promise<T>,
): Promise<T> {
  const restore = mockStdin(response);
  try {
    const result = await fn();
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

/**
 * Helper to set file modification time to make worktree appear old
 * Updates the .git file which is used to calculate worktree age
 */
async function makeWorktreeOld(worktreePath: string, daysOld: number): Promise<void> {
  const gitFilePath = join(worktreePath, ".git");
  const now = Date.now();
  const oldTime = now - (daysOld * 24 * 60 * 60 * 1000);
  await Deno.utime(gitFilePath, oldTime / 1000, oldTime / 1000);
}

Deno.test("clean command - shows help message", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeClean(["--help"]));

      assertEquals(exitCode, 0, "Should exit with code 0 for help");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - dry run shows what would be removed (default mode)", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a worktree
    await repo.createWorktree("feat-branch");

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeClean(["--dry-run"]));

      assertEquals(exitCode, 0, "Should exit with code 0 for dry run");

      // Verify worktree still exists (not actually removed)
      const worktrees = await repo.listWorktrees();
      const hasFeatBranch = worktrees.some(wt => wt.includes("feat-branch"));
      assertEquals(hasFeatBranch, true, "Worktree should not be removed in dry run");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - removes all safe worktrees by default (no age check)", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a NEW worktree (just created, not old)
    const worktreePath = await repo.createWorktree("feat-branch");

    const cwd = new TempCwd(repo.path);
    try {
      // Confirm removal with "yes"
      await withMockedStdin("yes", async () => {
        await executeClean([]);
      });

      // Verify worktree was removed (even though it's new)
      const worktrees = await repo.listWorktrees();
      const hasFeatBranch = worktrees.some(wt => wt.includes("feat-branch"));
      assertEquals(hasFeatBranch, false, "New worktree should be removed by default");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - with --use-autoclean-threshold only removes old worktrees", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a NEW worktree (less than 7 days old)
    const newWorktree = await repo.createWorktree("new-branch");

    // Create an OLD worktree (more than 7 days old)
    const oldWorktree = await repo.createWorktree("old-branch");
    await makeWorktreeOld(oldWorktree, 10);

    const cwd = new TempCwd(repo.path);
    try {
      // Confirm removal with "yes"
      await withMockedStdin("yes", async () => {
        await withMockedExit(async () => {
          await executeClean(["--use-autoclean-threshold"]);
        });
      });

      const worktrees = await repo.listWorktrees();

      // New worktree should still exist
      const hasNewBranch = worktrees.some(wt => wt.includes("new-branch"));
      assertEquals(hasNewBranch, true, "New worktree should NOT be removed with threshold flag");

      // Old worktree should be removed
      const hasOldBranch = worktrees.some(wt => wt.includes("old-branch"));
      assertEquals(hasOldBranch, false, "Old worktree should be removed with threshold flag");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - skips worktrees with uncommitted changes", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a worktree with uncommitted changes
    const worktreePath = await repo.createWorktree("feat-branch");
    await repo.createFile("feat-branch/new-file.txt", "uncommitted content");

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeClean([]));

      assertEquals(exitCode, 0, "Should exit successfully");

      // Verify worktree still exists (protected by safety check)
      const worktrees = await repo.listWorktrees();
      const hasFeatBranch = worktrees.some(wt => wt.includes("feat-branch"));
      assertEquals(hasFeatBranch, true, "Worktree with uncommitted changes should not be removed");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - force flag removes worktrees with uncommitted changes", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a worktree with uncommitted changes
    const worktreePath = await repo.createWorktree("feat-branch");
    await repo.createFile("feat-branch/new-file.txt", "uncommitted content");

    const cwd = new TempCwd(repo.path);
    try {
      // Confirm removal with "yes"
      await withMockedStdin("yes", async () => {
        await executeClean(["--force"]);
      });

      // Verify worktree was removed (force overrides safety checks)
      const worktrees = await repo.listWorktrees();
      const hasFeatBranch = worktrees.some(wt => wt.includes("feat-branch"));
      assertEquals(hasFeatBranch, false, "Force flag should remove worktree with uncommitted changes");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - skips worktrees with unpushed commits", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a worktree
    const worktreePath = await repo.createWorktree("feat-branch");

    // Create a commit in the worktree (will be unpushed)
    const cwd = new TempCwd(worktreePath);
    try {
      await repo.createFile("feat-branch/file.txt", "content");
      await repo.createCommit("Add file");

      cwd.restore();

      const mainCwd = new TempCwd(repo.path);
      try {
        const { exitCode } = await withMockedExit(() => executeClean([]));

        assertEquals(exitCode, 0, "Should exit successfully");

        // Verify worktree still exists (protected by safety check)
        const worktrees = await repo.listWorktrees();
        const hasFeatBranch = worktrees.some(wt => wt.includes("feat-branch"));
        assertEquals(hasFeatBranch, true, "Worktree with unpushed commits should not be removed");
      } finally {
        mainCwd.restore();
      }
    } finally {
      // Cleanup if needed
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - cancels when user declines confirmation", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a clean worktree
    await repo.createWorktree("feat-branch");

    const cwd = new TempCwd(repo.path);
    try {
      // Decline removal with "no"
      const { exitCode } = await withMockedStdin("no", async () => {
        return await withMockedExit(() => executeClean([]));
      });

      assertEquals(exitCode, 0, "Should exit with code 0 when cancelled");

      // Verify worktree still exists (user declined)
      const worktrees = await repo.listWorktrees();
      const hasFeatBranch = worktrees.some(wt => wt.includes("feat-branch"));
      assertEquals(hasFeatBranch, true, "Worktree should not be removed when user cancels");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - exits successfully when no worktrees to clean", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Don't create any worktrees
    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeClean([]));

      assertEquals(exitCode, 0, "Should exit successfully when no worktrees");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - combines dry-run with use-threshold flag", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create an old worktree
    const oldWorktree = await repo.createWorktree("old-branch");
    await makeWorktreeOld(oldWorktree, 10);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() =>
        executeClean(["--use-autoclean-threshold", "--dry-run"])
      );

      assertEquals(exitCode, 0, "Should exit with code 0 for dry run");

      // Verify worktree still exists (not actually removed in dry run)
      const worktrees = await repo.listWorktrees();
      const hasOldBranch = worktrees.some(wt => wt.includes("old-branch"));
      assertEquals(hasOldBranch, true, "Worktree should not be removed in dry run");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - respects custom cleanThreshold from config", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Set custom threshold of 14 days
    const config = {
      root: repo.path,
      cleanThreshold: 14,
    };
    await writeTestConfig(repo.path, config);

    // Create worktrees with different ages
    const tenDayOld = await repo.createWorktree("ten-day-old");
    await makeWorktreeOld(tenDayOld, 10);

    const twentyDayOld = await repo.createWorktree("twenty-day-old");
    await makeWorktreeOld(twentyDayOld, 20);

    const cwd = new TempCwd(repo.path);
    try {
      // Confirm removal with "yes"
      await withMockedStdin("yes", async () => {
        await withMockedExit(async () => {
          await executeClean(["--use-autoclean-threshold"]);
        });
      });

      const worktrees = await repo.listWorktrees();

      // 10-day-old should still exist (below 14-day threshold)
      const hasTenDay = worktrees.some(wt => wt.includes("ten-day-old"));
      assertEquals(hasTenDay, true, "10-day worktree should NOT be removed (below 14-day threshold)");

      // 20-day-old should be removed (above 14-day threshold)
      const hasTwentyDay = worktrees.some(wt => wt.includes("twenty-day-old"));
      assertEquals(hasTwentyDay, false, "20-day worktree should be removed (above 14-day threshold)");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - never removes bare repository", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Try to clean (bare repo should be skipped automatically)
      const { exitCode } = await withMockedExit(() => executeClean([]));

      assertEquals(exitCode, 0, "Should exit successfully");

      // Verify main repo still exists
      const mainExists = await Deno.stat(repo.path).then(() => true).catch(() => false);
      assertEquals(mainExists, true, "Bare/main repository should never be removed");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - automatically prunes phantom worktrees before listing", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create a worktree
    const worktreePath = await repo.createWorktree("feat-branch");

    // Manually delete the worktree directory (simulating rm -rf)
    await Deno.remove(worktreePath, { recursive: true });

    const cwd = new TempCwd(repo.path);
    try {
      // Run clean with dry-run
      const { exitCode } = await withMockedExit(() => executeClean(["--dry-run"]));

      assertEquals(exitCode, 0, "Should exit successfully");

      // Verify phantom worktree was pruned
      const cmd = new Deno.Command("git", {
        args: ["-C", repo.path, "worktree", "list"],
        stdout: "piped",
      });
      const { stdout } = await cmd.output();
      const output = new TextDecoder().decode(stdout);

      assertEquals(
        output.includes("feat-branch"),
        false,
        "Phantom worktree should be pruned"
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - continues successfully even if prune fails", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    await repo.createWorktree("feat-branch");

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeClean(["--dry-run"]));
      assertEquals(exitCode, 0, "Should succeed even if prune has issues");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("clean command - prunes multiple phantom worktrees at once", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // Create and delete multiple worktrees
    const wt1 = await repo.createWorktree("feat-1");
    const wt2 = await repo.createWorktree("feat-2");
    const wt3 = await repo.createWorktree("feat-3");

    await Deno.remove(wt1, { recursive: true });
    await Deno.remove(wt2, { recursive: true });
    await Deno.remove(wt3, { recursive: true });

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeClean([]));
      assertEquals(exitCode, 0);

      // Verify all are pruned
      const worktrees = await repo.listWorktrees();
      const hasAnyPhantom = worktrees.some(wt =>
        wt.includes("feat-1") || wt.includes("feat-2") || wt.includes("feat-3")
      );
      assertEquals(hasAnyPhantom, false, "All phantoms should be pruned");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
