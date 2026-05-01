/**
 * Shell integration navigation test utilities.
 *
 * Tests that running `gw <command>` through the shell integration
 * actually navigates to the expected directory.
 */

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { getBashFunction } from "../commands/install-shell.ts";

/**
 * Assert that running `gw <commandName> ...` through the shell integration
 * actually navigates to the path written by signalNavigation.
 *
 * Uses bash with a mock gw that writes the nav file.
 */
export async function assertShellNavigationWorks(
  commandName: string,
): Promise<void> {
  const tempDir = await Deno.makeTempDir({ prefix: "gw-shell-nav-test-" });
  const fakeHome = join(tempDir, "home");
  const targetDir = join(tempDir, "target");
  await Deno.mkdir(fakeHome, { recursive: true });
  await Deno.mkdir(targetDir);

  // Mock gw: writes targetDir to nav file (simulating signalNavigation)
  const mockGw = join(tempDir, "mock-gw");
  await Deno.writeTextFile(
    mockGw,
    `#!/bin/bash\nmkdir -p "$HOME/.gw/tmp"\necho "${targetDir}" > "$HOME/.gw/tmp/last-nav"\n`,
  );
  await Deno.chmod(mockGw, 0o755);

  // Generate shell function with mock as the command
  const shellFunc = getBashFunction("gw", mockGw);
  const scriptPath = join(fakeHome, "integration.bash");
  await Deno.writeTextFile(scriptPath, shellFunc);

  try {
    // Run in a real bash subshell
    const cmd = new Deno.Command("bash", {
      args: [
        "-c",
        `source "${scriptPath}" && gw ${commandName} test-arg && pwd`,
      ],
      env: { HOME: fakeHome, PATH: Deno.env.get("PATH") || "" },
      stdout: "piped",
      stderr: "piped",
    });

    const result = await cmd.output();
    const stdout = new TextDecoder().decode(result.stdout).trim();

    assertEquals(
      stdout,
      targetDir,
      `Shell integration should navigate to target dir after "gw ${commandName}"`,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

/**
 * Assert that running `gw <commandName>` through the shell integration
 * navigates to git root when the current directory is removed.
 */
export async function assertShellRemoveNavigationWorks(
  commandName: string,
): Promise<void> {
  const tempDir = await Deno.makeTempDir({ prefix: "gw-shell-nav-test-" });
  const fakeHome = join(tempDir, "home");
  const gitRoot = join(tempDir, "git-root");
  const removableDir = join(tempDir, "removable");
  await Deno.mkdir(fakeHome, { recursive: true });
  await Deno.mkdir(gitRoot);
  await Deno.mkdir(removableDir);

  // Mock gw:
  //   - "root" subcommand → prints gitRoot
  //   - "rm"/"remove" subcommand → deletes removableDir
  const mockGw = join(tempDir, "mock-gw");
  await Deno.writeTextFile(
    mockGw,
    `#!/bin/bash
if [[ "$1" == "root" ]]; then
  echo "${gitRoot}"
else
  rm -rf "${removableDir}"
fi
`,
  );
  await Deno.chmod(mockGw, 0o755);

  // Generate shell function with mock as the command
  const shellFunc = getBashFunction("gw", mockGw);
  const scriptPath = join(fakeHome, "integration.bash");
  await Deno.writeTextFile(scriptPath, shellFunc);

  try {
    // Run in a real bash subshell, starting in the removable directory
    const cmd = new Deno.Command("bash", {
      args: [
        "-c",
        `source "${scriptPath}" && cd "${removableDir}" && gw ${commandName} test-arg && pwd`,
      ],
      env: { HOME: fakeHome, PATH: Deno.env.get("PATH") || "" },
      stdout: "piped",
      stderr: "piped",
    });

    const result = await cmd.output();
    const stdout = new TextDecoder().decode(result.stdout).trim();

    assertEquals(
      stdout,
      gitRoot,
      `Shell integration should navigate to git root after "gw ${commandName}" removes current dir`,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}
