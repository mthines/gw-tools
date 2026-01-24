# @org/async

Async utility functions with retry logic and error handling for TypeScript applications.

## 📦 Package Information

- **Version**: 0.0.1
- **Publishable**: ✅ Yes
- **Tag**: `scope:async`
- **Module Boundaries**: Can only import from `scope:shared` packages

## ⚠️ CI Demo Note

**This package includes an intentionally failing test to demonstrate Nx's self-healing CI feature.** When you run tests, you'll see one failure. This is by design to showcase how `nx fix-ci` works in the CI pipeline.

## 🚀 Features

This package provides powerful async utilities:

- **retry** - Retry failed async operations with configurable options
- **createRetry** - Create reusable retry functions with default options
- **withRetry** - Wrap functions to automatically retry on failure
- **retryAll** - Retry multiple operations and wait for all
- **retryRace** - Race multiple operations with retry
- **retryAllSettled** - Get all results regardless of success/failure
- **TimeoutError** - Custom error class for timeout scenarios

## 📝 Usage Examples

```typescript
import { retry, createRetry, withRetry, TimeoutError } from '@org/async';

// Basic retry with default options
const result = await retry(async () => {
  const response = await fetch('/api/data');
  return response.json();
});

// Retry with custom options
const data = await retry(
  async (attempt) => {
    console.log(`Attempt ${attempt + 1}`);
    return await riskyOperation();
  },
  {
    retries: 3,      // Max 3 retries
    delay: 1000,     // 1 second delay
    backoff: 2       // Exponential backoff factor
  }
);

// Create a reusable retry function
const retryWithDefaults = createRetry({
  retries: 2,
  delay: 500
});

const result1 = await retryWithDefaults(operation1);
const result2 = await retryWithDefaults(operation2);

// Wrap a function to automatically retry
const safeFunction = withRetry(riskyFunction, { retries: 3 });
const result = await safeFunction(arg1, arg2);

// Retry multiple operations
const results = await retryAll([
  operation1,
  operation2,
  operation3
], { retries: 2 });

// Race operations with retry
const fastest = await retryRace([
  slowOperation,
  fastOperation
]);
```

## 🧪 Testing

```bash
# Run tests for this package (includes 1 intentional failure for CI demo)
nx test async

# Run tests in watch mode
nx test async --watch

# Run specific test file
nx test async --testFile=async-retry.spec.ts
```

## 🏗️ Building

```bash
# Build the package
nx build async

# The build output will be in dist/packages/async
```

## 📋 Available Commands

```bash
nx build async    # Build the package
nx test async     # Run tests (includes intentional failure)
nx lint async     # Lint the package
```

## 🔒 Module Boundaries

This package has the tag `scope:async` and can only import from:
- `@org/utils` (tagged with `scope:shared`)

Attempting to import from `@org/colors` or `@org/strings` will result in a linting error due to module boundary constraints.

## 🔧 Self-Healing CI Demo

This package demonstrates Nx's self-healing CI capabilities. The intentionally failing test helps showcase:

1. How CI detects failures
2. How `nx fix-ci` provides automated suggestions
3. How the system can self-correct common issues

To see this in action in CI, the workflow runs:
```bash
npx nx fix-ci
```

This command analyzes failures and provides actionable fixes.