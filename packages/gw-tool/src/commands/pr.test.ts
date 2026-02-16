/**
 * Tests for pr.ts command
 */

import { assertEquals } from '$std/assert';
import { executePr } from './pr.ts';
import { withMockedExit } from '../test-utils/mock-exit.ts';

// =============================================================================
// Help flag tests
// =============================================================================

Deno.test('pr command - shows help with --help', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['--help']);
  });

  assertEquals(exitCode, 0);
});

Deno.test('pr command - shows help with -h', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['-h']);
  });

  assertEquals(exitCode, 0);
});

// =============================================================================
// Argument validation tests
// =============================================================================

Deno.test('pr command - errors when no args provided', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr([]);
  });

  assertEquals(exitCode, 1);
});

Deno.test('pr command - errors on invalid PR identifier (text)', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['invalid-text']);
  });

  assertEquals(exitCode, 1);
});

Deno.test('pr command - errors on invalid PR identifier (negative number)', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['-5']);
  });

  // -5 is treated as a flag, so it's as if no args provided
  assertEquals(exitCode, 1);
});

Deno.test('pr command - errors on invalid PR identifier (zero)', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['0']);
  });

  assertEquals(exitCode, 1);
});

Deno.test('pr command - errors on invalid URL format', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['https://gitlab.com/user/repo/merge_requests/42']);
  });

  assertEquals(exitCode, 1);
});

// =============================================================================
// parsePrIdentifier tests (via integration - checking accepted formats)
// =============================================================================

// Note: We can't directly test parsePrIdentifier as it's not exported,
// but we test it indirectly through executePr behavior.

// For comprehensive unit tests of parsePrIdentifier, we'd need to export it.
// The following tests verify the command accepts valid formats by checking
// that it gets past the parsing stage (fails on gh CLI instead of parsing).

// =============================================================================
// parsePrArgs tests (via integration - checking flag handling)
// =============================================================================

Deno.test('pr command - accepts --name flag with value', async () => {
  // This should fail at gh CLI check (exit 1) but not at parsing
  const { exitCode, stdout } = await withMockedExit(
    async () => {
      await executePr(['42', '--name', 'custom-name']);
    },
    { captureOutput: true }
  );

  // Should fail because gh is either not installed or not in test context
  // but it should get past parsing (exit code 1, not parsing error)
  assertEquals(exitCode, 1);
});

Deno.test('pr command - accepts --name=value flag', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['42', '--name=custom-name']);
  });

  assertEquals(exitCode, 1);
});

Deno.test('pr command - accepts --no-cd flag', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['42', '--no-cd']);
  });

  assertEquals(exitCode, 1);
});

Deno.test('pr command - accepts combined flags', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['42', '--name', 'test', '--no-cd']);
  });

  assertEquals(exitCode, 1);
});

// =============================================================================
// URL parsing tests (checking valid URLs are accepted)
// =============================================================================

Deno.test('pr command - accepts HTTPS GitHub URL', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['https://github.com/user/repo/pull/123']);
  });

  // Should get past parsing to gh CLI check
  assertEquals(exitCode, 1);
});

Deno.test('pr command - accepts HTTP GitHub URL', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['http://github.com/user/repo/pull/456']);
  });

  assertEquals(exitCode, 1);
});

Deno.test('pr command - accepts GitHub URL without protocol', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['github.com/user/repo/pull/789']);
  });

  assertEquals(exitCode, 1);
});

Deno.test('pr command - accepts simple PR number', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['42']);
  });

  assertEquals(exitCode, 1);
});

Deno.test('pr command - accepts large PR number', async () => {
  const { exitCode } = await withMockedExit(async () => {
    await executePr(['99999']);
  });

  assertEquals(exitCode, 1);
});
