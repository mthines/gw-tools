# Service Orchestration Across Worktrees

Running multiple services (frontend, backend, workers) across different worktrees.

## Scenario

You're developing a full-stack application with:
- **Frontend**: React app on `feat/new-ui`
- **Backend API**: Node.js on `feat/api-v2`
- **Worker Service**: Background jobs on `main`

All services need to run simultaneously and communicate.

---

## Port Management Strategy

### The Problem

Each worktree might try to use the same default ports:
- Frontend: 3000
- Backend: 4000
- Database: 5432

### Solution: Dynamic Port Allocation

Create a port configuration based on worktree:

```bash
#!/bin/bash
# get-ports.sh - Run in any worktree

WORKTREE_NAME=$(basename "$PWD")

# Base ports
FRONTEND_BASE=3000
BACKEND_BASE=4000
DB_BASE=5432

# Calculate offset based on worktree (0-9)
case "$WORKTREE_NAME" in
  main)     OFFSET=0 ;;
  develop)  OFFSET=1 ;;
  *)        OFFSET=$(($(echo "$WORKTREE_NAME" | cksum | cut -d' ' -f1) % 10 + 2)) ;;
esac

export FRONTEND_PORT=$((FRONTEND_BASE + OFFSET))
export BACKEND_PORT=$((BACKEND_BASE + OFFSET))
export DB_PORT=$((DB_BASE + OFFSET))

echo "Ports for $WORKTREE_NAME:"
echo "  Frontend: $FRONTEND_PORT"
echo "  Backend:  $BACKEND_PORT"
echo "  Database: $DB_PORT"
```

### Usage

```bash
# In each worktree
source ./get-ports.sh
npm run dev -- --port $FRONTEND_PORT
```

---

## Docker Compose Per Worktree

### Setup

Create `docker-compose.services.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
    environment:
      - API_URL=http://localhost:${BACKEND_PORT:-4000}
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "${BACKEND_PORT:-4000}:4000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  worker:
    build: ./worker
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    ports:
      - "${DB_PORT:-5432}:5432"
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - db_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_PORT:-6379}:6379"

volumes:
  db_data:
    name: ${COMPOSE_PROJECT_NAME:-myapp}_db
```

### Start Services Per Worktree

```bash
# main worktree
gw cd main
export COMPOSE_PROJECT_NAME=myapp_main
export FRONTEND_PORT=3000
export BACKEND_PORT=4000
export DB_PORT=5432
export REDIS_PORT=6379
docker-compose -f docker-compose.services.yml up -d

# feat/new-ui worktree
gw cd feat/new-ui
export COMPOSE_PROJECT_NAME=myapp_newui
export FRONTEND_PORT=3010
export BACKEND_PORT=4010
export DB_PORT=5442
export REDIS_PORT=6389
docker-compose -f docker-compose.services.yml up -d
```

---

## Cross-Worktree Communication

### Scenario: Frontend in One Worktree, Backend in Another

Sometimes you want to test:
- New UI (`feat/new-ui`) against stable API (`main`)
- Stable UI (`main`) against new API (`feat/api-v2`)

### Setup

**In `feat/new-ui` worktree** (frontend only):

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000  # Points to main's backend
```

**In `main` worktree** (backend only):

```bash
# Start only the backend
npm run dev:backend
```

### Automation Script

```bash
#!/bin/bash
# cross-test.sh - Test frontend against different backends

FRONTEND_WORKTREE=$1
BACKEND_WORKTREE=$2

if [ -z "$FRONTEND_WORKTREE" ] || [ -z "$BACKEND_WORKTREE" ]; then
  echo "Usage: cross-test.sh <frontend-worktree> <backend-worktree>"
  exit 1
fi

# Get backend port
BACKEND_PORT=$(gw cd "$BACKEND_WORKTREE" && source ./get-ports.sh && echo $BACKEND_PORT)

# Start backend in background
echo "Starting backend from $BACKEND_WORKTREE on port $BACKEND_PORT..."
(gw cd "$BACKEND_WORKTREE" && npm run dev:backend -- --port "$BACKEND_PORT") &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 5

# Start frontend pointing to backend
echo "Starting frontend from $FRONTEND_WORKTREE..."
gw cd "$FRONTEND_WORKTREE"
NEXT_PUBLIC_API_URL="http://localhost:$BACKEND_PORT" npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT
```

Usage:

```bash
./cross-test.sh feat/new-ui main
```

---

## Service Discovery

### Using Environment Files

Create `.env.services` in each worktree:

```bash
# .env.services - Auto-generated, don't edit
FRONTEND_URL=http://localhost:3010
BACKEND_URL=http://localhost:4010
WORKER_URL=http://localhost:5010
DB_URL=postgresql://localhost:5442/myapp
REDIS_URL=redis://localhost:6389
```

### Generate Service Config

```bash
#!/bin/bash
# generate-services.sh

WORKTREE_NAME=$(basename "$PWD")
source ./get-ports.sh

cat > .env.services << EOF
# Auto-generated for worktree: $WORKTREE_NAME
# Generated at: $(date)

