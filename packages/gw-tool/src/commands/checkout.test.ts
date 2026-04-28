/**
 * Tests for checkout.ts command
 */

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { executeCheckout } from "./checkout.ts";
import { _drainAutoClean } from "../lib/auto-clean.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import { TempCwd } from "../test-utils/temp-env.ts";
import {
  createMinimalConfig,
  writeTestConfig,
} from "../test-utils/fixtures.ts";
import { withMockedExit } from "../test-utils/mock-exit.ts";
import { assertShellNavigationWorks } from "../test-utils/assert-shell-nav.ts";

Deno.test("checkout command - shows help with --help", async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeCheckout(["--help"]);
  });

  assertEquals(exitCode, 0);
});

Deno.test("checkout command - shows help with -h", async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeCheckout(["-h"]);
  });

  assertEquals(exitCode, 0);
});

Deno.test("checkout command - shows help when no args provided", async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeCheckout([]);
  });

  assertEquals(exitCode, 1);
});

Deno.test("checkout command - creates worktree for local branch not in any worktree", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a test branch
    await repo.createBranch("feature-x");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await withMockedExit(async () => {
        await executeCheckout(["feature-x"]);
      });
      await _drainAutoClean();

      // Verify a worktree was created (new checkout behavior creates worktrees)
      const listCmd = new Deno.Command("git", {
        args: ["-C", repo.path, "worktree", "list"],
        stdout: "piped",
      });
      const { stdout } = await listCmd.output();
      const worktreeList = new TextDecoder().decode(stdout);
      assertEquals(worktreeList.includes("feature-x"), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - navigates to worktree when branch is checked out elsewhere", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a worktree with a branch
    await repo.createWorktree("feature-branch");
    const featureWorktreePath = join(repo.path, "feature-branch");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(["feature-branch"]);
      });
      await _drainAutoClean();

      assertEquals(exitCode, 0);

      // Verify navigation file was created with the correct path
      const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
      const navFile = join(home, ".gw", "tmp", "last-nav");
      const navPath = await Deno.readTextFile(navFile);
      assertEquals(navPath, featureWorktreePath);

      // Clean up nav marker to prevent stale markers affecting future tests
      try {
        await Deno.remove(navFile);
      } catch {
        // Ignore if already cleaned up
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - says already on branch when current branch matches", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(["main"]); // Already on main
      });
      await _drainAutoClean();

      assertEquals(exitCode, 0);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - remote-only branch creates local tracking branch (not detached HEAD)", async () => {
  // This is the key scenario: gw remove deletes the local branch,
  // then gw checkout should recreate it from the remote ref with
  // proper tracking, NOT end up in detached HEAD.
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create a branch and a commit on it
    await repo.createBranch("remote-feature");

    // Simulate the branch existing on remote by creating the remote ref
    const remoteRefCmd = new Deno.Command("git", {
      args: [
        "-C",
        repo.path,
        "update-ref",
        "refs/remotes/origin/remote-feature",
        "HEAD",
      ],
      stdout: "null",
      stderr: "null",
    });
    await remoteRefCmd.output();

    // Delete the LOCAL branch (simulating what gw remove does)
    const deleteBranchCmd = new Deno.Command("git", {
      args: ["-C", repo.path, "branch", "-D", "remote-feature"],
      stdout: "null",
      stderr: "null",
    });
    await deleteBranchCmd.output();

    // Verify local branch is gone but remote ref exists
    const localCheck = new Deno.Command("git", {
      args: ["-C", repo.path, "rev-parse", "--verify", "remote-feature"],
      stdout: "null",
      stderr: "null",
    });
    assertEquals(
      (await localCheck.output()).code,
      128,
      "local branch should not exist",
    );

    const remoteCheck = new Deno.Command("git", {
      args: ["-C", repo.path, "rev-parse", "--verify", "origin/remote-feature"],
      stdout: "null",
      stderr: "null",
    });
    assertEquals(
      (await remoteCheck.output()).code,
      0,
      "remote ref should exist",
    );

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(["remote-feature"]);
      });
      await _drainAutoClean();

      assertEquals(
        exitCode === undefined || exitCode === 0,
        true,
        "checkout should succeed",
      );

      // Verify worktree was created
      const listCmd = new Deno.Command("git", {
        args: ["-C", repo.path, "worktree", "list"],
        stdout: "piped",
      });
      const { stdout: listOut } = await listCmd.output();
      const worktreeList = new TextDecoder().decode(listOut);
      assertEquals(
        worktreeList.includes("remote-feature"),
        true,
        "worktree should exist",
      );

      // CRITICAL: Verify we're on a local branch, NOT detached HEAD
      const worktreePath = join(repo.path, "remote-feature");
      const branchCmd = new Deno.Command("git", {
        args: ["-C", worktreePath, "symbolic-ref", "--short", "HEAD"],
        stdout: "piped",
        stderr: "piped",
      });
      const branchResult = await branchCmd.output();
      assertEquals(
        branchResult.code,
        0,
        "HEAD should be a symbolic ref (not detached)",
      );
      const currentBranch = new TextDecoder().decode(branchResult.stdout)
        .trim();
      assertEquals(
        currentBranch,
        "remote-feature",
        "should be on local branch remote-feature",
      );

      // Verify tracking is set up
      const mergeCmd = new Deno.Command("git", {
        args: ["-C", worktreePath, "config", "branch.remote-feature.merge"],
        stdout: "piped",
      });
      const mergeResult = await mergeCmd.output();
      assertEquals(mergeResult.code, 0, "tracking merge config should exist");
      const tracking = new TextDecoder().decode(mergeResult.stdout).trim();
      assertEquals(
        tracking,
        "refs/heads/remote-feature",
        "should track origin/remote-feature",
      );

      const remoteCmd = new Deno.Command("git", {
        args: ["-C", worktreePath, "config", "branch.remote-feature.remote"],
        stdout: "piped",
      });
      const remoteResult = await remoteCmd.output();
      assertEquals(
        new TextDecoder().decode(remoteResult.stdout).trim(),
        "origin",
        "remote should be origin",
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - creates worktree with new branch when branch does not exist", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(["new-feature-branch"]);
      });
      await _drainAutoClean();

      // The checkout command should succeed by creating a new branch from main
      // exitCode is undefined when the command completes normally (success)
      assertEquals(exitCode === undefined || exitCode === 0, true);

      // Verify the worktree was created
      const listCmd = new Deno.Command("git", {
        args: ["-C", repo.path, "worktree", "list"],
        stdout: "piped",
      });
      const { stdout } = await listCmd.output();
      const worktreeList = new TextDecoder().decode(stdout);
      assertEquals(worktreeList.includes("new-feature-branch"), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - does NOT overwrite tracking for existing local branches", async () => {
  // This test verifies the fix: when a local branch exists with existing tracking,
  // gw checkout should NOT overwrite that tracking configuration
  const remoteRepo = new GitTestRepo();
  const localRepo = new GitTestRepo();

  try {
    // Initialize the "remote" repository (bare)
    await remoteRepo.initBare();

    // Initialize local repo and add remote
    await localRepo.init();
    await localRepo.runCommand("git", [
      "remote",
      "add",
      "origin",
      remoteRepo.path,
    ], localRepo.path);

    // Push main to remote first
    await localRepo.runCommand(
      "git",
      ["push", "-u", "origin", "main"],
      localRepo.path,
    );

    // Create a local branch with tracking already set up
    await localRepo.createBranch("existing-tracked");

    // Set up tracking to origin/main (simulating an existing tracked branch)
    await localRepo.runCommand("git", [
      "config",
      "branch.existing-tracked.remote",
      "origin",
    ], localRepo.path);
    await localRepo.runCommand("git", [
      "config",
      "branch.existing-tracked.merge",
      "refs/heads/main",
    ], localRepo.path);

    const config = createMinimalConfig(localRepo.path);
    await writeTestConfig(localRepo.path, config);

    const cwd = new TempCwd(localRepo.path);
    try {
      await executeCheckout(["existing-tracked"]);
      await _drainAutoClean();

      // Verify worktree was created
      const listCmd = new Deno.Command("git", {
        args: ["-C", localRepo.path, "worktree", "list"],
        stdout: "piped",
      });
      const { stdout } = await listCmd.output();
      const worktreeList = new TextDecoder().decode(stdout);
      assertEquals(worktreeList.includes("existing-tracked"), true);

      // Verify tracking was NOT overwritten - should still track main, not existing-tracked
      const worktreePath = join(localRepo.path, "existing-tracked");
      const mergeCmd = new Deno.Command("git", {
        args: ["-C", worktreePath, "config", "branch.existing-tracked.merge"],
        stdout: "piped",
      });
      const mergeResult = await mergeCmd.output();
      const tracking = new TextDecoder().decode(mergeResult.stdout).trim();

      // Should still be tracking main, NOT existing-tracked
      assertEquals(
        tracking,
        "refs/heads/main",
        "Existing tracking should NOT be overwritten - should still track main",
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await remoteRepo.cleanup();
    await localRepo.cleanup();
  }
});

Deno.test("checkout command - sets up tracking for truly new branches", async () => {
  // This test verifies that new branches DO get tracking set up
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeCheckout(["new-feature-branch-tracking"]);
      await _drainAutoClean();

      // Verify worktree was created
      const listCmd = new Deno.Command("git", {
        args: ["-C", repo.path, "worktree", "list"],
        stdout: "piped",
      });
      const { stdout } = await listCmd.output();
      const worktreeList = new TextDecoder().decode(stdout);
      assertEquals(worktreeList.includes("new-feature-branch-tracking"), true);

      // Verify tracking was set up to track the new branch name
      const worktreePath = join(repo.path, "new-feature-branch-tracking");
      const mergeCmd = new Deno.Command("git", {
        args: [
          "-C",
          worktreePath,
          "config",
          "branch.new-feature-branch-tracking.merge",
        ],
        stdout: "piped",
      });
      const mergeResult = await mergeCmd.output();
      const tracking = new TextDecoder().decode(mergeResult.stdout).trim();

      // Should be tracking the new branch name
      assertEquals(
        tracking,
        "refs/heads/new-feature-branch-tracking",
        "New branch should track origin/new-feature-branch-tracking",
      );

      const remoteCmd = new Deno.Command("git", {
        args: [
          "-C",
          worktreePath,
          "config",
          "branch.new-feature-branch-tracking.remote",
        ],
        stdout: "piped",
      });
      const remoteResult = await remoteCmd.output();
      const remote = new TextDecoder().decode(remoteResult.stdout).trim();

      assertEquals(
        remote,
        "origin",
        "New branch should have remote set to origin",
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

// =============================================================================
// Shell integration navigation tests
// =============================================================================

Deno.test("checkout - shell integration navigates after command", async () => {
  await assertShellNavigationWorks("checkout");
});

Deno.test("co - shell integration navigates after command", async () => {
  await assertShellNavigationWorks("co");
});

Deno.test("add - shell integration navigates after command", async () => {
  await assertShellNavigationWorks("add");
});

// =============================================================================
// --from-staged flag tests
// =============================================================================

Deno.test("checkout command - --from-staged copies staged files to new worktree", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create and stage some files
    await repo.createFile("staged-file.txt", "staged content");
    await repo.createFile("another-staged.txt", "more staged content");
    await repo.runCommand("git", ["add", "."], repo.path);

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(["feat-from-staged", "--from-staged"]);
      });
      await _drainAutoClean();

      assertEquals(exitCode === undefined || exitCode === 0, true);

      // Verify worktree was created
      const worktreePath = join(repo.path, "feat-from-staged");
      const stat = await Deno.stat(worktreePath);
      assertEquals(stat.isDirectory, true);

      // Verify staged files were copied
      const file1Content = await Deno.readTextFile(
        join(worktreePath, "staged-file.txt"),
      );
      const file2Content = await Deno.readTextFile(
        join(worktreePath, "another-staged.txt"),
      );
      assertEquals(file1Content, "staged content");
      assertEquals(file2Content, "more staged content");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - --from-staged with specific files only copies those files", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create and stage multiple files
    await repo.createFile("include-me.txt", "include content");
    await repo.createFile("exclude-me.txt", "exclude content");
    await repo.runCommand("git", ["add", "."], repo.path);

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout([
          "feat-specific",
          "--from-staged",
          "include-me.txt",
        ]);
      });
      await _drainAutoClean();

      assertEquals(exitCode === undefined || exitCode === 0, true);

      // Verify worktree was created
      const worktreePath = join(repo.path, "feat-specific");

      // Verify only specified file was copied
      const includeContent = await Deno.readTextFile(
        join(worktreePath, "include-me.txt"),
      );
      assertEquals(includeContent, "include content");

      // Excluded file should not exist (it's a new worktree from main)
      let excludeExists = false;
      try {
        await Deno.stat(join(worktreePath, "exclude-me.txt"));
        excludeExists = true;
      } catch {
        excludeExists = false;
      }
      assertEquals(excludeExists, false);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - --from-staged fails when no files are staged", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Don't stage any files

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(["feat-no-staged", "--from-staged"]);
      });
      await _drainAutoClean();

      // Should fail with exit code 1
      assertEquals(exitCode, 1);

      // Verify worktree was NOT created (cleaned up after error)
      let worktreeExists = false;
      try {
        await Deno.stat(join(repo.path, "feat-no-staged"));
        worktreeExists = true;
      } catch {
        worktreeExists = false;
      }
      assertEquals(worktreeExists, false);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - --from-staged preserves nested directory structure", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create and stage a deeply nested file
    await repo.createFile(
      "src/components/Button/index.tsx",
      "export const Button = () => {};",
    );
    await repo.runCommand("git", ["add", "."], repo.path);

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(["feat-nested", "--from-staged"]);
      });
      await _drainAutoClean();

      assertEquals(exitCode === undefined || exitCode === 0, true);

      // Verify nested file was copied with correct path
      const worktreePath = join(repo.path, "feat-nested");
      const nestedContent = await Deno.readTextFile(
        join(worktreePath, "src/components/Button/index.tsx"),
      );
      assertEquals(nestedContent, "export const Button = () => {};");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

