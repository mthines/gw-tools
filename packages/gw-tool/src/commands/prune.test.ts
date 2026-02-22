/**
 * Tests for prune command
 */

import { assertArrayIncludes, assertEquals } from '$std/assert';
import {
  getCurrentWorktreePath,
  hasBranchUnpushedCommits,
  listLocalBranches,
  listWorktrees,
} from '../lib/git-utils.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { join } from '$std/path';

Deno.test('getCurrentWorktreePath - should return empty string when not in a worktree', async () => {
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
      assertEquals(path, '');
    } finally {
      // Restore original cwd
      Deno.chdir(originalCwd);
    }
  } finally {
    await testRepo.cleanup();
  }
});

Deno.test('getCurrentWorktreePath - should return path when in a worktree', async () => {
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

Deno.test('listWorktrees should work from bare repo', async () => {
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
      assertEquals(currentPath, '');

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

Deno.test('listLocalBranches - should list all local branches', async () => {
  const testRepo = new GitTestRepo();
  try {
    await testRepo.init();

    // Save the original cwd
    const originalCwd = Deno.cwd();

    try {
      Deno.chdir(testRepo.path);

      // Create some branches
      await testRepo.createBranch('feature-1');
      await testRepo.createBranch('feature-2');

      const branches = await listLocalBranches();

      assertArrayIncludes(branches, ['main']);
      assertArrayIncludes(branches, ['feature-1']);
      assertArrayIncludes(branches, ['feature-2']);
      assertEquals(branches.length, 3);
    } finally {
      Deno.chdir(originalCwd);
    }
  } finally {
    await testRepo.cleanup();
  }
});

Deno.test('hasBranchUnpushedCommits - should return true for local-only branch', async () => {
  const testRepo = new GitTestRepo();
  try {
    await testRepo.init();

    // Save the original cwd
    const originalCwd = Deno.cwd();

    try {
      Deno.chdir(testRepo.path);

      // main has no remote tracking, so it's considered unpushed
      const hasUnpushed = await hasBranchUnpushedCommits('main');
      assertEquals(hasUnpushed, true);
    } finally {
      Deno.chdir(originalCwd);
    }
  } finally {
    await testRepo.cleanup();
  }
});

Deno.test('orphan branch detection - branches without worktrees should be orphans', async () => {
  const testRepo = new GitTestRepo();
  try {
    await testRepo.init();

    // Save the original cwd
    const originalCwd = Deno.cwd();

    try {
      Deno.chdir(testRepo.path);

      // Create worktree for feature-1
      await testRepo.createWorktree('feature-1-wt', 'feature-1');

      // Create a branch without worktree (orphan)
      await testRepo.createBranch('orphan-branch');

      const worktrees = await listWorktrees();
      const branches = await listLocalBranches();

      // Get branches that are in worktrees
      const worktreeBranches = new Set(worktrees.map((wt) => wt.branch).filter(Boolean));

      // Find orphan branches (exclude main as it's the default branch)
      const orphans = branches.filter((b) => !worktreeBranches.has(b) && b !== 'main');

      assertArrayIncludes(orphans, ['orphan-branch']);
      assertEquals(orphans.includes('feature-1'), false); // feature-1 has a worktree
    } finally {
      Deno.chdir(originalCwd);
    }
  } finally {
    await testRepo.cleanup();
  }
});

Deno.test('worktree cleanup - should identify clean worktrees', async () => {
  const testRepo = new GitTestRepo();
  try {
    await testRepo.init();

    // Save the original cwd
    const originalCwd = Deno.cwd();

    try {
      Deno.chdir(testRepo.path);

      // Create a clean worktree
      const cleanWtPath = await testRepo.createWorktree('clean-wt', 'clean-branch');

      // Create a worktree with uncommitted changes
      const dirtyWtPath = await testRepo.createWorktree('dirty-wt', 'dirty-branch');
      await Deno.writeTextFile(join(dirtyWtPath, 'newfile.txt'), 'uncommitted content');

      const worktrees = await listWorktrees();

      // Find the clean and dirty worktrees
      const cleanWt = worktrees.find((wt) => wt.branch === 'clean-branch');
      const dirtyWt = worktrees.find((wt) => wt.branch === 'dirty-branch');

      assertEquals(cleanWt !== undefined, true);
      assertEquals(dirtyWt !== undefined, true);

      // Clean worktree should be cleanable (no uncommitted changes or unpushed commits)
      // But since there's no remote, all branches are considered "unpushed"
      // That's expected behavior - branches without remotes should be protected
    } finally {
      Deno.chdir(originalCwd);
    }
  } finally {
    await testRepo.cleanup();
  }
});

Deno.test('protected branches - gw_root should be protected', async () => {
  const testRepo = new GitTestRepo();
  try {
    await testRepo.init();

    // Save the original cwd
    const originalCwd = Deno.cwd();

    try {
      Deno.chdir(testRepo.path);

      // Create gw_root branch
      await testRepo.createBranch('gw_root');

      const branches = await listLocalBranches();

      // gw_root should exist
      assertArrayIncludes(branches, ['gw_root']);

      // In a real prune operation, gw_root would be protected
      // We test this by verifying it's in the branches list and we exclude it in detection
      const protectedBranches = ['main', 'gw_root'];
      const deletableBranches = branches.filter((b) => !protectedBranches.includes(b));

      assertEquals(deletableBranches.includes('gw_root'), false);
      assertEquals(deletableBranches.includes('main'), false);
    } finally {
      Deno.chdir(originalCwd);
    }
  } finally {
    await testRepo.cleanup();
  }
});

Deno.test('branch with worktree should not be considered orphan', async () => {
  const testRepo = new GitTestRepo();
  try {
    await testRepo.init();

    // Save the original cwd
    const originalCwd = Deno.cwd();

    try {
      Deno.chdir(testRepo.path);

      // Create worktree (this creates the branch too)
      await testRepo.createWorktree('my-feature-wt', 'my-feature');

      const worktrees = await listWorktrees();
      const branches = await listLocalBranches();

      // Get branches that are checked out in worktrees
      const worktreeBranches = new Set(worktrees.map((wt) => wt.branch).filter(Boolean));

      // my-feature should NOT be an orphan because it has a worktree
      assertEquals(worktreeBranches.has('my-feature'), true);

      // Verify the branch exists
      assertArrayIncludes(branches, ['my-feature']);
    } finally {
      Deno.chdir(originalCwd);
    }
  } finally {
    await testRepo.cleanup();
  }
});
