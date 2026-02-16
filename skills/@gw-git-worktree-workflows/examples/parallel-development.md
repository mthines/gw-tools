# Parallel Development Workflow

Working on multiple features simultaneously without losing focus or context.

## Scenario

You're a full-stack developer working on two features for an e-commerce application:

- **Feature A:** New payment gateway integration (backend focus)
- **Feature B:** Product recommendation UI (frontend focus)

Both features are independent and can be developed in parallel. Traditional branch switching would force constant context switching, IDE reindexing, and potential merge conflicts with uncommitted work.

## Prerequisites

- gw configured with auto-copy for `.env` and config files
- Two feature branches to work on

## Step-by-Step Workflow

### 1. Set Up Both Feature Worktrees

```bash
# Create worktree for payment gateway feature
$ gw add feature-payment-gateway -b feature-payment-gateway main

Creating worktree feature-payment-gateway...
✓ Worktree created: /projects/ecommerce.git/feature-payment-gateway
Copying files from main...
✓ Copied: .env
✓ Copied: secrets/stripe-keys.json

# Create worktree for recommendations feature
$ gw add feature-recommendations -b feature-recommendations main

Creating worktree feature-recommendations...
✓ Worktree created: /projects/ecommerce.git/feature-recommendations
Copying files from main...
✓ Copied: .env
```

### 2. Work on Feature A (Payment Gateway)

```bash
# Navigate to payment gateway worktree
$ gw cd feature-payment-gateway

# Install dependencies
$ npm install

# Start backend development
$ npm run dev:backend

# Make changes to payment API
vim src/api/payments/stripe-integration.ts
vim src/api/payments/payment-controller.ts

# Run tests
$ npm test -- src/api/payments

# Commit progress
$ git add src/api/payments/
$ git commit -m "feat: add Stripe payment integration API"
```

**Terminal 1:** Backend server running on port 3001

### 3. Switch to Feature B (Recommendations) - No Interruption

```bash
# Open new terminal, navigate to recommendations worktree
$ gw cd feature-recommendations

# Backend in other worktree is still running!

# Start frontend development
$ npm run dev:frontend

# Make changes to UI components
vim src/components/ProductRecommendations.tsx
vim src/styles/recommendations.css

# View in browser at localhost:3000
# Backend API from other worktree is available at localhost:3001
```

**Terminal 2:** Frontend server running on port 3000

### 4. Context Switching Made Easy

```bash
# Need to update payment API based on frontend needs?
gw cd feature-payment-gateway

# Update API response format
vim src/api/payments/payment-controller.ts
# Backend auto-reloads...

# Back to frontend to consume new API
gw cd feature-recommendations

# Update frontend to use new response format
vim src/components/Checkout.tsx
# Frontend auto-reloads...
```

**Both development servers keep running!**

### 5. Independent Testing and Commits

```bash
# Test and commit Feature A
gw cd feature-payment-gateway
npm test
git add .
git commit -m "feat: complete Stripe integration with webhooks"
git push origin feature-payment-gateway

# Test and commit Feature B (separate commits)
gw cd feature-recommendations
npm test
git add .
git commit -m "feat: add ML-powered product recommendations UI"
git push origin feature-recommendations
```

### 6. Code Review and PR Creation

```bash
# Create PRs for both features
gh pr create --base main --head feature-payment-gateway --title "Add Stripe payment integration"
gh pr create --base main --head feature-recommendations --title "Add product recommendations"

# Continue working while waiting for reviews
```

---

## Benefits of Parallel Development

| Traditional Approach             | Worktree Approach                   |
| -------------------------------- | ----------------------------------- |
| Stop Feature B dev server        | Both servers run simultaneously     |
| Commit or stash Feature B        | Both features have uncommitted work |
| Switch to Feature A branch       | Navigate with `gw cd feature-a`     |
| Wait for IDE reindexing          | IDE already indexed both            |
| npm install (again)              | Each has its own node_modules       |
| Restart Feature A dev server     | Never stopped                       |
| Context loss and mental overhead | Seamless context preservation       |

---

## Managing Context Across Worktrees

### IDE Setup

**VS Code:** Open each worktree in separate windows

```bash
# Terminal 1
gw cd feature-payment-gateway
code .

# Terminal 2
gw cd feature-recommendations
code .
```

Use `Cmd+Tab` (Mac) or `Alt+Tab` (Windows/Linux) to switch between editor windows.

**Multi-root workspace** (advanced):

```json
{
  "folders": [
    { "name": "Payment Gateway", "path": "../feature-payment-gateway" },
    { "name": "Recommendations", "path": "../feature-recommendations" }
  ]
}
```

### Terminal Management

Use terminal multiplexers for easy switching:

**tmux:**

```bash
# Create sessions for each feature
tmux new -s payment
gw cd feature-payment-gateway

# Detach and create new session
tmux new -s recommendations
gw cd feature-recommendations

# Switch between sessions
tmux attach -t payment
tmux attach -t recommendations
```

**iTerm2 / Windows Terminal:**

- Use named tabs for each worktree
- Split panes to view both simultaneously

---

## Common Pitfalls

### Pitfall 1: Port Conflicts

**Problem:** Both features try to use the same port

```bash
# Feature A
npm run dev  # Port 3000

# Feature B
npm run dev  # Error: Port 3000 already in use
```

**Solution:** Configure different ports

```bash
# feature-payment-gateway/.env
PORT=3001

# feature-recommendations/.env
PORT=3002
```

### Pitfall 2: Shared Database State

**Problem:** Both features modify the same database

**Solution:** Use separate databases or Docker containers (see [autonomous-workflow examples](../../autonomous-workflow/examples/))

---

## Next Steps

- Learn about [Testing Multiple Versions](./testing-multiple-versions.md)
- Explore [Autonomous Workflow](../../autonomous-workflow/)
- Set up [Configuration Management](../../config-management/)

---

_Part of the [git-worktree-workflows skill](../README.md)_
