/**
 * Options for retry function
 */
export interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  retries?: number;
  /** Initial delay in ms (default: 1000) */
  delay?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  /** Exponential backoff factor (default: 2) */
  factor?: number;
  /** Callback on each retry */
  onRetry?: (error: Error, attempt: number, nextDelay: number) => void;
  /** Function to determine if should retry */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Options for retry with timeout
 */
export interface RetryWithTimeoutOptions extends RetryOptions {
  /** Timeout in milliseconds for each attempt */
  timeout?: number;
  /** Custom timeout error message */
  timeoutMessage?: string;
}

/**
 * Timeout error class
 */
export class TimeoutError extends Error {
  code = 'TIMEOUT';

  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry failed async functions with exponential backoff
 */
export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    delay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry = () => {
      return;
    },
    shouldRetry = () => true,
  } = options;

  let lastError: Error | undefined;
  let currentDelay = delay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (attempt === retries || !shouldRetry(lastError, attempt)) {
        throw error;
      }

      // Call onRetry callback
      onRetry(lastError, attempt, currentDelay);

      // Wait before retrying
      await sleep(currentDelay);

      // Calculate next delay with exponential backoff
      currentDelay = Math.min(currentDelay * factor, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Create a reusable retry wrapper with preset options
 */
export function createRetry(defaultOptions: RetryOptions = {}) {
  return <T>(
    fn: (attempt: number) => Promise<T>,
    overrides: RetryOptions = {}
  ): Promise<T> => {
    return retry(fn, { ...defaultOptions, ...overrides });
  };
}

/**
 * Wrap a function to always retry on failure
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    return retry(() => fn(...args), options);
  }) as T;
}

/**
 * Execute multiple async operations with individual retry logic
 */
export async function retryAll<T>(
  fns: Array<(attempt: number) => Promise<T>>,
  options: RetryOptions = {}
): Promise<T[]> {
  return Promise.all(fns.map((fn) => retry(fn, options)));
}

/**
 * Execute multiple async operations, returning first successful result
 */
export async function retryRace<T>(
  fns: Array<(attempt: number) => Promise<T>>,
  options: RetryOptions = {}
): Promise<T> {
  return Promise.race(fns.map((fn) => retry(fn, options)));
}

/**
 * Execute multiple async operations, returning all results (including errors)
 */
export async function retryAllSettled<T>(
  fns: Array<(attempt: number) => Promise<T>>,
  options: RetryOptions = {}
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(fns.map((fn) => retry(fn, options)));
}
