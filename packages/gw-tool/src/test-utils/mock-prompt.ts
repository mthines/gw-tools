/**
 * Utility for mocking prompt() in tests
 */

/**
 * Mock prompt function that returns pre-configured responses
 */
export function mockPrompt(responses: (string | null)[]): () => void {
  const originalPrompt = globalThis.prompt;
  let callIndex = 0;

  // Replace prompt with a function that returns pre-configured responses
  // @ts-ignore - Intentionally replacing for testing
  globalThis.prompt = (_message?: string, _defaultValue?: string): string | null => {
    if (callIndex >= responses.length) {
      throw new Error(`Mock prompt called more times than expected. Call ${callIndex + 1}, message: ${_message}`);
    }
    const response = responses[callIndex++];
    return response;
  };

  // Return restore function
  return () => {
    globalThis.prompt = originalPrompt;
  };
}

/**
 * Run a function with prompt() mocked
 */
export async function withMockedPrompt<T>(responses: (string | null)[], fn: () => Promise<T>): Promise<T> {
  const restore = mockPrompt(responses);

  try {
    const result = await fn();
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}
