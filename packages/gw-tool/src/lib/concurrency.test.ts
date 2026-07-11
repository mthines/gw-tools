/**
 * Tests for concurrency.ts
 */

import { assertEquals } from '@std/assert';
import { DEFAULT_CONCURRENCY, mapWithConcurrency } from './concurrency.ts';

Deno.test('mapWithConcurrency - preserves input order', async () => {
  const items = [1, 2, 3, 4, 5];
  const result = await mapWithConcurrency(items, (n) => Promise.resolve(n * 2), 2);
  assertEquals(result, [2, 4, 6, 8, 10]);
});

Deno.test('mapWithConcurrency - passes the index to the mapper', async () => {
  const items = ['a', 'b', 'c'];
  const result = await mapWithConcurrency(items, (item, index) => Promise.resolve(`${index}:${item}`), 2);
  assertEquals(result, ['0:a', '1:b', '2:c']);
});

Deno.test('mapWithConcurrency - returns empty array for empty input', async () => {
  const result = await mapWithConcurrency([], (n) => Promise.resolve(n), 4);
  assertEquals(result, []);
});

Deno.test('mapWithConcurrency - never exceeds the concurrency limit', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const items = Array.from({ length: 50 }, (_, i) => i);

  await mapWithConcurrency(
    items,
    async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // Yield to let other tasks start before this one resolves.
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return n;
    },
    5
  );

  assertEquals(maxInFlight <= 5, true, `maxInFlight was ${maxInFlight}, expected <= 5`);
});

Deno.test('mapWithConcurrency - processes all items when limit exceeds length', async () => {
  const items = [1, 2, 3];
  const result = await mapWithConcurrency(items, (n) => Promise.resolve(n + 1), 100);
  assertEquals(result, [2, 3, 4]);
});

Deno.test('mapWithConcurrency - runs all items even with a limit of 1 (sequential)', async () => {
  const order: number[] = [];
  const items = [3, 1, 2];
  const result = await mapWithConcurrency(
    items,
    async (n) => {
      await new Promise((resolve) => setTimeout(resolve, n));
      order.push(n);
      return n;
    },
    1
  );
  // With limit 1 tasks run strictly in input order regardless of duration.
  assertEquals(order, [3, 1, 2]);
  assertEquals(result, [3, 1, 2]);
});

Deno.test('mapWithConcurrency - defaults to DEFAULT_CONCURRENCY', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const items = Array.from({ length: 30 }, (_, i) => i);

  await mapWithConcurrency(items, async (n) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight--;
    return n;
  });

  assertEquals(maxInFlight <= DEFAULT_CONCURRENCY, true, `maxInFlight was ${maxInFlight}`);
});
