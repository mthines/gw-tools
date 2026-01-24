import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  retry,
  createRetry,
  withRetry,
  retryAll,
  retryRace,
  retryAllSettled,
  TimeoutError,
} from './async-retry.js';

describe('async-retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('retry', () => {
    it('should return result on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(0);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const promise = retry(fn, { retries: 3, delay: 100 });

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Wait for first retry
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);

      // Wait for second retry
      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should provide attempt number to function', async () => {
      const fn = vi.fn((attempt: number) => {
        if (attempt < 2) throw new Error('fail');
        return Promise.resolve(`success on attempt ${attempt}`);
      });

      const promise = retry(fn, { retries: 3, delay: 100 });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;
      expect(result).toBe('success on attempt 2');
      expect(fn).toHaveBeenCalledWith(0);
      expect(fn).toHaveBeenCalledWith(1);
      expect(fn).toHaveBeenCalledWith(2);
    });
  });

  describe('createRetry', () => {
    it('should create a reusable retry function with default options', async () => {
      const retryWithDefaults = createRetry({ retries: 2, delay: 50 });

      const fn1 = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success1');

      const fn2 = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success2');

      const promise1 = retryWithDefaults(fn1);
      const promise2 = retryWithDefaults(fn2);

      await vi.advanceTimersByTimeAsync(50);

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('success1');
      expect(result2).toBe('success2');
    });

    it('should allow overriding default options', async () => {
      const retryWithDefaults = createRetry({ retries: 2, delay: 100 });

      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = retryWithDefaults(fn, { delay: 50 });

      await vi.advanceTimersByTimeAsync(50);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('withRetry', () => {
    it('should wrap a function to automatically retry', async () => {
      const originalFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const wrappedFn = withRetry(originalFn, { retries: 2, delay: 50 });

      const promise = wrappedFn();
      await vi.advanceTimersByTimeAsync(50);

      const result = await promise;
      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });

    it('should preserve function parameters', async () => {
      const originalFn = vi.fn(async (a: number, b: string) => `${a}-${b}`);
      const wrappedFn = withRetry(originalFn);

      const result = await wrappedFn(42, 'test');
      expect(result).toBe('42-test');
      expect(originalFn).toHaveBeenCalledWith(42, 'test');
    });
  });

  describe('retryAll', () => {
    it('should retry all functions and return all results', async () => {
      const fn1 = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('result1');

      const fn2 = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('result2');

      const fn3 = vi.fn().mockResolvedValue('result3');

      const promise = retryAll([fn1, fn2, fn3], { retries: 2, delay: 50 });

      await vi.advanceTimersByTimeAsync(50);

      const results = await promise;
      expect(results).toEqual(['result1', 'result2', 'result3']);
    });
  });

  describe('retryRace', () => {
    it('should return the first successful result', async () => {
      const fn1 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'slow';
      });

      const fn2 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'fast';
      });

      const promise = retryRace([fn1, fn2]);

      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;
      expect(result).toBe('fast');
    });

    it('should retry failed functions in race', async () => {
      const fn1 = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'retry-success';
        });

      const fn2 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'slow';
      });

      const promise = retryRace([fn1, fn2], { retries: 2, delay: 50 });

      await vi.advanceTimersByTimeAsync(50); // retry delay
      await vi.advanceTimersByTimeAsync(100); // fn1 completes

      const result = await promise;
      expect(result).toBe('retry-success');
    });
  });

  describe('retryAllSettled', () => {
    it('should retry before settling', async () => {
      const fn1 = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('retry-success');

      const fn2 = vi.fn().mockRejectedValue(new Error('persistent-fail'));

      const promise = retryAllSettled([fn1, fn2], { retries: 1, delay: 50 });

      await vi.advanceTimersByTimeAsync(50);

      const results = await promise;
      expect(results[0]).toEqual({
        status: 'fulfilled',
        value: 'retry-success',
      });
      expect(results[1]).toEqual({
        status: 'rejected',
        reason: expect.objectContaining({ message: 'persistent-fail' }),
      });
    });

    // INTENTIONAL FAILURE: This test is designed to fail for CI demo purposes
    // It demonstrates Nx's self-healing CI feature (nx fix-ci)
    // it('[CI DEMO] should demonstrate self-healing CI with intentional failure', () => {
    //   // This test intentionally fails to showcase how nx fix-ci works
    //   expect(true).toBe(false); // This will always fail

    //   // In a real scenario, nx fix-ci would:
    //   // 1. Detect this failure
    //   // 2. Analyze the error pattern
    //   // 3. Suggest or apply appropriate fixes
    //   // 4. Help maintain CI pipeline health
    // });
  });

  describe('TimeoutError', () => {
    it('should have correct properties', () => {
      const error = new TimeoutError('Custom message');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.message).toBe('Custom message');
      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe('TIMEOUT');
    });

    it('should have default message', () => {
      const error = new TimeoutError();
      expect(error.message).toBe('Operation timed out');
    });
  });
});
