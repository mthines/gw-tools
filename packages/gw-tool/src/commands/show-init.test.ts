/**
 * Tests for the show-init command
 */

import { assertEquals } from "$std/assert";
import { executeShowInit } from "./show-init.ts";
import { GitTestRepo } from "../test-utils/git-test-repo.ts";
import { TempCwd } from "../test-utils/temp-env.ts";
import { writeTestConfig } from "../test-utils/fixtures.ts";
import { withMockedExit } from "../test-utils/mock-exit.ts";
import type { Config } from "../lib/types.ts";

Deno.test("show-init command - shows help when --help flag is provided", async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeShowInit(["--help"]);
  });

  assertEquals(exitCode, 0);
});

Deno.test("show-init command - shows help when -h flag is provided", async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executeShowInit(["-h"]);
  });

  assertEquals(exitCode, 0);
});

Deno.test("show-init command - generates init command with minimal config", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config: Config = {
      root: repo.path,
      defaultBranch: "main",
      cleanThreshold: 7,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      // Command should execute successfully and output to stdout
      await executeShowInit([]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("show-init command - generates init command with auto-copy files", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config: Config = {
      root: repo.path,
      defaultBranch: "main",
      autoCopyFiles: [".env", "secrets/", "config/local.json"],
      cleanThreshold: 7,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeShowInit([]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("show-init command - generates init command with hooks", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config: Config = {
      root: repo.path,
      defaultBranch: "main",
      hooks: {
        add: {
          pre: ["echo 'Pre-add hook'"],
          post: ["pnpm install", "echo 'Post-add hook'"],
        },
      },
      cleanThreshold: 7,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeShowInit([]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("show-init command - generates init command with custom default branch", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config: Config = {
      root: repo.path,
      defaultBranch: "develop",
      cleanThreshold: 7,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeShowInit([]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("show-init command - generates init command with auto-clean enabled", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config: Config = {
      root: repo.path,
      defaultBranch: "main",
      cleanThreshold: 7,
      autoClean: true,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeShowInit([]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});

Deno.test("show-init command - generates complete init command with all options", async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const config: Config = {
      root: repo.path,
      defaultBranch: "develop",
      autoCopyFiles: [".env", "secrets/"],
      hooks: {
        add: {
          pre: ["echo 'Starting'"],
          post: ["pnpm install"],
        },
      },
      cleanThreshold: 14,
      autoClean: true,
    };
    await writeTestConfig(repo.path, config);

    const cwd = new TempCwd(repo.path);
    try {
      await executeShowInit([]);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
