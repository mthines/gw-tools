/**
 * Tests for install-shell command
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { join } from '@std/path';
import { executeInstallShell } from './install-shell.ts';
import { TempHome } from '../test-utils/temp-env.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';

Deno.test('install-shell - outputs zsh shell function to stdout', async () => {
  const originalShell = Deno.env.get('SHELL');
  Deno.env.set('SHELL', '/bin/zsh');

  try {
    const { stdout } = await withMockedExit(() => executeInstallShell([]), { captureOutput: true });

    assertStringIncludes(stdout || '', 'gw() {', 'Should output gw function');
    assertStringIncludes(stdout || '', 'if [[ "$1" == "cd" ]];', 'Should handle cd command');
    assertStringIncludes(stdout || '', '# gw-tools shell integration', 'Should include integration comment');
  } finally {
    if (originalShell) {
      Deno.env.set('SHELL', originalShell);
    } else {
      Deno.env.delete('SHELL');
    }
  }
});

Deno.test('install-shell - outputs bash shell function to stdout', async () => {
  const originalShell = Deno.env.get('SHELL');
  Deno.env.set('SHELL', '/bin/bash');

  try {
    const { stdout } = await withMockedExit(() => executeInstallShell([]), { captureOutput: true });

    assertStringIncludes(stdout || '', 'gw() {', 'Should output gw function');
    assertStringIncludes(stdout || '', 'if [[ "$1" == "cd" ]];', 'Should handle cd command');
  } finally {
    if (originalShell) {
      Deno.env.set('SHELL', originalShell);
    } else {
      Deno.env.delete('SHELL');
    }
  }
});

Deno.test('install-shell - outputs fish shell function to stdout', async () => {
  const originalShell = Deno.env.get('SHELL');
  Deno.env.set('SHELL', '/usr/local/bin/fish');

  try {
    const { stdout } = await withMockedExit(() => executeInstallShell([]), { captureOutput: true });

    assertStringIncludes(stdout || '', 'function gw', 'Should output fish gw function');
    assertStringIncludes(stdout || '', 'if test "$argv[1]" = "cd"', 'Should handle cd command in fish');
  } finally {
    if (originalShell) {
      Deno.env.set('SHELL', originalShell);
    } else {
      Deno.env.delete('SHELL');
    }
  }
});

Deno.test('install-shell - exits with error for unsupported shell', async () => {
  const originalShell = Deno.env.get('SHELL');
  Deno.env.set('SHELL', '/bin/sh');

  try {
    const { exitCode, stdout, stderr } = await withMockedExit(() => executeInstallShell([]), { captureOutput: true });

    assertEquals(exitCode, 1, 'Should exit with error code 1');
    const combinedOutput = (stdout || '') + (stderr || '');
    assertStringIncludes(combinedOutput, 'Unsupported shell: sh', 'Should show which shell is unsupported');
    assertStringIncludes(combinedOutput, 'Supported shells: zsh, bash, fish', 'Should list supported shells');
  } finally {
    if (originalShell) {
      Deno.env.set('SHELL', originalShell);
    } else {
      Deno.env.delete('SHELL');
    }
  }
});

Deno.test('install-shell - does not require HOME for default mode', async () => {
  const originalShell = Deno.env.get('SHELL');
  const originalHome = Deno.env.get('HOME');
  Deno.env.set('SHELL', '/bin/zsh');
  Deno.env.delete('HOME');

  try {
    // Should succeed without HOME since we're just outputting to stdout
    const { stdout, exitCode } = await withMockedExit(() => executeInstallShell([]), { captureOutput: true });

    assertEquals(exitCode, undefined, 'Should not exit with error');
    assertStringIncludes(stdout || '', 'gw() {', 'Should output gw function');
  } finally {
    if (originalShell) {
      Deno.env.set('SHELL', originalShell);
    } else {
      Deno.env.delete('SHELL');
    }
    if (originalHome) {
      Deno.env.set('HOME', originalHome);
    }
  }
});

Deno.test('install-shell - --remove exits with error when HOME is not set', async () => {
  const tempHome = new TempHome();
  try {
    const originalHome = Deno.env.get('HOME');
    Deno.env.delete('HOME');

    try {
      const { exitCode, stdout, stderr } = await withMockedExit(() => executeInstallShell(['--remove']), {
        captureOutput: true,
      });

      assertEquals(exitCode, 1, 'Should exit with error code 1');
      const combinedOutput = (stdout || '') + (stderr || '');
      assertStringIncludes(combinedOutput, 'HOME environment variable is not set');
    } finally {
      if (originalHome) {
        Deno.env.set('HOME', originalHome);
      }
    }
  } finally {
    tempHome.restore();
  }
});

Deno.test('install-shell - removes legacy file-based integration with --remove', async () => {
  const tempHome = new TempHome();
  try {
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/bin/zsh');

    try {
      // Set up legacy integration files
      const shellDir = join(tempHome.path, '.gw', 'shell');
      await Deno.mkdir(shellDir, { recursive: true });
      await Deno.writeTextFile(join(shellDir, 'integration.zsh'), '# gw-tools shell integration\ngw() { ... }');

      // Set up .zshrc with legacy source line
      const zshrcPath = join(tempHome.path, '.zshrc');
      await Deno.writeTextFile(
        zshrcPath,
        'export PATH="/usr/local/bin:$PATH"\n# gw-tools shell integration (gw)\n[ -f ~/.gw/shell/integration.zsh ] && source ~/.gw/shell/integration.zsh\n'
      );

      // Run remove
      await executeInstallShell(['--remove']);

      // Verify legacy script file was removed
      let scriptExists = false;
      try {
        await Deno.stat(join(shellDir, 'integration.zsh'));
        scriptExists = true;
      } catch {
        // Expected
      }
      assertEquals(scriptExists, false, 'Should delete legacy integration script');

      // Verify source line was removed from .zshrc
      const content = await Deno.readTextFile(zshrcPath);
      assertEquals(content.includes('gw-tools shell integration'), false, 'Should remove integration comment');
      assertEquals(content.includes('source ~/.gw/shell/integration'), false, 'Should remove source line');
      assertStringIncludes(content, 'export PATH', 'Should keep other content');
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

Deno.test('install-shell - removes eval-based integration with --remove', async () => {
  const tempHome = new TempHome();
  try {
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/bin/zsh');

    try {
      // Set up .zshrc with eval line
      const zshrcPath = join(tempHome.path, '.zshrc');
      await Deno.writeTextFile(
        zshrcPath,
        'export PATH="/usr/local/bin:$PATH"\neval "$(gw install-shell)"\nexport EDITOR=vim\n'
      );

      // Run remove
      await executeInstallShell(['--remove']);

      // Verify eval line was removed
      const content = await Deno.readTextFile(zshrcPath);
      assertEquals(content.includes('gw install-shell'), false, 'Should remove eval line');
      assertStringIncludes(content, 'export PATH', 'Should keep other content');
      assertStringIncludes(content, 'export EDITOR', 'Should keep other content');
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

Deno.test('install-shell - outputs custom command name function', async () => {
  const originalShell = Deno.env.get('SHELL');
  Deno.env.set('SHELL', '/bin/zsh');

  try {
    const { stdout } = await withMockedExit(
      () => executeInstallShell(['--name', 'gw-dev', '--command', 'deno run --allow-all main.ts']),
      { captureOutput: true }
    );

    assertStringIncludes(stdout || '', 'gw-dev() {', 'Should create function with custom name');
    assertStringIncludes(stdout || '', 'deno run --allow-all main.ts', 'Should use custom command');
  } finally {
    if (originalShell) {
      Deno.env.set('SHELL', originalShell);
    } else {
      Deno.env.delete('SHELL');
    }
  }
});

Deno.test('install-shell - removes fish integration with --remove', async () => {
  const tempHome = new TempHome();
  try {
    const originalShell = Deno.env.get('SHELL');
    Deno.env.set('SHELL', '/usr/local/bin/fish');

    try {
      // Set up legacy fish function file
      const fishFuncDir = join(tempHome.path, '.config', 'fish', 'functions');
      await Deno.mkdir(fishFuncDir, { recursive: true });
      await Deno.writeTextFile(join(fishFuncDir, 'gw.fish'), '# gw-tools shell integration\nfunction gw\nend');

      // Set up config.fish with eval line
      const configFishPath = join(tempHome.path, '.config', 'fish', 'config.fish');
      await Deno.writeTextFile(configFishPath, 'set -x PATH /usr/local/bin $PATH\ngw install-shell | source\n');

      // Run remove
      await executeInstallShell(['--remove']);

      // Verify fish function file was removed
      let funcExists = false;
      try {
        await Deno.stat(join(fishFuncDir, 'gw.fish'));
        funcExists = true;
      } catch {
        // Expected
      }
      assertEquals(funcExists, false, 'Should delete legacy fish function file');

      // Verify eval line was removed from config.fish
      const content = await Deno.readTextFile(configFishPath);
      assertEquals(content.includes('gw install-shell'), false, 'Should remove source line');
      assertStringIncludes(content, 'set -x PATH', 'Should keep other content');
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
