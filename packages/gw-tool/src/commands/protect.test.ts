/**
 * Tests for protect.ts and unprotect.ts commands
 */

import { assertEquals } from '@std/assert';
import { executeProtect } from './protect.ts';
import { executeUnprotect } from './unprotect.ts';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { createMinimalConfig, readTestConfig, writeTestConfig } from '../test-utils/fixtures.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';

// ── protect command ──────────────────────────────────────────────────────────

Deno.test('protect - adds a branch to protectedBranches', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeProtect(['staging']);

      const saved = await readTestConfig(repo.path);
      assertEquals(saved.protectedBranches, ['staging']);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('protect - appends without duplicating', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = { ...createMinimalConfig(repo.path), protectedBranches: ['staging'] };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeProtect(['develop']);

      const saved = await readTestConfig(repo.path);
      assertEquals(saved.protectedBranches, ['staging', 'develop']);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('protect - exits 0 when branch already protected', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = { ...createMinimalConfig(repo.path), protectedBranches: ['staging'] };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeProtect(['staging']));
      assertEquals(exitCode, 0);

      // List should be unchanged
      const saved = await readTestConfig(repo.path);
      assertEquals(saved.protectedBranches, ['staging']);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('protect - auto-detects branch from cwd', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    // cwd is in the main branch of the repo
    const cwd = new TempCwd(repo.path);
    try {
      await executeProtect([]);

      const saved = await readTestConfig(repo.path);
      // The auto-detected branch should be "main" (init() creates main)
      assertEquals(saved.protectedBranches?.includes('main'), true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('protect - shows help and exits 0', async () => {
  const { exitCode } = await withMockedExit(() => executeProtect(['--help']));
  assertEquals(exitCode, 0);
});

Deno.test(
  'protect - writes to the loaded config file, not the git root, when a worktree has its own .gw/config.json',
  async () => {
    // Regression: previously `executeProtect` used `gitRoot` as the save target,
    // but `loadConfig` walks up from cwd and may find a nearer worktree-local
    // config. When the two diverge, `gw protect` wrote to the root and
    // `gw ls` (which reads via the same loader) never saw the change.
    const repo = new GitTestRepo();
    try {
      await repo.init();
      // Root config (the one gitRoot would resolve to)
      const rootConfig = createMinimalConfig(repo.path);
      await writeTestConfig(repo.path, rootConfig);

      // Worktree with its own .gw/config.json — this is the file loadConfig will
      // find when cwd is the worktree, so it must be the file we write back to.
      const worktreePath = await repo.createWorktree('feat-x', 'feat-x');
      const worktreeConfig = createMinimalConfig(worktreePath);
      await writeTestConfig(worktreePath, worktreeConfig);

      const cwd = new TempCwd(worktreePath);
      try {
        await executeProtect(['feat-x']);

        // The worktree config must reflect the new protection
        const worktreeSaved = await readTestConfig(worktreePath);
        assertEquals(worktreeSaved.protectedBranches, ['feat-x']);

        // The root config must remain untouched
        const rootSaved = await readTestConfig(repo.path);
        assertEquals(rootSaved.protectedBranches, undefined);
      } finally {
        cwd.restore();
      }
    } finally {
      await repo.cleanup();
    }
  }
);

// ── unprotect command ────────────────────────────────────────────────────────

Deno.test('unprotect - removes a branch from protectedBranches', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = { ...createMinimalConfig(repo.path), protectedBranches: ['staging', 'develop'] };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeUnprotect(['staging']);

      const saved = await readTestConfig(repo.path);
      assertEquals(saved.protectedBranches, ['develop']);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('unprotect - removes protectedBranches field when list becomes empty', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = { ...createMinimalConfig(repo.path), protectedBranches: ['staging'] };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeUnprotect(['staging']);

      const saved = await readTestConfig(repo.path);
      // Field should be absent (undefined) — cleaner config
      assertEquals(saved.protectedBranches, undefined);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('unprotect - exits 0 with warning when branch not in list', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = createMinimalConfig(repo.path);
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeUnprotect(['nonexistent']));
      assertEquals(exitCode, 0);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('unprotect - auto-detects branch from cwd', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();
    const config = { ...createMinimalConfig(repo.path), protectedBranches: ['main', 'staging'] };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // cwd is on 'main', so it should remove 'main' from the user list
      await executeUnprotect([]);

      const saved = await readTestConfig(repo.path);
      assertEquals(saved.protectedBranches, ['staging']);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test('unprotect - shows help and exits 0', async () => {
  const { exitCode } = await withMockedExit(() => executeUnprotect(['--help']));
  assertEquals(exitCode, 0);
});

Deno.test(
  'unprotect - writes to the loaded config file, not the git root, when a worktree has its own .gw/config.json',
  async () => {
    const repo = new GitTestRepo();
    try {
      await repo.init();
      const rootConfig = createMinimalConfig(repo.path);
      await writeTestConfig(repo.path, rootConfig);

      const worktreePath = await repo.createWorktree('feat-x', 'feat-x');
      const worktreeConfig = { ...createMinimalConfig(worktreePath), protectedBranches: ['feat-x'] };
      await writeTestConfig(worktreePath, worktreeConfig);

      const cwd = new TempCwd(worktreePath);
      try {
        await executeUnprotect(['feat-x']);

        const worktreeSaved = await readTestConfig(worktreePath);
        assertEquals(worktreeSaved.protectedBranches, undefined);

        const rootSaved = await readTestConfig(repo.path);
        assertEquals(rootSaved.protectedBranches, undefined);
      } finally {
        cwd.restore();
      }
    } finally {
      await repo.cleanup();
    }
  }
);
