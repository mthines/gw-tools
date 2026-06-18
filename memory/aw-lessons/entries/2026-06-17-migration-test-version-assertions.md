---
id: migration-test-version-assertions
title: config-migrations.test.ts hard-codes version numbers — update on every bump
type: observation
trigger-context: adding a config migration (CURRENT_CONFIG_VERSION bump)
confidence: 0.95
seen_count: 1
created: 2026-06-17T00:00:00Z
expires: 2027-06-17T00:00:00Z
status: active
---

config-migrations.test.ts asserts on exact migration counts
(appliedMigrations.length) and configVersion values. When CURRENT_CONFIG_VERSION
is bumped, these assertions become stale and fail.

Pattern: every existing test that starts a config at version N and migrates "all
the way up" will now also run the new migration, incrementing the count by 1 and
bumping the final configVersion.

Action: after adding any new migration entry, grep config-migrations.test.ts for
hard-coded version numbers (e.g. `configVersion, 2`) and update them to the new
CURRENT_CONFIG_VERSION. Also add a dedicated test for the new migration's
behaviour.
