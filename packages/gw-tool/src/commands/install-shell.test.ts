/**
 * Tests for install-shell command
 */

import { assertEquals, assertStringIncludes } from '$std/assert';
import { join } from '$std/path';
import { executeInstallShell } from './install-shell.ts';
import { TempHome } from '../test-utils/temp-env.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';

Deno.test('install-shell - exits with error when HOME is not set', async () => {
  const tempHome = new TempHome();
  try {
    // Unset HOME to simulate npm install environment without HOME
    const originalHome = Deno.env.get('HOME');
    Deno.env.delete('HOME');

    try {
      const { exitCode, stdout, stderr } = await withMockedExit(() => executeInstallShell([]), { captureOutput: true });

      assertEquals(exitCode, 1, 'Should exit with error code 1');
      const output = (stdout || '') + (stderr || '');
      assertStringIncludes(
        output,
        'HOME environment variable is not set',
        'Should show clear error about HOME not being set'
      );
      assertStringIncludes(output, 'Shell integration requires HOME to be set', 'Should provide explanation');
    } finally {
      // Restore HOME
      if (originalHome) {
        Deno.env.set('HOME', originalHome);
      }
    }
  } finally {
    tempHome.restore();
  }
});

Deno.test('install-shell - exits with error for unsupported shell', async () => {
  const tempHome = new TempHome();
  try {
    // Set SHELL to an unsupported shell
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/bin/sh');

    try {
      const { exitCode, stdout, stderr } = await withMockedExit(() => executeInstallShell([]), { captureOutput: true });

      assertEquals(exitCode, 1, 'Should exit with error code 1');
      const output = (stdout || '') + (stderr || '');
      assertStringIncludes(output, 'Unsupported shell: sh', 'Should show which shell is unsupported');
      assertStringIncludes(output, 'Supported shells: zsh, bash, fish', 'Should list supported shells');
      assertStringIncludes(
        output,
        'You can still use gw without shell integration',
        'Should explain that gw still works'
      );
    } finally {
      // Restore SHELL
      if (originalShell) {
        Deno.env.set('SHELL', originalShell);
      } else {
        Deno.env.delete('SHELL');
      }
    }
  } finally {
    tempHome.restore();
  }
});

Deno.test('install-shell - installs for zsh', async () => {
  const tempHome = new TempHome();
  try {
    // Set SHELL to zsh
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/bin/zsh');

    try {
      await executeInstallShell([]);

      // Check that .zshrc was created/modified
      const zshrcPath = join(tempHome.path, '.zshrc');
      const zshrcContent = await Deno.readTextFile(zshrcPath);

      assertStringIncludes(zshrcContent, '# gw-tools shell integration', 'Should add integration comment to .zshrc');
      assertStringIncludes(zshrcContent, 'source ~/.gw/shell/integration.zsh', 'Should add source line to .zshrc');

      // Check that integration script was created
      const scriptPath = join(tempHome.path, '.gw', 'shell', 'integration.zsh');
      const scriptContent = await Deno.readTextFile(scriptPath);

      assertStringIncludes(scriptContent, 'gw() {', 'Should create gw function in integration script');
      assertStringIncludes(scriptContent, 'if [[ "$1" == "cd" ]];', 'Should handle cd command in integration script');
    } finally {
      // Restore SHELL
      if (originalShell) {
        Deno.env.set('SHELL', originalShell);
      } else {
        Deno.env.delete('SHELL');
      }
    }
  } finally {
    await tempHome.cleanup();
  }
});

Deno.test('install-shell - installs for bash', async () => {
  const tempHome = new TempHome();
  try {
    // Set SHELL to bash
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/bin/bash');

    try {
      await executeInstallShell([]);

      // Check that .bashrc was created/modified
      const bashrcPath = join(tempHome.path, '.bashrc');
      const bashrcContent = await Deno.readTextFile(bashrcPath);

      assertStringIncludes(bashrcContent, '# gw-tools shell integration', 'Should add integration comment to .bashrc');
      assertStringIncludes(bashrcContent, 'source ~/.gw/shell/integration.bash', 'Should add source line to .bashrc');

      // Check that integration script was created
      const scriptPath = join(tempHome.path, '.gw', 'shell', 'integration.bash');
      const scriptContent = await Deno.readTextFile(scriptPath);

      assertStringIncludes(scriptContent, 'gw() {', 'Should create gw function in integration script');
      assertStringIncludes(scriptContent, 'if [[ "$1" == "cd" ]];', 'Should handle cd command in integration script');
    } finally {
      // Restore SHELL
      if (originalShell) {
        Deno.env.set('SHELL', originalShell);
      } else {
        Deno.env.delete('SHELL');
      }
    }
  } finally {
    await tempHome.cleanup();
  }
});