// =============================================================================
// Check 1b: worktree at path has different branch checked out
// =============================================================================

Deno.test("checkout command - switches branch when worktree at path has different branch", async () => {
  // Scenario: a worktree exists at path <repo>/target-branch but the user ran
  // "git checkout squatter-branch" inside it, so the path is occupied by a
  // different branch. gw checkout target-branch should detect this, switch
  // the worktree back to target-branch, and navigate there.
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create the branches we need
    await repo.createBranch("target-branch");
    await repo.createBranch("squatter-branch");

    // Create a worktree at the expected path for "target-branch", checked out
    // on "target-branch" initially.
    const worktreePath = join(repo.path, "target-branch");
    await repo.runCommand(
      "git",
      ["worktree", "add", worktreePath, "target-branch"],
      repo.path,
    );

    // Simulate the user running `git checkout squatter-branch` inside the
    // worktree — the path stays at <repo>/target-branch but the branch changes.
    await repo.runCommand(
      "git",
      ["-C", worktreePath, "checkout", "squatter-branch"],
      repo.path,
    );

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // gw checkout target-branch — path exists with squatter-branch, not target-branch
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(["target-branch"]);
      });
      await _drainAutoClean();

      assertEquals(exitCode, 0, "checkout should succeed with exit 0");

      // Verify the worktree is now on target-branch
      const branchCmd = new Deno.Command("git", {
        args: ["-C", worktreePath, "branch", "--show-current"],
        stdout: "piped",
      });
      const branchResult = await branchCmd.output();
      const currentBranch = new TextDecoder().decode(branchResult.stdout)
        .trim();
      assertEquals(
        currentBranch,
        "target-branch",
        "worktree should have switched to target-branch",
      );

      // Verify navigation was signalled to the worktree path
      const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
      const navFile = join(home, ".gw", "tmp", "last-nav");
      const navPath = await Deno.readTextFile(navFile);
      assertEquals(
        navPath,
        worktreePath,
        "should navigate to the worktree path",
      );

      // Clean up nav marker
      try {
        await Deno.remove(navFile);
      } catch {
        // Ignore
      }
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("checkout command - errors when worktree at path has uncommitted changes", async () => {
  // Scenario: same as above, but the worktree at the target path has uncommitted
  // changes on the squatter branch. gw should refuse to switch and show an error.
  const repo = new GitTestRepo();
  try {
    await repo.init();

    await repo.createBranch("target-branch-dirty");
    await repo.createBranch("squatter-branch-dirty");

    const worktreePath = join(repo.path, "target-branch-dirty");
    await repo.runCommand(
      "git",
      ["worktree", "add", worktreePath, "target-branch-dirty"],
      repo.path,
    );

    // Switch the worktree to squatter-branch-dirty
    await repo.runCommand(
      "git",
      ["-C", worktreePath, "checkout", "squatter-branch-dirty"],
      repo.path,
    );

    // Create an uncommitted change in that worktree
    const dirtyFile = join(worktreePath, "dirty-file.txt");
    await Deno.writeTextFile(dirtyFile, "uncommitted content");

    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(async () => {
        await executeCheckout(["target-branch-dirty"]);
      });
      await _drainAutoClean();

      // Should exit with code 1 due to uncommitted changes
      assertEquals(
        exitCode,
        1,
        "should fail with exit code 1 when uncommitted changes exist",
      );

      // Worktree should still be on squatter-branch-dirty (not switched)
      const branchCmd = new Deno.Command("git", {
        args: ["-C", worktreePath, "branch", "--show-current"],
        stdout: "piped",
      });
      const branchResult = await branchCmd.output();
      const currentBranch = new TextDecoder().decode(branchResult.stdout)
        .trim();
      assertEquals(
        currentBranch,
        "squatter-branch-dirty",
        "worktree should still be on squatter-branch-dirty (not switched)",
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
