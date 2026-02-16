# Testing Guide for gw-tools

## Overview

This project uses Deno's built-in test framework with comprehensive unit and integration tests. All tests use real git operations in isolated temporary repositories for maximum confidence.

## Running Tests

### Command Line

```bash
# Run all tests
pnpm exec nx run @gw-tools/gw-tool:test

# Run all tests (alternative)
nx run gw-tool:test

# Run specific test file
deno test --allow-all src/commands/add.test.ts

# Run with watch mode (for TDD)
nx run gw-tool:test -- --watch

# Run with coverage
deno test --allow-all --coverage=coverage/
deno coverage coverage/ --html
```

### VS Code

Tests can be run directly from the editor using the code lens:

1. Open any `.test.ts` file
2. Click "▶ Run Test" above each test
3. Or use the Testing sidebar panel

## Test Structure

### Test Files

Tests are co-located with source files:

```
src/
├── commands/
│   ├── add.ts
│   ├── add.test.ts          # Tests for add command
├── lib/
│   ├── config.ts
│   ├── config.test.ts       # Tests for config utilities
├── test-utils/              # Shared test infrastructure
│   ├── git-test-repo.ts    # Git repository test harness
│   ├── assertions.ts       # Custom assertions
│   ├── fixtures.ts         # Test fixtures
│   ├── temp-env.ts         # Environment management
│   └── mock-exit.ts        # Deno.exit() mocking
```

### Test Infrastructure

#### GitTestRepo

Creates isolated temporary git repositories for testing:

```typescript
import { GitTestRepo } from '../test-utils/git-test-repo.ts';

const repo = new GitTestRepo();
await repo.init(); // Initialize git repo
await repo.createFile('.env', 'SECRET=123'); // Create files
await repo.createCommit('Add .env'); // Commit files
await repo.createWorktree('feat', 'feat'); // Create worktree
await repo.cleanup(); // Cleanup
```

#### Custom Assertions

```typescript
import {
  assertFileExists,
  assertDirExists,
  assertWorktreeExists,
  assertBranchExists,
} from '../test-utils/assertions.ts';

await assertFileExists('/path/to/file');
await assertWorktreeExists(repo.path, 'worktree-name');
await assertBranchExists(repo.path, 'branch-name');
```

#### Config Fixtures

```typescript
import { createMinimalConfig, createConfigWithAutoCopy, writeTestConfig } from '../test-utils/fixtures.ts';

const config = createConfigWithAutoCopy(repo.path, ['.env']);
await writeTestConfig(repo.path, config);
```

#### Mock Deno.exit()

For testing commands that call `Deno.exit()`:

```typescript
import { withMockedExit } from '../test-utils/mock-exit.ts';

const { exitCode } = await withMockedExit(() => executeCommand(['args']));

assertEquals(exitCode, 1, 'Should exit with error code');
```

## Writing Tests

### Test Template

```typescript
import { assertEquals } from '$std/assert';
import { GitTestRepo } from '../test-utils/git-test-repo.ts';
import { TempCwd } from '../test-utils/temp-env.ts';
import { executeCommand } from './command.ts';

Deno.test('command - does something', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    // Setup test data
    await repo.createFile('test.txt', 'content');

    // Change to repo directory
    const cwd = new TempCwd(repo.path);
    try {
      // Execute command
      await executeCommand(['args']);

      // Assert results
      assertEquals(result, expected);
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
```

### Testing Commands with Deno.exit()

Commands that call `Deno.exit()` need special handling:

```typescript
import { withMockedExit } from '../test-utils/mock-exit.ts';

Deno.test('command - exits with error on failure', async () => {
  const repo = new GitTestRepo();
  try {
    await repo.init();

    const cwd = new TempCwd(repo.path);
    try {
      const { exitCode } = await withMockedExit(() => executeCommand(['invalid-args']));

      assertEquals(exitCode, 1, 'Should exit with error code');
    } finally {
      cwd.restore();
    }
  } finally {
    await repo.cleanup();
  }
});
```

## Test Coverage

Current coverage:

- ✅ **71 tests passing**
- ✅ All core utilities (config, path-resolver, file-ops)
- ✅ All commands (add, init, remove, list, etc.)
- ✅ Integration scenarios with real git operations
- ✅ Error cases and edge cases

### Coverage by Category

- **Unit Tests**: Pure function testing (path resolution, config parsing)
- **Integration Tests**: Full command execution with git operations
- **Error Handling**: Exit codes, validation, error messages

## Best Practices

### 1. Use Real Git Operations

Prefer real git operations over mocks:

```typescript
// ✅ Good - uses real git
await repo.createWorktree('feat-branch');
await assertWorktreeExists(repo.path, 'feat-branch');

// ❌ Avoid - brittle mocking
mockGit.worktree.add.returns({ success: true });
```

### 2. Isolate Tests

Each test gets its own temporary repository:

```typescript
const repo = new GitTestRepo(); // Unique temp directory
try {
  await repo.init();
  // Test uses isolated repo
} finally {
  await repo.cleanup(); // Always cleanup
}
```

### 3. Test Error Cases

Don't just test happy paths:

```typescript
// Test successful case
Deno.test('command - succeeds with valid args', async () => {
  // ...
});

// Test error case
Deno.test('command - fails with invalid args', async () => {
  const { exitCode } = await withMockedExit(() => executeCommand(['--invalid']));
  assertEquals(exitCode, 1);
});
```

### 4. Keep Tests Fast

- Integration tests should complete in < 1 second each
- Use parallel execution (Deno's default)
- Minimize file I/O

### 5. Clear Test Names

Use descriptive names that explain what's being tested:

```typescript
// ✅ Good
Deno.test("add command - copies auto-copy files from config", async () => {

// ❌ Unclear
Deno.test("test add", async () => {
```

## Troubleshooting

### Tests Hanging

If tests hang, check for:

- Missing `await` on async operations
- Uncleaned resources (repos, file handles)
- Infinite loops in command logic

### Flaky Tests

If tests fail intermittently:

- Check for timing issues (use proper awaits)
- Ensure proper cleanup (use try/finally)
- Check for shared state between tests

### Path Issues

On macOS, paths like `/var` may be symlinked to `/private/var`:

- GitTestRepo automatically resolves symlinks
- Use `assertWorktreeExists()` which handles path comparison correctly

## Continuous Integration

Tests run automatically on:

- Every commit (via git hooks)
- Pull requests (via CI/CD)
- Before releases

All tests must pass before merging.

## TDD Workflow

Following Test-Driven Development:

1. **Red**: Write a failing test

   ```typescript
   Deno.test('new feature - should work', async () => {
     await executeNewFeature(); // Doesn't exist yet
     assertEquals(result, expected);
   });
   ```

2. **Green**: Make it pass with minimal code

   ```typescript
   export async function executeNewFeature() {
     // Minimal implementation
   }
   ```

3. **Refactor**: Improve code quality
   ```typescript
   export async function executeNewFeature() {
     // Clean, well-structured implementation
   }
   ```

Run tests frequently: `nx run gw-tool:test -- --watch`

## Additional Resources

- [Deno Testing Documentation](https://deno.land/manual/testing)
- [Deno Assertions](https://deno.land/std/assert)
- Project test utilities: `src/test-utils/`
