import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addToAutoCopyFiles } from './config-writer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gw-config-writer-'));
});

afterEach(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

async function writeConfig(content: string): Promise<string> {
  const configPath = path.join(tmpDir, 'config.json');
  await fs.promises.writeFile(configPath, content, 'utf-8');
  return configPath;
}

async function readConfig(configPath: string): Promise<string> {
  return fs.promises.readFile(configPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('addToAutoCopyFiles', () => {
  describe('adding files', () => {
    it('should add a single file to an existing multi-line array', async () => {
      const configPath = await writeConfig(JSON.stringify({ autoCopyFiles: ['.env'] }, null, 2));

      const result = await addToAutoCopyFiles(configPath, ['components/.env']);

      expect(result.added).toEqual(['components/.env']);
      expect(result.alreadyPresent).toEqual([]);

      const written = await readConfig(configPath);
      const parsed = JSON.parse(written) as { autoCopyFiles: string[] };
      expect(parsed.autoCopyFiles).toEqual(['.env', 'components/.env']);
    });

    it('should add multiple files in one call', async () => {
      const configPath = await writeConfig(JSON.stringify({ autoCopyFiles: [] }, null, 2));

      const result = await addToAutoCopyFiles(configPath, ['.env', 'secrets.json', 'config/local.json']);

      expect(result.added).toEqual(['.env', 'secrets.json', 'config/local.json']);
      expect(result.alreadyPresent).toEqual([]);

      const written = await readConfig(configPath);
      const parsed = JSON.parse(written) as { autoCopyFiles: string[] };
      expect(parsed.autoCopyFiles).toEqual(['.env', 'secrets.json', 'config/local.json']);
    });

    it('should add files in insertion order', async () => {
      const configPath = await writeConfig(JSON.stringify({ autoCopyFiles: ['a.env'] }, null, 2));

      await addToAutoCopyFiles(configPath, ['b.env', 'c.env']);

      const written = await readConfig(configPath);
      const parsed = JSON.parse(written) as { autoCopyFiles: string[] };
      expect(parsed.autoCopyFiles).toEqual(['a.env', 'b.env', 'c.env']);
    });

    it('should handle empty array []', async () => {
      const configPath = await writeConfig('{\n  "autoCopyFiles": []\n}');

      const result = await addToAutoCopyFiles(configPath, ['.env']);

      expect(result.added).toEqual(['.env']);

      const written = await readConfig(configPath);
      const parsed = JSON.parse(written) as { autoCopyFiles: string[] };
      expect(parsed.autoCopyFiles).toEqual(['.env']);
    });

    it('should handle array with trailing comma on last element', async () => {
      const configPath = await writeConfig('{\n  "autoCopyFiles": [\n    ".env",\n  ]\n}');

      const result = await addToAutoCopyFiles(configPath, ['secrets.json']);

      expect(result.added).toEqual(['secrets.json']);

      const written = await readConfig(configPath);
      // Should be valid JSON (or parseable after stripping trailing comma)
      expect(written).toContain('secrets.json');
    });
  });

  describe('duplicate handling', () => {
    it('should skip a file that is already present', async () => {
      const configPath = await writeConfig(JSON.stringify({ autoCopyFiles: ['.env', 'secrets.json'] }, null, 2));

      const result = await addToAutoCopyFiles(configPath, ['.env']);

      expect(result.added).toEqual([]);
      expect(result.alreadyPresent).toEqual(['.env']);

      // File should not have been re-written (same content)
      const written = await readConfig(configPath);
      const parsed = JSON.parse(written) as { autoCopyFiles: string[] };
      expect(parsed.autoCopyFiles).toEqual(['.env', 'secrets.json']);
    });

    it('should handle a mixed batch: some new, some duplicates', async () => {
      const configPath = await writeConfig(JSON.stringify({ autoCopyFiles: ['.env'] }, null, 2));

      const result = await addToAutoCopyFiles(configPath, ['.env', 'secrets.json', '.env.local']);

      expect(result.added).toEqual(['secrets.json', '.env.local']);
      expect(result.alreadyPresent).toEqual(['.env']);

      const written = await readConfig(configPath);
      const parsed = JSON.parse(written) as { autoCopyFiles: string[] };
      expect(parsed.autoCopyFiles).toEqual(['.env', 'secrets.json', '.env.local']);
    });

    it('should report all as alreadyPresent when all files are duplicates', async () => {
      const configPath = await writeConfig(JSON.stringify({ autoCopyFiles: ['.env', 'secrets.json'] }, null, 2));

      const result = await addToAutoCopyFiles(configPath, ['.env', 'secrets.json']);

      expect(result.added).toEqual([]);
      expect(result.alreadyPresent).toEqual(['.env', 'secrets.json']);
    });
  });

  describe('autoCopyFiles key absent', () => {
    it('should create the autoCopyFiles key when it is missing from the config', async () => {
      const configPath = await writeConfig(JSON.stringify({ configVersion: 2 }, null, 2));

      const result = await addToAutoCopyFiles(configPath, ['.env']);

      expect(result.added).toEqual(['.env']);
      expect(result.alreadyPresent).toEqual([]);

      const written = await readConfig(configPath);
      const parsed = JSON.parse(written) as { configVersion: number; autoCopyFiles: string[] };
      expect(parsed.autoCopyFiles).toEqual(['.env']);
      // Original key preserved
      expect(parsed.configVersion).toBe(2);
    });

    it('should create the autoCopyFiles key with multiple entries', async () => {
      const configPath = await writeConfig(JSON.stringify({ configVersion: 1 }, null, 2));

      const result = await addToAutoCopyFiles(configPath, ['.env', 'secrets.json']);

      expect(result.added).toEqual(['.env', 'secrets.json']);

      const written = await readConfig(configPath);
      const parsed = JSON.parse(written) as { autoCopyFiles: string[] };
      expect(parsed.autoCopyFiles).toEqual(['.env', 'secrets.json']);
    });
  });

  describe('JSONC comment preservation', () => {
    it('should preserve top-level JSONC comments after mutation', async () => {
      const jsoncContent = `{
  // This is a comment about auto-copy files
  "autoCopyFiles": [
    ".env"
  ]
}`;
      const configPath = await writeConfig(jsoncContent);

      await addToAutoCopyFiles(configPath, ['secrets.json']);

      const written = await readConfig(configPath);
      expect(written).toContain('// This is a comment about auto-copy files');
      expect(written).toContain('secrets.json');
    });

    it('should preserve inline comments between array elements', async () => {
      const jsoncContent = `{
  "autoCopyFiles": [
    ".env" // keep this secret
  ]
}`;
      const configPath = await writeConfig(jsoncContent);

      await addToAutoCopyFiles(configPath, ['secrets.json']);

      const written = await readConfig(configPath);
      expect(written).toContain('// keep this secret');
      expect(written).toContain('secrets.json');
    });

    it('should not treat a commented-out path as already present', async () => {
      const jsoncContent = `{
  "autoCopyFiles": [
    ".env" // ".env.local" is also a good idea
  ]
}`;
      const configPath = await writeConfig(jsoncContent);

      // ".env.local" appears only in a comment — should be treated as new
      const result = await addToAutoCopyFiles(configPath, ['.env.local']);

      expect(result.added).toEqual(['.env.local']);
      expect(result.alreadyPresent).toEqual([]);
    });

    it('should preserve indentation style', async () => {
      // Tab-indented config
      const jsoncContent = `{\n\t"autoCopyFiles": [\n\t\t".env"\n\t]\n}`;
      const configPath = await writeConfig(jsoncContent);

      await addToAutoCopyFiles(configPath, ['secrets.json']);

      const written = await readConfig(configPath);
      // New entry should use detected tab indentation
      expect(written).toContain('\t"secrets.json"');
    });
  });

  describe('empty input', () => {
    it('should return empty result without touching the file when given no paths', async () => {
      const original = JSON.stringify({ autoCopyFiles: ['.env'] }, null, 2);
      const configPath = await writeConfig(original);

      const result = await addToAutoCopyFiles(configPath, []);

      expect(result.added).toEqual([]);
      expect(result.alreadyPresent).toEqual([]);

      // File unchanged
      const written = await readConfig(configPath);
      expect(written).toBe(original);
    });
  });

  describe('error handling', () => {
    it('should throw when the config file does not exist', async () => {
      const nonExistentPath = path.join(tmpDir, 'does-not-exist.json');

      await expect(addToAutoCopyFiles(nonExistentPath, ['.env'])).rejects.toThrow();
    });
  });
});