Deno.test('install-shell - installs for fish', async () => {
  const tempHome = new TempHome();
  try {
    // Set SHELL to fish
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/usr/local/bin/fish');

    try {
      await executeInstallShell([]);

      // Check that fish function file was created
      const functionPath = join(tempHome.path, '.config', 'fish', 'functions', 'gw.fish');
      const functionContent = await Deno.readTextFile(functionPath);

      assertStringIncludes(
        functionContent,
        '# gw-tools shell integration',
        'Should add integration comment to fish function'
      );
      assertStringIncludes(functionContent, 'function gw', 'Should create gw function');
      assertStringIncludes(functionContent, 'if test "$argv[1]" = "cd"', 'Should handle cd command in fish function');
    } finally {
      // Restore SHELL
      if (originalShell) {
        Deno.env.set('SHELL', originalShell);
      } else {
        Deno.env.delete('SHELL');
      }
    }
  } finally {
    await tempHome.cleanup();
  }
});

Deno.test('install-shell - does not duplicate installation', async () => {
  const tempHome = new TempHome();
  try {
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/bin/zsh');

    try {
      // Install once
      await executeInstallShell([]);

      // Get initial content
      const zshrcPath = join(tempHome.path, '.zshrc');
      const initialContent = await Deno.readTextFile(zshrcPath);
      const initialLineCount = initialContent.split('\n').length;

      // Install again
      await executeInstallShell([]);

      // Check that content wasn't duplicated
      const finalContent = await Deno.readTextFile(zshrcPath);
      const finalLineCount = finalContent.split('\n').length;

      assertEquals(finalLineCount, initialLineCount, 'Should not duplicate integration lines when already installed');
    } finally {
      if (originalShell) {
        Deno.env.set('SHELL', originalShell);
      } else {
        Deno.env.delete('SHELL');
      }
    }
  } finally {
    await tempHome.cleanup();
  }
});

Deno.test('install-shell - removes integration with --remove flag', async () => {
  const tempHome = new TempHome();
  try {
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/bin/zsh');

    try {
      // Install first
      await executeInstallShell([]);

      const zshrcPath = join(tempHome.path, '.zshrc');
      const scriptPath = join(tempHome.path, '.gw', 'shell', 'integration.zsh');

      // Verify it was installed
      const installedContent = await Deno.readTextFile(zshrcPath);
      assertStringIncludes(installedContent, 'gw-tools shell integration');

      // Remove it
      await executeInstallShell(['--remove']);

      // Verify it was removed from .zshrc
      const removedContent = await Deno.readTextFile(zshrcPath);
      assertEquals(
        removedContent.includes('gw-tools shell integration'),
        false,
        'Should remove integration from .zshrc'
      );

      // Verify script file was deleted
      let scriptExists = false;
      try {
        await Deno.stat(scriptPath);
        scriptExists = true;
      } catch {
        // File doesn't exist, which is what we want
      }
      assertEquals(scriptExists, false, 'Should delete integration script file');
    } finally {
      if (originalShell) {
        Deno.env.set('SHELL', originalShell);
      } else {
        Deno.env.delete('SHELL');
      }
    }
  } finally {
    await tempHome.cleanup();
  }
});

Deno.test('install-shell - installs with custom command name', async () => {
  const tempHome = new TempHome();
  try {
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/bin/zsh');

    try {
      await executeInstallShell(['--name', 'gw-dev', '--command', 'deno run --allow-all main.ts']);

      // Check that custom name was used
      const zshrcPath = join(tempHome.path, '.zshrc');
      const zshrcContent = await Deno.readTextFile(zshrcPath);

      assertStringIncludes(
        zshrcContent,
        '# gw-tools shell integration (gw-dev)',
        'Should use custom command name in comment'
      );
      assertStringIncludes(
        zshrcContent,
        'source ~/.gw/shell/integration-gw-dev.zsh',
        'Should use custom name in script path'
      );

      // Check that integration script uses custom command
      const scriptPath = join(tempHome.path, '.gw', 'shell', 'integration-gw-dev.zsh');
      const scriptContent = await Deno.readTextFile(scriptPath);

      assertStringIncludes(scriptContent, 'gw-dev() {', 'Should create function with custom name');
      assertStringIncludes(scriptContent, 'deno run --allow-all main.ts', 'Should use custom command in function');
    } finally {
      if (originalShell) {
        Deno.env.set('SHELL', originalShell);
      } else {
        Deno.env.delete('SHELL');
      }
    }
  } finally {
    await tempHome.cleanup();
  }
});
