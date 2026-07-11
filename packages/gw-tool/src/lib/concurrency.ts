/**
 * Concurrency utilities
 * Run async tasks over a collection with a bounded number in flight.
 */

/**
 * Default maximum number of async operations to run at once.
 *
 * Each cleanup task spawns one or more git subprocesses, so an unbounded
 * `Promise.all` over many worktrees could launch dozens of processes at once
 * and exhaust memory or file descriptors. This cap keeps resource usage
 * predictable while still parallelising the work.
 */
export const DEFAULT_CONCURRENCY = 25;

/**
 * Map over `items` running `mapper` with at most `limit` promises in flight at
 * any time. Results are returned in the same order as the input, exactly like
 * `Promise.all(items.map(mapper))` — the only difference is the bounded number
 * of concurrent tasks.
 *
 * @param items The collection to map over
 * @param mapper Async function applied to each item (receives item and index)
 * @param limit Maximum number of concurrent tasks (default: DEFAULT_CONCURRENCY)
 * @returns Results in the same order as `items`
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<R>,
  limit = DEFAULT_CONCURRENCY
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  };

  // Never spawn more workers than there are items, and always at least one.
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
