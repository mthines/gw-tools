import { describe, it, expect } from 'vitest';
import { parseWorktreeListOutput, stripRemotePrefix, parseProgressEvent, progressEventToLabel } from './git-worktree';

describe('parseWorktreeListOutput', () => {
  describe('basic parsing', () => {
    it('parses single worktree correctly', () => {
      const output = `worktree /path/to/main
HEAD abc123def456
branch refs/heads/main
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: '/path/to/main',
        head: 'abc123def456',
        branch: 'main',
        bare: false,
      });
    });

    it('parses multiple worktrees correctly', () => {
      const output = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature/test
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(2);
      expect(result[0].branch).toBe('main');
      expect(result[0].path).toBe('/path/to/main');
      expect(result[1].branch).toBe('feature/test');
      expect(result[1].path).toBe('/path/to/feature');
    });

    it('strips refs/heads/ prefix from branch names', () => {
      const output = `worktree /path/to/worktree
HEAD abc123
branch refs/heads/my-branch
`;
      const result = parseWorktreeListOutput(output);
      expect(result[0].branch).toBe('my-branch');
    });
  });

  describe('bare repositories', () => {
    it('identifies bare repositories', () => {
      const output = `worktree /path/to/bare
HEAD abc123
bare
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0].bare).toBe(true);
      expect(result[0].branch).toBe('(detached)');
    });

    it('handles bare repo followed by regular worktrees', () => {
      const output = `worktree /path/to/bare
HEAD abc123
bare

worktree /path/to/feature
HEAD def456
branch refs/heads/feature
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(2);
      expect(result[0].bare).toBe(true);
      expect(result[1].bare).toBe(false);
      expect(result[1].branch).toBe('feature');
    });
  });

  describe('detached HEAD state', () => {
    it('handles detached HEAD without branch line', () => {
      const output = `worktree /path/to/detached
HEAD abc123
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe('(detached)');
      expect(result[0].head).toBe('abc123');
    });

    it('handles detached HEAD with detached marker', () => {
      const output = `worktree /path/to/detached
HEAD abc123
detached
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe('(detached)');
    });
  });

  describe('complex branch names', () => {
    it('handles feature branch with slashes', () => {
      const output = `worktree /path/to/worktree
HEAD abc123
branch refs/heads/feature/foo/bar
`;
      const result = parseWorktreeListOutput(output);
      expect(result[0].branch).toBe('feature/foo/bar');
    });

    it('handles branch names with special characters', () => {
      const output = `worktree /path/to/worktree
HEAD abc123
branch refs/heads/fix-123_issue
`;
      const result = parseWorktreeListOutput(output);
      expect(result[0].branch).toBe('fix-123_issue');
    });

    it('handles release branch format', () => {
      const output = `worktree /path/to/worktree
HEAD abc123
branch refs/heads/release/v1.2.3
`;
      const result = parseWorktreeListOutput(output);
      expect(result[0].branch).toBe('release/v1.2.3');
    });
  });

  describe('edge cases', () => {
    it('handles empty output', () => {
      const result = parseWorktreeListOutput('');
      expect(result).toEqual([]);
    });

    it('handles output with only whitespace', () => {
      const result = parseWorktreeListOutput('   \n  \n  ');
      expect(result).toEqual([]);
    });

    it('handles output without trailing newline', () => {
      const output = `worktree /path/to/main
HEAD abc123
branch refs/heads/main`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe('main');
    });

    it('handles multiple blank lines between entries', () => {
      const output = `worktree /path/to/main
HEAD abc123
branch refs/heads/main


worktree /path/to/feature
HEAD def456
branch refs/heads/feature
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(2);
    });

    it('handles paths with spaces', () => {
      const output = `worktree /path/to/my worktree
HEAD abc123
branch refs/heads/main
`;
      const result = parseWorktreeListOutput(output);
      expect(result[0].path).toBe('/path/to/my worktree');
    });

    it('handles long commit hashes', () => {
      const output = `worktree /path/to/main
HEAD abc123def456789012345678901234567890abcd
branch refs/heads/main
`;
      const result = parseWorktreeListOutput(output);
      expect(result[0].head).toBe('abc123def456789012345678901234567890abcd');
    });

    it('handles missing HEAD line', () => {
      const output = `worktree /path/to/main
branch refs/heads/main
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0].head).toBe('');
    });
  });

  describe('real-world scenarios', () => {
    it('parses typical git worktree list output', () => {
      const output = `worktree /Users/dev/projects/myrepo
HEAD 1234567890abcdef
bare

worktree /Users/dev/projects/myrepo-main
HEAD abcdef1234567890
branch refs/heads/main

worktree /Users/dev/projects/myrepo-feature
HEAD fedcba0987654321
branch refs/heads/feature/new-feature
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(3);

      // Bare repo
      expect(result[0].path).toBe('/Users/dev/projects/myrepo');
      expect(result[0].bare).toBe(true);

      // Main worktree
      expect(result[1].path).toBe('/Users/dev/projects/myrepo-main');
      expect(result[1].branch).toBe('main');
      expect(result[1].bare).toBe(false);

      // Feature worktree
      expect(result[2].path).toBe('/Users/dev/projects/myrepo-feature');
      expect(result[2].branch).toBe('feature/new-feature');
      expect(result[2].bare).toBe(false);
    });

    it('handles worktree with locked state', () => {
      // Git may add a "locked" line for locked worktrees
      const output = `worktree /path/to/main
HEAD abc123
branch refs/heads/main
locked
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe('main');
      // locked is not currently parsed, but shouldn't break parsing
    });

    it('handles worktree with prunable state', () => {
      // Git may add a "prunable" line
      const output = `worktree /path/to/old
HEAD abc123
branch refs/heads/old-branch
prunable
`;
      const result = parseWorktreeListOutput(output);
      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe('old-branch');
    });
  });
});

describe('stripRemotePrefix', () => {
  it('strips origin/ prefix from a remote branch name', () => {
    expect(stripRemotePrefix('origin/test/foo')).toBe('test/foo');
  });

  it('strips origin/ prefix from a simple remote branch name', () => {
    expect(stripRemotePrefix('origin/main')).toBe('main');
  });

  it('strips upstream/ prefix from a remote branch name', () => {
    expect(stripRemotePrefix('upstream/feature/bar')).toBe('feature/bar');
  });

  it('strips custom remote prefix from a remote branch name', () => {
    expect(stripRemotePrefix('my-remote/fix/issue-123')).toBe('fix/issue-123');
  });

  it('returns local branch name unchanged when no slash is present', () => {
    expect(stripRemotePrefix('main')).toBe('main');
  });

  it('preserves slashes in the branch name after stripping the remote prefix', () => {
    expect(stripRemotePrefix('origin/feat/deep/nested')).toBe('feat/deep/nested');
  });

  it('handles a branch name that is only a remote prefix with no branch part', () => {
    // Edge case: "origin/" — strips to empty string
    expect(stripRemotePrefix('origin/')).toBe('');
  });
});

// ── parseProgressEvent ────────────────────────────────────────────────────────

describe('parseProgressEvent', () => {
  it('returns a typed event for valid version:1 JSON', () => {
    const line = '{"version":1,"stage":"create-worktree","status":"start"}';
    const event = parseProgressEvent(line);
    expect(event).not.toBeUndefined();
    expect(event?.version).toBe(1);
    expect(event?.stage).toBe('create-worktree');
    expect(event?.status).toBe('start');
  });

  it('returns undefined for non-JSON lines', () => {
    expect(parseProgressEvent('Creating worktree: feat/foo')).toBeUndefined();
    expect(parseProgressEvent('  $ pnpm install')).toBeUndefined();
    expect(parseProgressEvent('')).toBeUndefined();
  });

  it('returns undefined for lines that start with { but are not valid JSON', () => {
    expect(parseProgressEvent('{not valid json')).toBeUndefined();
  });

  it('returns undefined for JSON with version !== 1', () => {
    const line = '{"version":2,"stage":"create-worktree","status":"start"}';
    expect(parseProgressEvent(line)).toBeUndefined();
  });

  it('parses an end event with durationMs', () => {
    const line = '{"version":1,"stage":"create-worktree","status":"end","durationMs":1842}';
    const event = parseProgressEvent(line);
    expect(event?.durationMs).toBe(1842);
    expect(event?.status).toBe('end');
  });

  it('parses a hook event with hook, of, command fields', () => {
    const line = '{"version":1,"stage":"post-checkout-hooks","status":"start","hook":1,"of":1,"command":"pnpm install"}';
    const event = parseProgressEvent(line);
    expect(event?.hook).toBe(1);
    expect(event?.of).toBe(1);
    expect(event?.command).toBe('pnpm install');
  });

  it('parses an error event with message and exitCode', () => {
    const line =
      '{"version":1,"stage":"create-worktree","status":"error","message":"git worktree add failed with exit code 128","exitCode":128}';
    const event = parseProgressEvent(line);
    expect(event?.status).toBe('error');
    expect(event?.message).toBe('git worktree add failed with exit code 128');
    expect(event?.exitCode).toBe(128);
  });
});

// ── progressEventToLabel ──────────────────────────────────────────────────────

describe('progressEventToLabel', () => {
  it('returns undefined for end events', () => {
    const label = progressEventToLabel({ version: 1, stage: 'create-worktree', status: 'end', durationMs: 100 });
    expect(label).toBeUndefined();
  });

  it('returns undefined for error events', () => {
    const label = progressEventToLabel({
      version: 1,
      stage: 'create-worktree',
      status: 'error',
      message: 'something failed',
    });
    expect(label).toBeUndefined();
  });

  it('maps create-worktree start to "Creating worktree"', () => {
    expect(progressEventToLabel({ version: 1, stage: 'create-worktree', status: 'start' })).toBe(
      'Creating worktree'
    );
  });

  it('maps copy-files start to "Copying config files"', () => {
    expect(progressEventToLabel({ version: 1, stage: 'copy-files', status: 'start' })).toBe('Copying config files');
  });

  it('maps copy-staged-files start to "Moving staged files to new worktree"', () => {
    expect(progressEventToLabel({ version: 1, stage: 'copy-staged-files', status: 'start' })).toBe(
      'Moving staged files to new worktree'
    );
  });

  it('maps pre-checkout-hooks start (no hook) to generic label', () => {
    expect(progressEventToLabel({ version: 1, stage: 'pre-checkout-hooks', status: 'start' })).toBe(
      'Running pre-checkout hooks...'
    );
  });

  it('maps post-checkout-hooks start (no hook) to generic label', () => {
    expect(progressEventToLabel({ version: 1, stage: 'post-checkout-hooks', status: 'start' })).toBe(
      'Running post-checkout hooks...'
    );
  });

  it('maps post-checkout-hooks start with hook N/M to "Running post-checkout hook N/M — cmd"', () => {
    const label = progressEventToLabel({
      version: 1,
      stage: 'post-checkout-hooks',
      status: 'start',
      hook: 2,
      of: 3,
      command: 'pnpm install',
    });
    expect(label).toBe('Running post-checkout hook 2/3 \u2014 pnpm install');
  });

  it('maps pre-checkout-hooks start with hook N/M to "Running pre-checkout hook N/M — cmd"', () => {
    const label = progressEventToLabel({
      version: 1,
      stage: 'pre-checkout-hooks',
      status: 'start',
      hook: 1,
      of: 1,
      command: 'echo hello',
    });
    expect(label).toBe('Running pre-checkout hook 1/1 \u2014 echo hello');
  });

  it('truncates long commands at 40 chars with ellipsis', () => {
    const longCmd = 'cd /some/very/long/path/to/a/project && pnpm install --frozen-lockfile';
    const label = progressEventToLabel({
      version: 1,
      stage: 'post-checkout-hooks',
      status: 'start',
      hook: 1,
      of: 1,
      command: longCmd,
    });
    expect(label).not.toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const truncated = label!.split(' \u2014 ')[1];
    expect(truncated).toHaveLength(41); // 40 chars + ellipsis char
    expect(truncated.endsWith('\u2026')).toBe(true);
  });
});
