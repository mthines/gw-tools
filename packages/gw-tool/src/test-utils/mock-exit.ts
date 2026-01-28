/**
 * Utility for mocking Deno.exit() in tests
 */

/**
 * Error thrown when mocked Deno.exit() is called
 */
export class MockExitError extends Error {
  constructor(public exitCode: number) {
    super(`Deno.exit(${exitCode}) was called`);
    this.name = "MockExitError";
  }
}

/**
 * Temporarily mock Deno.exit() to throw an error instead of exiting
 * Returns a restore function to unmock
 */
export function mockExit(): () => void {
  const originalExit = Deno.exit;

  // Replace Deno.exit with a function that throws
  // @ts-ignore - Intentionally replacing for testing
  Deno.exit = (code?: number) => {
    throw new MockExitError(code ?? 0);
  };

  // Return restore function
  return () => {
    Deno.exit = originalExit;
  };
}

/**
 * Run a function with Deno.exit() mocked
 * Returns the exit code if exit was called, or undefined if it wasn't
 */
export async function withMockedExit<T>(
  fn: () => Promise<T>,
): Promise<{ result?: T; exitCode?: number }> {
  const restore = mockExit();

  try {
    const result = await fn();
    restore();
    return { result };
  } catch (error) {
    restore();
    if (error instanceof MockExitError) {
      return { exitCode: error.exitCode };
    }
    throw error;
  }
}
