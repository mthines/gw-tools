/**
 * Utilities for temporarily modifying environment during tests
 */

import { join } from '$std/path';

/**
 * Save and restore environment variables for tests
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
