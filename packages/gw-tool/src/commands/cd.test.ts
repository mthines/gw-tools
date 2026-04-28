/**
 * Tests for cd.ts command
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { join } from '@std/path';
import { executeCd } from './cd.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';
import { withMockedPrompt } from '../test-utils/mock-prompt.ts';

Deno.test('cd command - errors when no pattern given', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeCd([]);
  });

  assertEquals(exitCode, 1);
});

Deno.test('cd command - exact branch match preferred over multi-match', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    // main worktree is already on branch 'main' at repo.path
    // Create another worktree with branch 'maintenance'
    await repo.createWorktree('maintenance-wt', 'maintenance');

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode, stdout } = await withMockedExit(
        async () => {
          await executeCd(['main']);
        },
        { captureOutput: true }
      );

      // Should resolve to the exact branch match (main), not error
      assertEquals(exitCode, undefined);
      assertEquals(stdout?.trim(), repo.path);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('cd command - non exact multi-match still errors', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('maintenance-wt', 'maintenance');

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode, stderr } = await withMockedExit(
        async () => {
          await executeCd(['mai']);
        },
        { captureOutput: true }
      );

      assertEquals(exitCode, 1);
      assertStringIncludes(stderr ?? '', 'Multiple worktrees match');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('cd command - single partial match works', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feature-abc', 'feature-abc');
    const featurePath = join(repo.path, 'feature-abc');

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode, stdout } = await withMockedExit(
        async () => {
          await executeCd(['feat']);
        },
        { captureOutput: true }
      );

      assertEquals(exitCode, undefined);
      assertEquals(stdout?.trim(), featurePath);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('cd command - errors when no match found', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    await repo.createWorktree('feature-abc', 'feature-abc');

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode, stderr } = await withMockedExit(
        async () => {
          await executeCd(['xyz']);
        },
        { captureOutput: true }
      );

      assertEquals(exitCode, 1);
      assertStringIncludes(stderr ?? '', 'No worktree found matching: xyz');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

// =============================================================================
// Branch mismatch prompt tests
// =============================================================================

Deno.test('cd command - prompts to switch branch when worktree has different branch (accept)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Create worktree "feature-x" on branch "feature-x"
    await repo.createWorktree('feature-x', 'feature-x');
    const featurePath = join(repo.path, 'feature-x');

    // Switch the worktree to a different branch
    await repo.createBranch('feature-y');
    await repo.runCommand('git', ['-C', featurePath, 'checkout', 'feature-y']);

    // Verify it's on feature-y now
    const branchCmd = new Deno.Command('git', {
      args: ['-C', featurePath, 'branch', '--show-current'],
      stdout: 'piped',
    });
    const branchResult = await branchCmd.output();
    const currentBranch = new TextDecoder().decode(branchResult.stdout).trim();
    assertEquals(currentBranch, 'feature-y');

    // Mock stdin as terminal so the prompt logic triggers
    const originalIsTerminal = Deno.stdin.isTerminal;
    // @ts-ignore - Intentionally replacing for testing
    Deno.stdin.isTerminal = () => true;

    const cwd = new TempCwd(repo.path);
    try {
      // Mock prompt to accept (empty string = default Y)
      const { exitCode, stdout } = await withMockedPrompt([''], async () => {
        return await withMockedExit(
          async () => {
            await executeCd(['feature-x']);
          },
          { captureOutput: true }
        );
      });

      // Should succeed and output the path
      assertEquals(exitCode === undefined || exitCode === 0, true);
      assertEquals(stdout?.includes(featurePath), true);

      // Verify branch was switched to feature-x
      const afterBranchCmd = new Deno.Command('git', {
        args: ['-C', featurePath, 'branch', '--show-current'],
        stdout: 'piped',
      });
      const afterResult = await afterBranchCmd.output();
      const afterBranch = new TextDecoder().decode(afterResult.stdout).trim();
      assertEquals(afterBranch, 'feature-x');
    } finally {
      cwd.restore();
      // @ts-ignore - Restoring original
      Deno.stdin.isTerminal = originalIsTerminal;
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('cd command - prompts to switch branch when worktree has different branch (decline)', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    await repo.createWorktree('feature-x', 'feature-x');
    const featurePath = join(repo.path, 'feature-x');

    // Switch the worktree to a different branch
    await repo.createBranch('feature-y');
    await repo.runCommand('git', ['-C', featurePath, 'checkout', 'feature-y']);

    // Mock stdin as terminal
    const originalIsTerminal = Deno.stdin.isTerminal;
    // @ts-ignore - Intentionally replacing for testing
    Deno.stdin.isTerminal = () => true;

    const cwd = new TempCwd(repo.path);
    try {
      // Mock prompt to decline
      const { exitCode, stdout } = await withMockedPrompt(['n'], async () => {
        return await withMockedExit(
          async () => {
            await executeCd(['feature-x']);
          },
          { captureOutput: true }
        );
      });

      // Should still output the path (navigate without switching)
      assertEquals(exitCode === undefined || exitCode === 0, true);
      assertEquals(stdout?.includes(featurePath), true);

      // Verify branch was NOT switched — still on feature-y
      const branchCmd = new Deno.Command('git', {
        args: ['-C', featurePath, 'branch', '--show-current'],
        stdout: 'piped',
      });
      const branchResult = await branchCmd.output();
      const currentBranch = new TextDecoder().decode(branchResult.stdout).trim();
      assertEquals(currentBranch, 'feature-y');
    } finally {
      cwd.restore();
      // @ts-ignore - Restoring original
      Deno.stdin.isTerminal = originalIsTerminal;
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('cd command - no prompt when pattern is not a valid branch', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    await repo.createWorktree('feature-abc', 'feature-abc');
    const featurePath = join(repo.path, 'feature-abc');

    // Mock stdin as terminal
    const originalIsTerminal = Deno.stdin.isTerminal;
    // @ts-ignore - Intentionally replacing for testing
    Deno.stdin.isTerminal = () => true;

    const cwd = new TempCwd(repo.path);
    try {
      // Use partial match "feat" which is NOT a branch name
      // Should just output path, no prompt
      const { exitCode, stdout } = await withMockedExit(
        async () => {
          await executeCd(['feat']);
        },
        { captureOutput: true }
      );

      assertEquals(exitCode, undefined);
      assertEquals(stdout?.trim(), featurePath);
    } finally {
      cwd.restore();
      // @ts-ignore - Restoring original
      Deno.stdin.isTerminal = originalIsTerminal;
    }
  } finally {
    await repo.cleanup();
  }
});

// Note: The shell integration warning only appears when stdout.isTerminal() is true.
// In test environment with captured output, stdout is not a TTY, so the warning
// won't appear. This is correct behavior - the warning shouldn't appear when
// output is being piped/captured (e.g., cd $(gw cd branch)).
// The shell-integration.test.ts tests the detection logic separately.
