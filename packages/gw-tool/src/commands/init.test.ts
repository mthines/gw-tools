/**
 * Tests for init.ts command
 */

import { assertEquals, assertRejects } from "$std/assert";
import { join } from "$std/path";
import { executeInit } from "./init.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import { TempCwd } from "../test-utils/temp-env.ts";
import { readTestConfig } from "../test-utils/fixtures.ts";
import { assertFileExists } from "../test-utils/assertions.ts";

Deno.test("init command - creates config with auto-detected root", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit([]);

      // Verify config was created
      await assertFileExists(join(repo.path, ".gw", "config.json"));

      // Verify config content
      const config = await readTestConfig(repo.path);
      assertEquals(config.root, repo.path);
      assertEquals(config.defaultBranch, "main");
      assertEquals(config.cleanThreshold, 7);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - creates config with explicit root", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Run init from a different directory
    const tempDir = Deno.makeTempDirSync();
    const cwd = new TempCwd(tempDir);
    try {
      await executeInit(["--root", repo.path]);

      // Verify config was created in the specified root
      await assertFileExists(join(repo.path, ".gw", "config.json"));

      // Verify config content
      const config = await readTestConfig(repo.path);
      assertEquals(config.root, repo.path);
    } finally {
      cwd.restore();
      await Deno.remove(tempDir, { recursive: true });
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - sets custom default branch", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(["--default-source", "develop"]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.defaultBranch, "develop");
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - configures auto-copy files", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(["--auto-copy-files", ".env,secrets/,config.json"]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.autoCopyFiles, [".env", "secrets/", "config.json"]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - configures pre-add hooks", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(["--pre-add", "echo 'Starting...'"]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.hooks?.add?.pre, ["echo 'Starting...'"]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - configures post-add hooks", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(["--post-add", "cd {worktreePath} && pnpm install"]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.hooks?.add?.post, [
        "cd {worktreePath} && pnpm install",
      ]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - configures multiple hooks", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit([
        "--pre-add",
        "echo 'Pre-hook 1'",
        "--pre-add",
        "echo 'Pre-hook 2'",
        "--post-add",
        "echo 'Post-hook 1'",
      ]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.hooks?.add?.pre, [
        "echo 'Pre-hook 1'",
        "echo 'Pre-hook 2'",
      ]);
      assertEquals(config.hooks?.add?.post, ["echo 'Post-hook 1'"]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - configures clean threshold", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(["--clean-threshold", "14"]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.cleanThreshold, 14);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - enables auto-clean", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit(["--auto-clean"]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.autoClean, true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - configures all options together", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await executeInit([
        "--default-source",
        "develop",
        "--auto-copy-files",
        ".env,secrets/",
        "--pre-add",
        "echo 'Pre'",
        "--post-add",
        "echo 'Post'",
        "--clean-threshold",
        "21",
        "--auto-clean",
      ]);

      const config = await readTestConfig(repo.path);
      assertEquals(config.defaultBranch, "develop");
      assertEquals(config.autoCopyFiles, [".env", "secrets/"]);
      assertEquals(config.hooks?.add?.pre, ["echo 'Pre'"]);
      assertEquals(config.hooks?.add?.post, ["echo 'Post'"]);
      assertEquals(config.cleanThreshold, 21);
      assertEquals(config.autoClean, true);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("init command - fails with invalid clean threshold", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      await assertRejects(
        () => executeInit(["--clean-threshold", "invalid"]),
        Error,
        "--clean-threshold must be a non-negative number",
      );
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test({
  name: "init command - fails when not in a git repo and no root specified",
  ignore: true, // Skip - Deno.exit() cannot be easily tested
  fn: async () => {
    const tempDir = Deno.makeTempDirSync({ prefix: "gw-test-notgit-" });
    try {
      const cwd = new TempCwd(tempDir);
      try {
        await executeInit([]);
      } finally {
        cwd.restore();
      }
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "init command - fails when specified root doesn't exist",
  ignore: true, // Skip - Deno.exit() cannot be easily tested
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    try {
      const cwd = new TempCwd(tempDir);
      try {
        await executeInit(["--root", "/nonexistent/path"]);
      } finally {
        cwd.restore();
      }
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
});