FRONTEND_URL=http://localhost:$FRONTEND_PORT
BACKEND_URL=http://localhost:$BACKEND_PORT
DB_URL=postgresql://localhost:$DB_PORT/myapp
REDIS_URL=redis://localhost:$((6379 + OFFSET))
EOF

echo "Generated .env.services for $WORKTREE_NAME"
```

---

## Logging and Debugging

### Centralized Logging

```bash
#!/bin/bash
# logs.sh - View logs from all services in current worktree

WORKTREE_NAME=$(basename "$PWD")
PROJECT_NAME="myapp_$WORKTREE_NAME"

# View all logs
docker-compose -p "$PROJECT_NAME" logs -f

# Or specific service
# docker-compose -p "$PROJECT_NAME" logs -f backend
```

### Log Aggregation Across Worktrees

```bash
#!/bin/bash
# all-logs.sh - View logs from all running worktrees

WORKTREES=$(gw list | awk '{print $1}' | xargs -n1 basename)

for wt in $WORKTREES; do
  PROJECT="myapp_$wt"
  if docker-compose -p "$PROJECT" ps -q 2>/dev/null | grep -q .; then
    echo "=== $wt ==="
    docker-compose -p "$PROJECT" logs --tail=10
  fi
done
```

### Debug Specific Service

```bash
# Attach to backend in feat/api-v2 worktree
gw cd feat/api-v2
docker-compose -p myapp_api-v2 exec backend sh

# Or view real-time logs
docker-compose -p myapp_api-v2 logs -f backend
```

---

## Health Checks

### Check All Services

```bash
#!/bin/bash
# health-check.sh

WORKTREE_NAME=$(basename "$PWD")
source ./get-ports.sh

echo "Health check for $WORKTREE_NAME"
echo "================================"

# Frontend
if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null; then
  echo "Frontend: OK (port $FRONTEND_PORT)"
else
  echo "Frontend: DOWN"
fi

# Backend
if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null; then
  echo "Backend:  OK (port $BACKEND_PORT)"
else
  echo "Backend:  DOWN"
fi

# Database
if pg_isready -h localhost -p "$DB_PORT" > /dev/null 2>&1; then
  echo "Database: OK (port $DB_PORT)"
else
  echo "Database: DOWN"
fi
```

### Global Health Check

```bash
#!/bin/bash
# global-health.sh - Check all worktrees

WORKTREES=$(gw list | awk '{print $1}' | xargs -n1 basename)

for wt in $WORKTREES; do
  echo "=== $wt ==="
  (cd "$(gw list | grep "$wt" | awk '{print $1}')" && ./health-check.sh 2>/dev/null || echo "No services running")
  echo ""
done
```

---

## Cleanup

### Stop Services in Current Worktree

```bash
#!/bin/bash
# stop-services.sh

WORKTREE_NAME=$(basename "$PWD")
PROJECT_NAME="myapp_$WORKTREE_NAME"

docker-compose -p "$PROJECT_NAME" down
echo "Stopped services for $WORKTREE_NAME"
```

### Stop All Services

```bash
#!/bin/bash
# stop-all.sh

WORKTREES=$(gw list | awk '{print $1}' | xargs -n1 basename)

for wt in $WORKTREES; do
  PROJECT="myapp_$wt"
  if docker-compose -p "$PROJECT" ps -q 2>/dev/null | grep -q .; then
    echo "Stopping $wt..."
    docker-compose -p "$PROJECT" down
  fi
done

echo "All services stopped"
```

### Cleanup with Worktree Removal

Add to your worktree removal workflow:

```bash
#!/bin/bash
# remove-worktree.sh

WORKTREE=$1

# Stop services first
PROJECT="myapp_$WORKTREE"
docker-compose -p "$PROJECT" down -v 2>/dev/null

# Remove worktree
gw remove "$WORKTREE"

echo "Removed $WORKTREE and its services"
```

---

## Best Practices

### 1. Use Consistent Naming

```bash
# Project names follow pattern: myapp_<worktree>
COMPOSE_PROJECT_NAME=myapp_$(basename "$PWD")
```

### 2. Document Port Assignments

Keep a `PORTS.md` in your repo:

```markdown
## Port Assignments

| Worktree | Frontend | Backend | DB    | Redis |
|----------|----------|---------|-------|-------|
| main     | 3000     | 4000    | 5432  | 6379  |
| develop  | 3001     | 4001    | 5433  | 6380  |
| feature-x| 3002     | 4002    | 5434  | 6381  |
```

### 3. Automate with gw Hooks

```bash
# Configure post-add hook to start services
gw init --post-add "cd {worktreePath} && ./scripts/start-services.sh"
```

### 4. Resource Limits

Add resource limits to prevent runaway containers:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find what's using the port
lsof -i :4000

# Kill the process
kill -9 <PID>

# Or find and kill by port
fuser -k 4000/tcp
```

### Container Won't Start

```bash
# Check logs
docker-compose -p myapp_feature logs backend

# Rebuild without cache
docker-compose -p myapp_feature build --no-cache backend
```

### Services Can't Communicate

```bash
# Check network
docker network ls | grep myapp

# Inspect network
docker network inspect myapp_feature_default

# Test connectivity from inside container
docker-compose -p myapp_feature exec backend ping db
```

---

*Part of the [multi-worktree-dev skill](../README.md)*
