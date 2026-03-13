/**
 * Utilities for temporarily modifying environment during tests
 */

import type { EnvGetter } from '../lib/types.ts';

/**
 * Mock environment that doesn't modify Deno.env
 * For parallel-safe testing - each test gets its own isolated env
 */
export class MockEnv implements EnvGetter {
  private env: Map<string, string>;

  /**
   * Create a mock environment
   * @param initial Initial environment values (defaults to empty)
   */
  constructor(initial: Record<string, string> = {}) {
    this.env = new Map(Object.entries(initial));
  }

  /**
   * Get an environment variable
   */
  get(key: string): string | undefined {
    return this.env.get(key);
  }

  /**
   * Set an environment variable
   */
  set(key: string, value: string): void {
    this.env.set(key, value);
  }

  /**
   * Delete an environment variable
   */
  delete(key: string): void {
    this.env.delete(key);
  }

  /**
   * Create a MockEnv pre-populated with real Deno.env values
   * Useful for tests that need real env values as a starting point
   */
  static fromDeno(...keys: string[]): MockEnv {
    const initial: Record<string, string> = {};
    for (const key of keys) {
      const value = Deno.env.get(key);
      if (value !== undefined) {
        initial[key] = value;
      }
    }
    return new MockEnv(initial);
  }
}

/**
 * Save and restore environment variables for tests
 * NOTE: This modifies global Deno.env - NOT parallel-safe!
 * Use MockEnv for parallel-safe testing instead.
 */
export class TempEnv {
  private savedEnv: Map<string, string | undefined> = new Map();

  /**
   * Set an environment variable (saves old value)
   */
  set(key: string, value: string): void {
    if (!this.savedEnv.has(key)) {
      this.savedEnv.set(key, Deno.env.get(key));
    }
    Deno.env.set(key, value);
  }

  /**
   * Delete an environment variable (saves old value)
   */
  delete(key: string): void {
    if (!this.savedEnv.has(key)) {
      this.savedEnv.set(key, Deno.env.get(key));
    }
    Deno.env.delete(key);
  }

  /**
   * Restore all saved environment variables
   */
  restore(): void {
    for (const [key, value] of this.savedEnv) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
    this.savedEnv.clear();
  }
}

/**
 * Change working directory temporarily
 */
export class TempCwd {
  private originalCwd: string;

  constructor(newCwd: string) {
    this.originalCwd = Deno.cwd();
    Deno.chdir(newCwd);
  }

  /**
   * Restore original working directory
   */
  restore(): void {
    Deno.chdir(this.originalCwd);
  }

  /**
   * Get the original working directory
   */
  getOriginal(): string {
    return this.originalCwd;
  }
}

/**
 * Create a temporary HOME directory for testing shell integration
 */
export class TempHome {
  public path: string;
  private originalHome: string | undefined;

  constructor() {
    // Create temp directory for HOME
    this.path = Deno.makeTempDirSync({ prefix: 'gw-test-home-' });

    // Save and set HOME
    this.originalHome = Deno.env.get('HOME');
    Deno.env.set('HOME', this.path);
  }

  /**
   * Restore original HOME and clean up temp directory
   */
  async cleanup(): Promise<void> {
    // Restore original HOME
    if (this.originalHome) {
      Deno.env.set('HOME', this.originalHome);
    } else {
      Deno.env.delete('HOME');
    }

    // Clean up temp directory
    try {
      await Deno.remove(this.path, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Restore original HOME without cleanup (synchronous)
   */
  restore(): void {
    if (this.originalHome) {
      Deno.env.set('HOME', this.originalHome);
    } else {
      Deno.env.delete('HOME');
    }
  }
}
