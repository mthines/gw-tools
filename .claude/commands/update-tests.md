---
name: update-tests
description: Update or create tests based on code changes
---

# Update Tests

You are tasked with updating or creating tests to reflect recent code changes.

## Step 1: Analyze Changes

First, check the git diff to understand what has changed:

```bash
git diff --name-only HEAD~1..HEAD
git diff HEAD~1..HEAD -- "*.ts"
```

If there are no committed changes, check unstaged changes:

```bash
git diff --name-only
git diff -- "*.ts"
```

## Step 2: Identify Test Coverage Needs

Based on the changes, determine what tests need to be updated or created:

### Code Files -> Test File Mapping

| Changed File                         | Test File to Update/Create                |
| ------------------------------------ | ----------------------------------------- |
| `packages/gw-tool/src/commands/*.ts` | `packages/gw-tool/src/commands/*.spec.ts` |
| `packages/gw-tool/src/lib/*.ts`      | `packages/gw-tool/src/lib/*.spec.ts`      |
| `packages/gw-tool/src/lib/cli.ts`    | `packages/gw-tool/src/lib/cli.spec.ts`    |

### Test Files to Check

1. **Unit Tests**: `packages/gw-tool/src/**/*.spec.ts`
   - Test individual functions and methods
   - Mock external dependencies
   - Cover edge cases and error conditions

2. **Integration Tests**: `packages/gw-tool/e2e/**/*.spec.ts`
   - Test command line interface end-to-end
   - Verify actual file system operations
   - Test real git operations

3. **Test Coverage**: Check if existing tests need updates for:
   - New function parameters
   - Changed return types
   - New error conditions
   - Modified behavior

## Step 3: Determine What Tests Are Needed

For each changed file, identify what needs testing:

### New Features

- Create new test files or test suites for new functionality
- Test the happy path (expected usage)
- Test edge cases (boundary conditions, empty inputs, etc.)
- Test error conditions (invalid inputs, missing files, etc.)

### Modified Features

- Update existing tests that may now be broken
- Add tests for new parameters or options
- Update assertions to match new behavior
- Add tests for new error conditions

### Bug Fixes

- Add regression tests that would have caught the bug
- Ensure the fix doesn't break existing functionality

### Refactoring

- Ensure existing tests still pass
- Update test implementation if internal structure changed
- Keep test coverage at the same level or better

## Step 4: Write or Update Tests

For each test file:

1. **Read the existing test file** (if it exists)
2. **Identify which test cases need updating**
3. **Write new test cases for new functionality**
4. **Update broken or outdated assertions**
5. **Ensure tests follow project conventions**

### Test Writing Guidelines

- Use descriptive test names: `it('should return error when file does not exist')`
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies (file system, git commands, etc.)
- Test one thing per test case
- Use beforeEach/afterEach for setup and teardown
- Keep tests independent and isolated
- Use meaningful variable names in tests

### Test Structure Example

```typescript
describe('CommandName', () => {
  describe('methodName', () => {
    it('should handle the happy path', () => {
      // Arrange: Set up test data and mocks
      const input = 'test-input';

      // Act: Call the function being tested
      const result = methodName(input);

      // Assert: Verify the expected outcome
      expect(result).toBe('expected-output');
    });

    it('should throw error for invalid input', () => {
      // Test error conditions
      expect(() => methodName(null)).toThrow();
    });
  });
});
```

## Step 5: Run Tests

After writing or updating tests:

1. **Run unit tests**: `nx test gw-tool`
2. **Run e2e tests**: `nx e2e gw-tool-e2e`
3. **Check test coverage**: `nx test gw-tool --coverage`
4. **Fix any failing tests**

### Common Test Commands

```bash
# Run all tests for gw-tool
nx test gw-tool

# Run tests in watch mode (for development)
nx test gw-tool --watch

# Run tests with coverage report
nx test gw-tool --coverage

# Run specific test file
nx test gw-tool --testFile=cli.spec.ts

# Run e2e tests
nx e2e gw-tool-e2e
```

## Step 6: Verify Test Quality

Ensure your tests:

- ✅ Actually test the changed functionality
- ✅ Would fail if the code was broken
- ✅ Are not testing implementation details
- ✅ Have clear, descriptive names
- ✅ Cover both success and error cases
- ✅ Run quickly (mock slow operations)
- ✅ Are deterministic (no flaky tests)

## Output

Provide a summary of:

- Which code files were analyzed
- Which test files were updated or created
- What new test cases were added
- Test coverage before and after changes
- Any test failures and how they were resolved
