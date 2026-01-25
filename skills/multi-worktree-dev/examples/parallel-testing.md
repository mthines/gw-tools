# Parallel Testing Across Worktrees

Run tests simultaneously across different environments, versions, or configurations.

## Scenario

You need to verify a feature works across:
- Node.js 18, 20, and 22
- Different database versions
- Multiple browser environments

Running tests sequentially takes too long. Worktrees enable parallel execution.

---

## Node.js Version Testing

### Setup

```bash
# Create worktrees for each Node version
gw add test-node18
gw add test-node20
gw add test-node22
```

### Parallel Execution (Manual)

**Terminal 1:**
```bash
gw cd test-node18
nvm use 18
npm install
npm test
```

**Terminal 2:**
```bash
gw cd test-node20
nvm use 20
npm install
npm test
```

**Terminal 3:**
```bash
gw cd test-node22
nvm use 22
npm install
npm test
```

### Parallel Execution (Automated)

```bash
#!/bin/bash
# test-all-node-versions.sh

versions=("18" "20" "22")
pids=()

for version in "${versions[@]}"; do
  (
    cd "$(gw cd "test-node$version" 2>/dev/null || echo "test-node$version")"
    export NVM_DIR="$HOME/.nvm"
    source "$NVM_DIR/nvm.sh"
    nvm use "$version"
    npm install
    npm test > "../test-results-node$version.log" 2>&1
    echo "Node $version: Exit code $?"
  ) &
  pids+=($!)
done

# Wait for all tests
for pid in "${pids[@]}"; do
  wait $pid
done

echo "All tests complete!"
echo "Results:"
for version in "${versions[@]}"; do
  tail -5 "test-results-node$version.log"
done
```

### Cleanup

```bash
gw remove test-node18 test-node20 test-node22
```

---

## Browser Testing

### Setup with Playwright

```bash
# Create worktrees for each browser
gw add test-chrome
gw add test-firefox
gw add test-safari
```

### Run Tests

```bash
# Terminal 1
gw cd test-chrome
npx playwright test --project=chromium

# Terminal 2
gw cd test-firefox
npx playwright test --project=firefox

# Terminal 3
gw cd test-safari
npx playwright test --project=webkit
```

### Automated Script

```bash
#!/bin/bash
# test-all-browsers.sh

browsers=("chromium" "firefox" "webkit")

for browser in "${browsers[@]}"; do
  (
    gw cd "test-$browser"
    npx playwright test --project="$browser" > "../test-$browser.log" 2>&1
  ) &
done

wait
echo "All browser tests complete!"
```

---

## Database Version Testing

### PostgreSQL Versions

```bash
# Create worktrees
gw add test-pg14
gw add test-pg15
gw add test-pg16

# Each with different docker-compose
```

**test-pg14/docker-compose.yml:**
```yaml
services:
  db:
    image: postgres:14
    ports:
      - "5434:5432"
```

**test-pg15/docker-compose.yml:**
```yaml
services:
  db:
    image: postgres:15
    ports:
      - "5435:5432"
```

### Run Tests

```bash
# Start all databases
for v in 14 15 16; do
  (cd test-pg$v && docker-compose up -d)
done

# Run tests in parallel
for v in 14 15 16; do
  (
    gw cd test-pg$v
    DATABASE_URL="postgresql://localhost:$((5432+v))/test" npm test
  ) &
done

wait
```

---

## CI/CD Integration

### GitHub Actions Matrix

```yaml
name: Test Matrix

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]
        os: [ubuntu-latest, macos-latest]
      fail-fast: false

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-node${{ matrix.node }}-${{ matrix.os }}
          path: test-results/
```

### Local Matrix Simulation

```bash
#!/bin/bash
# Simulate CI matrix locally

matrix=(
  "18:ubuntu"
  "20:ubuntu"
  "22:ubuntu"
)

for combo in "${matrix[@]}"; do
  node_ver="${combo%%:*}"
  os="${combo##*:}"

  echo "Testing Node $node_ver on $os..."
  gw add "test-$node_ver-$os" --force

  (
    gw cd "test-$node_ver-$os"
    nvm use "$node_ver"
    npm install
    npm test
  ) &
done

wait
echo "Matrix complete!"
```

---

## Test Result Aggregation

### Simple Aggregation

```bash
#!/bin/bash
# aggregate-results.sh

echo "=== Test Results Summary ==="
echo ""

for log in test-results-*.log; do
  name="${log#test-results-}"
  name="${name%.log}"

  if grep -q "PASS" "$log"; then
    echo "✓ $name: PASSED"
  else
    echo "✗ $name: FAILED"
    echo "  Last 5 lines:"
    tail -5 "$log" | sed 's/^/    /'
  fi
done
```

### JSON Report

```bash
#!/bin/bash
# Create JSON report

echo "{"
echo '  "results": ['

first=true
for log in test-results-*.log; do
  name="${log#test-results-}"
  name="${name%.log}"
  passed=$(grep -c "PASS" "$log" || echo "0")
  failed=$(grep -c "FAIL" "$log" || echo "0")

  [ "$first" = true ] && first=false || echo ","
  echo "    {\"env\": \"$name\", \"passed\": $passed, \"failed\": $failed}"
done

echo "  ]"
echo "}"
```

---

## Best Practices

### 1. Use Force Flag for Same Branch

```bash
# Testing same branch in multiple environments
gw add test-env1 --force
gw add test-env2 --force
```

### 2. Isolate Port Usage

```bash
# test-node18/.env
PORT=3018

# test-node20/.env
PORT=3020

# test-node22/.env
PORT=3022
```

### 3. Clean Up After Testing

```bash
# Remove all test worktrees
gw list | grep test- | awk '{print $1}' | xargs -n1 basename | xargs -I{} gw remove {}
```

### 4. Save Test Artifacts

```bash
# Before removing worktrees
mkdir -p test-artifacts
cp test-*/test-results.xml test-artifacts/
cp test-*/coverage/ test-artifacts/ -r
```

---

## Troubleshooting

### Tests Interfere with Each Other

**Problem:** Tests in one worktree affect another

**Solution:** Ensure isolation:
- Different ports
- Different database names
- Different cache directories

### Out of Memory

**Problem:** Too many parallel tests exhaust RAM

**Solution:** Limit parallelism:
```bash
# Run in batches of 2
parallel -j2 ./run-test.sh ::: node18 node20 node22
```

### Flaky Tests in Parallel

**Problem:** Tests pass individually but fail in parallel

**Cause:** Shared resources or timing issues

**Solution:**
- Use unique ports/databases per worktree
- Add retry logic
- Run flaky tests sequentially

---

*Part of the [multi-worktree-dev skill](../README.md)*
