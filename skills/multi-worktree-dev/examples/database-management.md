# Database Management Across Worktrees

Patterns for isolating or sharing databases between worktrees.

## Scenario

You're working on multiple features that all need database access:
- `feat/user-auth` - Adding new user fields
- `feat/payments` - New payment tables
- `main` - Stable reference

Each might have different migrations or test data needs.

---

## Strategy 1: Separate Databases (Recommended)

Each worktree uses its own database:

### Setup with PostgreSQL

```bash
# Create databases
psql -c "CREATE DATABASE myapp_main;"
psql -c "CREATE DATABASE myapp_auth;"
psql -c "CREATE DATABASE myapp_payments;"
```

### Configure Each Worktree

**main/.env:**
```
DATABASE_URL=postgresql://localhost:5432/myapp_main
```

**feat/user-auth/.env:**
```
DATABASE_URL=postgresql://localhost:5432/myapp_auth
```

**feat/payments/.env:**
```
DATABASE_URL=postgresql://localhost:5432/myapp_payments
```

### Run Migrations in Each

```bash
# In each worktree
gw cd feat/user-auth
npm run db:migrate

gw cd feat/payments
npm run db:migrate
```

### Benefits

- ✅ Complete isolation
- ✅ Different migration states
- ✅ Feature-specific test data
- ✅ No conflicts

---

## Strategy 2: Docker Compose per Worktree

Each worktree runs its own containerized database:

### Setup

Create `docker-compose.worktree.yml` in each worktree:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
    name: ${COMPOSE_PROJECT_NAME:-myapp}_db
```

### Usage

```bash
# main worktree
gw cd main
export DB_PORT=5432
export COMPOSE_PROJECT_NAME=myapp_main
docker-compose -f docker-compose.worktree.yml up -d

# feat/user-auth worktree
gw cd feat/user-auth
export DB_PORT=5433
export COMPOSE_PROJECT_NAME=myapp_auth
docker-compose -f docker-compose.worktree.yml up -d
```

### Automation Script

```bash
#!/bin/bash
# start-db.sh - Run in any worktree

WORKTREE_NAME=$(basename "$PWD")
BASE_PORT=5432

# Calculate unique port based on worktree name hash
PORT_OFFSET=$(($(echo "$WORKTREE_NAME" | cksum | cut -d' ' -f1) % 100))
DB_PORT=$((BASE_PORT + PORT_OFFSET))

export DB_PORT
export COMPOSE_PROJECT_NAME="myapp_$WORKTREE_NAME"

echo "Starting database on port $DB_PORT..."
docker-compose -f docker-compose.worktree.yml up -d

echo "DATABASE_URL=postgresql://postgres:postgres@localhost:$DB_PORT/myapp"
```

---

## Strategy 3: Schema Isolation

Share one database but use different schemas:

### Setup

```sql
-- Create schemas for each worktree
CREATE SCHEMA main_schema;
CREATE SCHEMA auth_schema;
CREATE SCHEMA payments_schema;
```

### Configure

**main/.env:**
```
DATABASE_URL=postgresql://localhost:5432/myapp?schema=main_schema
```

**feat/user-auth/.env:**
```
DATABASE_URL=postgresql://localhost:5432/myapp?schema=auth_schema
```

### Prisma Configuration

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = [env("DB_SCHEMA")]
}
```

### Benefits

- ✅ Single database server
- ✅ Lower resource usage
- ✅ Easy to compare data between schemas

### Limitations

- ❌ Schema changes can conflict
- ❌ Some ORMs don't support schemas well
- ❌ More complex setup

---

## Migration Management

### Running Migrations Safely

```bash
# Always check migration status first
gw cd feat/user-auth
npm run db:migrate:status

# Run pending migrations
npm run db:migrate

# Rollback if needed
npm run db:migrate:rollback
```

### Migration Conflicts

**Problem:** Two features add conflicting migrations

**Solution 1:** Sequential migration numbers
```
migrations/
├── 20240101_main_baseline.sql
├── 20240102_auth_add_mfa.sql
└── 20240103_payments_add_stripe.sql
```

**Solution 2:** Merge migrations before PR
```bash
# In feature branch, rebase migrations
git rebase main
# Renumber if needed
```

### Testing Migrations

```bash
# Create test database
gw cd feat/user-auth
createdb myapp_auth_test

# Run migrations
DATABASE_URL=...myapp_auth_test npm run db:migrate

# Run tests
npm test

# Clean up
dropdb myapp_auth_test
```

---

## Seeding Data

### Per-Worktree Seeds

```bash
# Each worktree can have different seed data
gw cd feat/user-auth
npm run db:seed -- --file=seeds/auth-test-users.sql

gw cd feat/payments
npm run db:seed -- --file=seeds/payment-test-data.sql
```

### Shared Seed Script

```bash
#!/bin/bash
# seed-worktree.sh

WORKTREE=$(basename "$PWD")

# Base seed for all worktrees
npm run db:seed -- --file=seeds/base.sql

# Worktree-specific seeds
if [ -f "seeds/$WORKTREE.sql" ]; then
  npm run db:seed -- --file="seeds/$WORKTREE.sql"
fi
```

---

## Cleanup Automation

### Stop Databases When Removing Worktree

Create a pre-remove hook or script:

```bash
#!/bin/bash
# cleanup-worktree.sh

WORKTREE=$1

# Stop Docker containers
export COMPOSE_PROJECT_NAME="myapp_$WORKTREE"
docker-compose -f docker-compose.worktree.yml down -v

# Drop database (if using shared server)
psql -c "DROP DATABASE IF EXISTS myapp_$WORKTREE;"

echo "Cleaned up database for $WORKTREE"
```

### Periodic Cleanup

```bash
#!/bin/bash
# cleanup-old-dbs.sh

# List worktrees
ACTIVE_WORKTREES=$(gw list | awk '{print $1}' | xargs -n1 basename)

# List databases
DATABASES=$(psql -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'myapp_%';")

for db in $DATABASES; do
  worktree="${db#myapp_}"
  if ! echo "$ACTIVE_WORKTREES" | grep -q "^$worktree$"; then
    echo "Orphaned database: $db"
    # Uncomment to drop:
    # psql -c "DROP DATABASE $db;"
  fi
done
```

---

## Best Practices

### 1. Document Database Setup

```markdown
## Database Setup

Each worktree needs its own database:

# Create database
createdb myapp_$(basename $PWD)

# Update .env
DATABASE_URL=postgresql://localhost:5432/myapp_$(basename $PWD)

# Run migrations
npm run db:migrate
```

### 2. Use Environment Variables

```bash
# .env.template
DATABASE_URL=postgresql://localhost:5432/myapp_${WORKTREE_NAME}
```

### 3. Automate with Hooks

```bash
gw init --post-checkout "./scripts/setup-db.sh"
```

### 4. Regular Cleanup

Schedule weekly cleanup of orphaned databases and Docker volumes.

---

## Troubleshooting

### Connection Refused

**Problem:** Can't connect to database

**Check:**
```bash
# Is database running?
docker ps | grep postgres

# Correct port?
echo $DB_PORT
```

### Migration Out of Sync

**Problem:** Schema doesn't match code

**Solution:**
```bash
# Reset and re-migrate
npm run db:drop
npm run db:create
npm run db:migrate
npm run db:seed
```

### Disk Space Issues

**Problem:** Too many database volumes

**Solution:**
```bash
# Clean up Docker volumes
docker volume prune

# Or remove specific volume
docker volume rm myapp_old_feature_db
```

---

*Part of the [multi-worktree-dev skill](../README.md)*
