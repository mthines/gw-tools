/**
 * Utility for mocking Deno.exit() in tests
 */

/**
 * Error thrown when mocked Deno.exit() is called
 */
export class MockExitError extends Error {
  constructor(public exitCode: number) {
    super(`Deno.exit(${exitCode}) was called`);
    this.name = 'MockExitError';
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
 * Options for withMockedExit
 */
export interface MockedExitOptions {
  captureOutput?: boolean;
}

/**
 * Run a function with Deno.exit() mocked
 * Returns the exit code if exit was called, or undefined if it wasn't
 */
export async function withMockedExit<T>(
  fn: () => Promise<T>,
  options?: MockedExitOptions
): Promise<{ result?: T; exitCode?: number; stdout?: string; stderr?: string }> {
  const restore = mockExit();

  let stdout = '';
  let stderr = '';
  let originalStdoutWrite: typeof Deno.stdout.write | undefined;
  let originalStderrWrite: typeof Deno.stderr.write | undefined;
  let originalConsoleLog: typeof console.log | undefined;
  let originalConsoleError: typeof console.error | undefined;

  if (options?.captureOutput) {
    // Capture stdout
    originalStdoutWrite = Deno.stdout.write;
    // @ts-ignore - Intentionally replacing for testing
    Deno.stdout.write = (p: Uint8Array): Promise<number> => {
      stdout += new TextDecoder().decode(p);
      return Promise.resolve(p.length);
    };

    // Capture stderr
    originalStderrWrite = Deno.stderr.write;
    // @ts-ignore - Intentionally replacing for testing
    Deno.stderr.write = (p: Uint8Array): Promise<number> => {
      stderr += new TextDecoder().decode(p);
      return Promise.resolve(p.length);
    };

    // Capture console.log
    originalConsoleLog = console.log;
    console.log = (...args: unknown[]) => {
      stdout += args.map((a) => String(a)).join(' ') + '\n';
    };

    // Capture console.error
    originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      stderr += args.map((a) => String(a)).join(' ') + '\n';
    };
  }

  const restoreOutput = () => {
    if (originalStdoutWrite) {
      Deno.stdout.write = originalStdoutWrite;
    }
    if (originalStderrWrite) {
      Deno.stderr.write = originalStderrWrite;
    }
    if (originalConsoleLog) {
      console.log = originalConsoleLog;
    }
    if (originalConsoleError) {
      console.error = originalConsoleError;
    }
  };

  try {
    const result = await fn();
    restore();
    restoreOutput();
    return { result, stdout, stderr };
  } catch (error) {
    restore();
    restoreOutput();
    if (error instanceof MockExitError) {
      return { exitCode: error.exitCode, stdout, stderr };
    }
    throw error;
  }
}
