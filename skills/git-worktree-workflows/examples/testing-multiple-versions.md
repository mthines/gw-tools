# Testing Multiple Versions Simultaneously

Testing compatibility across different environments, versions, or configurations in parallel.

## Scenario

You're releasing a new library feature and need to ensure compatibility with:
- Node.js 18 LTS
- Node.js 20 LTS
- Node.js 22 (latest)

Running tests sequentially would take significant time. With worktrees, you can test all versions in parallel.

## Prerequisites

- nvm (Node Version Manager) or similar tool
- gw CLI configured
- Test suite that takes several minutes to run

## Step-by-Step Workflow

### 1. Create Test Worktrees

```bash
# Create a worktree for each Node version you want to test
$ gw checkout test-node18 -b feature-new-api
$ gw checkout test-node20 -b feature-new-api --force
$ gw checkout test-node22 -b feature-new-api --force

# List all test environments
$ gw list
/projects/mylib.git/main         abc123f [main]
/projects/mylib.git/test-node18  def456a [feature-new-api]
/projects/mylib.git/test-node20  def456a [feature-new-api]
/projects/mylib.git/test-node22  def456a [feature-new-api]
```

**Note:** Using `--force` allows checking out the same branch multiple times.

### 2. Set Up Node 18 Environment

```bash
# Terminal 1: Node 18 testing
$ gw cd test-node18

$ nvm use 18
Now using node v18.19.0 (npm v10.2.3)

$ npm install
# Installing dependencies with Node 18...

$ npm test
# Running full test suite...
```

### 3. Set Up Node 20 Environment (In Parallel)

```bash
# Terminal 2: Node 20 testing
$ gw cd test-node20

$ nvm use 20
Now using node v20.11.0 (npm v10.2.4)

$ npm install
# Installing dependencies with Node 20...

$ npm test
# Running full test suite in parallel...
```

### 4. Set Up Node 22 Environment (In Parallel)

```bash
# Terminal 3: Node 22 testing
$ gw cd test-node22

$ nvm use 22
Now using node v22.0.0 (npm v10.5.0)

$ npm install

$ npm test
# Running full test suite in parallel...
```

**Result:** All three test suites run simultaneously, saving time.

### 5. Compare Results

```bash
# Terminal 1 (Node 18)
✓ 145 tests passed
Test duration: 3m 24s

# Terminal 2 (Node 20)
✓ 145 tests passed
Test duration: 3m 18s

# Terminal 3 (Node 22)
✗ 143 tests passed, 2 failed
Test duration: 3m 21s

# Node 22 has failures!
```

### 6. Investigate Node 22 Failures

```bash
# Stay in test-node22 worktree
$ npm test -- --verbose

# Find the failures:
✗ API endpoint returns correct headers
  Expected: 'application/json'
  Received: 'application/json; charset=utf-8'

✗ Date parsing handles timezone
  TypeError: Invalid time value
```

### 7. Fix Compatibility Issues

```bash
# Make fixes in test-node22 worktree
$ vim src/api/response-handler.ts
$ vim src/utils/date-parser.ts

# Test fixes immediately
$ npm test

✓ 145 tests passed
All tests now passing on Node 22!
```

### 8. Propagate Fixes to Other Environments

```bash
# Commit fixes in test-node22
$ git add src/
$ git commit -m "fix: Node 22 compatibility for headers and dates"

# The fix is now in the branch, other worktrees can pull it
$ gw cd test-node18
$ git pull

# Re-run tests to ensure fix doesn't break Node 18
$ npm test
✓ 145 tests passed
```

### 9. Clean Up Test Environments

```bash
# Remove test worktrees after verification
$ gw remove test-node18 test-node20 test-node22

# Push the compatibility fixes
$ gw cd main
$ git push origin feature-new-api
```

---

## Other Testing Scenarios

### Testing Framework Versions

```bash
# Test with React 17 and React 18
$ gw checkout test-react17 -b feature-components
$ gw checkout test-react18 -b feature-components --force

# In each worktree, install different React versions
$ gw cd test-react17
$ npm install react@17 react-dom@17

$ gw cd test-react18
$ npm install react@18 react-dom@18
```

### Testing Build Configurations

```bash
# Test with different build modes
$ gw checkout test-build-dev -b feature-build-optimization
$ gw checkout test-build-prod -b feature-build-optimization --force

$ gw cd test-build-dev
$ npm run build:dev
# Analyze dev build size and performance...

$ gw cd test-build-prod
$ npm run build:prod
# Analyze production build...
```

### Testing Browser Compatibility

```bash
# Set up worktrees for different browser test environments
$ gw checkout test-chrome -b feature-ui
$ gw checkout test-firefox -b feature-ui --force
$ gw checkout test-safari -b feature-ui --force

# Run Playwright/Cypress tests targeting different browsers
$ gw cd test-chrome
$ npx playwright test --project chromium

$ gw cd test-firefox
$ npx playwright test --project firefox

$ gw cd test-safari
$ npx playwright test --project webkit
```

---

## Benefits

| Sequential Testing | Parallel Testing with Worktrees |
|-------------------|----------------------------------|
| 3 tests × 3m = 9m total | 3 tests running simultaneously = ~3m total |
| Switch Node versions repeatedly | Each environment stays configured |
| npm install multiple times | Install once per worktree |
| Risk of version mix-ups | Complete isolation |

**Time savings:** ~66% faster for 3 environments

---

## Pro Tips

### 1. Use Docker for Even Better Isolation

```bash
# Each worktree with its own container
$ gw cd test-node18
$ docker-compose up -d
# Services running on ports 3001, 5433, 6380...

$ gw cd test-node20
$ docker-compose up -d
# Services running on ports 3002, 5434, 6381...
```

### 2. Automate with Scripts

```bash
#!/bin/bash
# test-all-versions.sh

versions=("18" "20" "22")

for version in "${versions[@]}"; do
  gw cd "test-node$version"
  nvm use "$version"
  npm install
  npm test > "../test-results-node$version.log" 2>&1 &
done

wait
echo "All tests complete!"
```

### 3. Use CI/CD for Production

While worktrees are great for local testing, use CI/CD (GitHub Actions, etc.) for official compatibility testing.

---

## Next Steps

- Explore [Multi-Worktree Development](../../multi-worktree-dev/) for advanced parallel workflows
- Set up [Configuration Management](../../config-management/) for environment-specific configs

---

*Part of the [git-worktree-workflows skill](../README.md)*
