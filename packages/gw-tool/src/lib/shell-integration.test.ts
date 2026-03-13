/**
 * Tests for shell-integration.ts
 */

import { assertEquals } from '@std/assert';
import { join } from '@std/path';
import { isShellIntegrationInstalled } from './shell-integration.ts';
import { TempEnv } from '../test-utils/temp-env.ts';

Deno.test('isShellIntegrationInstalled - returns false when HOME not set', async () => {
  const tempEnv = new TempEnv();
  tempEnv.delete('HOME');
  tempEnv.delete('USERPROFILE');
  tempEnv.set('SHELL', '/bin/zsh');

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, false);
  } finally {
    tempEnv.restore();
  }
});

Deno.test('isShellIntegrationInstalled - returns false for unsupported shell', async () => {
  const tempEnv = new TempEnv();
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  tempEnv.set('HOME', tempDir);
  tempEnv.set('SHELL', '/bin/csh');

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, false);
  } finally {
    tempEnv.restore();
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects eval-based format in .zshrc', async () => {
  const tempEnv = new TempEnv();
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  tempEnv.set('HOME', tempDir);
  tempEnv.set('SHELL', '/bin/zsh');

  // Create .zshrc with eval-based format
  await Deno.writeTextFile(join(tempDir, '.zshrc'), 'eval "$(gw install-shell)"\n');

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, true);
  } finally {
    tempEnv.restore();
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects eval-based format in .bashrc', async () => {
  const tempEnv = new TempEnv();
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  tempEnv.set('HOME', tempDir);
  tempEnv.set('SHELL', '/bin/bash');

  // Create .bashrc with eval-based format
  await Deno.writeTextFile(join(tempDir, '.bashrc'), 'eval "$(gw install-shell)"\n');

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, true);
  } finally {
    tempEnv.restore();
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects fish source format', async () => {
  const tempEnv = new TempEnv();
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  tempEnv.set('HOME', tempDir);
  tempEnv.set('SHELL', '/usr/bin/fish');

  // Create fish config with source format
  const fishConfigDir = join(tempDir, '.config', 'fish');
  await Deno.mkdir(fishConfigDir, { recursive: true });
  await Deno.writeTextFile(join(fishConfigDir, 'config.fish'), 'gw install-shell | source\n');

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, true);
  } finally {
    tempEnv.restore();
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects legacy zsh integration file', async () => {
  const tempEnv = new TempEnv();
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  tempEnv.set('HOME', tempDir);
  tempEnv.set('SHELL', '/bin/zsh');

  // Create legacy integration file (without eval line in .zshrc)
  const legacyDir = join(tempDir, '.gw', 'shell');
  await Deno.mkdir(legacyDir, { recursive: true });
  await Deno.writeTextFile(join(legacyDir, 'integration.zsh'), '# legacy gw function\n');

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, true);
  } finally {
    tempEnv.restore();
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects legacy bash integration file', async () => {
  const tempEnv = new TempEnv();
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  tempEnv.set('HOME', tempDir);
  tempEnv.set('SHELL', '/bin/bash');

  // Create legacy integration file
  const legacyDir = join(tempDir, '.gw', 'shell');
  await Deno.mkdir(legacyDir, { recursive: true });
  await Deno.writeTextFile(join(legacyDir, 'integration.bash'), '# legacy gw function\n');

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, true);
  } finally {
    tempEnv.restore();
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - detects legacy fish function file', async () => {
  const tempEnv = new TempEnv();
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  tempEnv.set('HOME', tempDir);
  tempEnv.set('SHELL', '/usr/bin/fish');

  // Create legacy fish function file
  const fishFuncDir = join(tempDir, '.config', 'fish', 'functions');
  await Deno.mkdir(fishFuncDir, { recursive: true });
  await Deno.writeTextFile(join(fishFuncDir, 'gw.fish'), '# legacy gw function\n');

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, true);
  } finally {
    tempEnv.restore();
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - returns false when no integration exists', async () => {
  const tempEnv = new TempEnv();
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  tempEnv.set('HOME', tempDir);
  tempEnv.set('SHELL', '/bin/zsh');

  // Create empty .zshrc (no integration)
  await Deno.writeTextFile(join(tempDir, '.zshrc'), '# empty config\n');

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, false);
  } finally {
    tempEnv.restore();
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test('isShellIntegrationInstalled - returns false when config file missing', async () => {
  const tempEnv = new TempEnv();
  const tempDir = await Deno.makeTempDir({ prefix: 'gw-shell-test-' });

  tempEnv.set('HOME', tempDir);
  tempEnv.set('SHELL', '/bin/zsh');

  // Don't create any files

  try {
    const result = await isShellIntegrationInstalled();
    assertEquals(result, false);
  } finally {
    tempEnv.restore();
    await Deno.remove(tempDir, { recursive: true });
  }
});
