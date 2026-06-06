# Telemetry Runbook (Maintainer Reference)

This document is a maintainer-only operational guide for the `gw` CLI
telemetry pipeline. It covers: Dash0 setup, CI secrets, threat model, and
day-to-day monitoring.

---

## Architecture Summary

`gw` uses a **maintainer-observe** model:

1. Release CI bakes a scoped Dash0 ingest token + endpoint into the binary at
   `deno compile` time via three env vars.
2. Users opt in per-machine (`gw telemetry on` or `GW_TELEMETRY=1`).
3. Each command emits one OTLP/HTTP span + log to the maintainer's Dash0
   `gw-cli` dataset.
4. The release pipeline sends a `deployment.success` log after each publish.
5. Dash0 correlates the deployment marker with any error-rate spike that
   follows, using `service.version`.

---

## Dash0 Setup (One-Time)

These steps are completed once per Dash0 organization. The output (token +
endpoint) feeds into the GitHub Actions secrets below.

1. **Create a dataset** named `gw-cli` in your Dash0 organization.
2. **Issue an ingest-only token** scoped to `gw-cli`. Least-privilege: the
   token must NOT have read or admin permissions — ingest only.
3. **Note your OTLP/HTTP endpoint.** It looks like:
   `https://ingress.<region>.gcp.dash0-dev.com`
   (find it in Dash0 under Settings > Endpoints).
4. **Set a volume alert** on the `gw-cli` dataset at a reasonable daily cap
   (e.g. 100k spans/day) to bound the blast radius if the token leaks.

---

## GitHub Actions Secrets

Three secrets in the `mthines/gw-tools` repository are required for the
release job to bake the token into the binary:

| Secret name                   | Value                                  |
| ----------------------------- | -------------------------------------- |
| `GW_BUILD_TELEMETRY_ENDPOINT` | OTLP/HTTP base URL (no trailing slash) |
| `GW_BUILD_TELEMETRY_TOKEN`    | Dash0 ingest-only bearer token         |
| `GW_BUILD_TELEMETRY_DATASET`  | Dash0 dataset name (e.g. `gw-cli`)     |

Set them at: **Settings > Secrets and variables > Actions > New repository
secret**.

When these secrets are absent (contributor forks, local builds) the constants
default to empty strings and the binary compiles cleanly with telemetry off.

---

## Release Pipeline Integration

`scripts/release-ci.sh` passes the three env vars to every `deno compile`
invocation:

```bash
deno compile \
  --env-file=... \
  --env GW_BUILD_TELEMETRY_ENDPOINT="$GW_BUILD_TELEMETRY_ENDPOINT" \
  --env GW_BUILD_TELEMETRY_TOKEN="$GW_BUILD_TELEMETRY_TOKEN" \
  --env GW_BUILD_TELEMETRY_DATASET="$GW_BUILD_TELEMETRY_DATASET" \
  ...
```

After a successful publish, the script also sends a `deployment.success` event:

```bash
deno run --allow-net --allow-env --allow-read \
  scripts/send-deployment-event.ts \
  --version "$VERSION" --environment production --commit "$(git rev-parse HEAD)"
```

The deployment event script reads `BUILD_TELEMETRY_*` constants from
`telemetry.ts` as fallback defaults, overridable by `OTEL_EXPORTER_OTLP_*`
env vars.

---

## Threat Model

The ingest token is embedded in the distributed binary and is technically
extractable by anyone with the binary. This is an **accepted and bounded risk**:

- The token is **ingest-only** — it cannot read back data or access other
  Dash0 resources.
- The dataset (`gw-cli`) is isolated from all other data in the organization.
- A **volume alert** at a daily cap limits the worst-case damage if the token
  is used to flood the ingest endpoint.
- The worst-case outcome is noise in a single dataset, not a data breach.

This is the same model used by Sentry DSNs, Vercel CLI analytics, Homebrew
analytics, and Deno's own telemetry. Cosmetic obfuscation was explicitly
rejected — it provides no real security benefit and adds maintenance burden.

**Rotation:** if the token leaks, revoke it in Dash0, issue a new one, and
update the three GitHub Actions secrets. The next release will bake the new
token in. Old binaries will continue sending to the revoked token (which fails
silently, fail-open) until users upgrade.

---

## What Gets Sent

Each opt-in command emits:

**Span attributes:**

- `gw.command` — command name (e.g. `checkout`, `list`)
- `gw.command.exit_code` — `0` on success, non-zero on failure
- `gw.command.duration_ms` — wall-clock duration
- `service.version` — semver of the binary
- `service.name` — `gw` (configurable)
- `deployment.environment.name` — if set in config

**Log record:**

- Level: `INFO` on success, `ERROR` on failure
- `error.message` (on failure) — client-side redacted (no paths, git refs,
  long hex SHAs, or `KEY=value` env pairs)

**What is NOT sent:** branch names, file paths, repository URLs, user identity,
or any PII.

---

## Monitoring in Dash0

**Recommended dashboards / alerts:**

1. **Error rate by version** — group by `service.version`, watch for spikes
   after a release. The deployment event provides the correlation marker.
2. **Command popularity** — `gw.command` dimension shows which commands are
   most used.
3. **P95 duration by command** — `gw.command.duration_ms` for performance
   regression detection.
4. **Opt-in adoption** — span count per day (each day with a non-zero count
   means at least one user opted in).

---

## Rotating or Disabling Telemetry

**Rotate the token:**

1. Issue a new ingest-only token in Dash0.
2. Update `GW_BUILD_TELEMETRY_TOKEN` in GitHub Actions secrets.
3. Trigger a release — the next binary will carry the new token.

**Disable telemetry entirely in a future release:**

1. Remove `GW_BUILD_TELEMETRY_TOKEN` / `GW_BUILD_TELEMETRY_ENDPOINT` secrets.
2. The constants will default to empty strings; no spans will be exported.
3. Remove the `gw telemetry` command and prompt from the codebase if desired.

---

## Local Testing (Maintainer)

To test the full pipeline locally without issuing a release:

```bash
# Point at the real Dash0 ingest endpoint
export GW_BUILD_TELEMETRY_ENDPOINT="https://ingress.<region>.gcp.dash0-dev.com"
export GW_BUILD_TELEMETRY_TOKEN="<your-ingest-token>"
export GW_BUILD_TELEMETRY_DATASET="gw-cli"

# Enable telemetry for this session
export GW_TELEMETRY=1

# Run any gw command — check Dash0 for the span within a few seconds
deno run --allow-all packages/gw-tool/src/main.ts list
```

To test the deployment event script:

```bash
export GW_BUILD_TELEMETRY_ENDPOINT="..."
export GW_BUILD_TELEMETRY_TOKEN="..."
export GW_BUILD_TELEMETRY_DATASET="gw-cli"

deno run --allow-net --allow-env --allow-read \
  packages/gw-tool/scripts/send-deployment-event.ts \
  --version 0.0.0-test --environment development --commit "$(git rev-parse HEAD)"
```
