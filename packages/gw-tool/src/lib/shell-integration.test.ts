/**
 * Tests for shell-integration.ts
 */

import { assertEquals } from '$std/assert';
import { join } from '$std/path';
import { isShellIntegrationInstalled } from './shell-integration.ts';
import { MockEnv } from '../test-utils/temp-env.ts';

Deno.test('isShellIntegrationInstalled - returns false when HOME not set', async () => {
  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    SHELL: '/bin/zsh',
    // HOME and USERPROFILE intentionally not set
  });

  const result = await isShellIntegrationInstalled(mockEnv);
  assertEquals(result, false);
});

Deno.test('isShellIntegrationInstalled - returns false for unsupported shell', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    HOME: tempDir,
    SHELL: '/bin/csh',
  });

  try {
    const result = await isShellIntegrationInstalled(mockEnv);
    assertEquals(result, false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects eval-based format in .zshrc', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    HOME: tempDir,
    SHELL: '/bin/zsh',
  });

  // Create .zshrc with eval-based format
  await Deno.writeTextFile(join(tempDir, '.zshrc'), 'eval "$(gw install-shell)"\n');

  try {
    const result = await isShellIntegrationInstalled(mockEnv);
    assertEquals(result, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects eval-based format in .bashrc', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    HOME: tempDir,
    SHELL: '/bin/bash',
  });

  // Create .bashrc with eval-based format
  await Deno.writeTextFile(join(tempDir, '.bashrc'), 'eval "$(gw install-shell)"\n');

  try {
    const result = await isShellIntegrationInstalled(mockEnv);
    assertEquals(result, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects fish source format', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    HOME: tempDir,
    SHELL: '/usr/bin/fish',
  });

  // Create fish config with source format
  const fishConfigDir = join(tempDir, '.config', 'fish');
  await Deno.mkdir(fishConfigDir, { recursive: true });
  await Deno.writeTextFile(join(fishConfigDir, 'config.fish'), 'gw install-shell | source\n');

  try {
    const result = await isShellIntegrationInstalled(mockEnv);
    assertEquals(result, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects legacy zsh integration file', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    HOME: tempDir,
    SHELL: '/bin/zsh',
  });

  // Create legacy integration file (without eval line in .zshrc)
  const legacyDir = join(tempDir, '.gw', 'shell');
  await Deno.mkdir(legacyDir, { recursive: true });
  await Deno.writeTextFile(join(legacyDir, 'integration.zsh'), '# legacy gw function\n');

  try {
    const result = await isShellIntegrationInstalled(mockEnv);
    assertEquals(result, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects legacy bash integration file', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    HOME: tempDir,
    SHELL: '/bin/bash',
  });

  // Create legacy integration file
  const legacyDir = join(tempDir, '.gw', 'shell');
  await Deno.mkdir(legacyDir, { recursive: true });
  await Deno.writeTextFile(join(legacyDir, 'integration.bash'), '# legacy gw function\n');

  try {
    const result = await isShellIntegrationInstalled(mockEnv);
    assertEquals(result, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects legacy fish function file', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    HOME: tempDir,
    SHELL: '/usr/bin/fish',
  });

  // Create legacy fish function file
  const fishFuncDir = join(tempDir, '.config', 'fish', 'functions');
  await Deno.mkdir(fishFuncDir, { recursive: true });
  await Deno.writeTextFile(join(fishFuncDir, 'gw.fish'), '# legacy gw function\n');

  try {
    const result = await isShellIntegrationInstalled(mockEnv);
    assertEquals(result, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - returns false when no integration exists', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    HOME: tempDir,
    SHELL: '/bin/zsh',
  });

  // Create empty .zshrc (no integration)
  await Deno.writeTextFile(join(tempDir, '.zshrc'), '# empty config\n');

  try {
    const result = await isShellIntegrationInstalled(mockEnv);
    assertEquals(result, false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - returns false when config file missing', async () => {
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  // Use MockEnv instead of TempEnv (parallel-safe)
  const mockEnv = new MockEnv({
    HOME: tempDir,
    SHELL: '/bin/zsh',
  });

  // Don't create any files

  try {
    const result = await isShellIntegrationInstalled(mockEnv);
    assertEquals(result, false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
