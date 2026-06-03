# `gw pr` resolver examples

These scripts demonstrate the `prResolvers` contract documented in
[`gw pr --help`](../../README.md#gw-pr). They are reference implementations,
not installed automatically — copy what you need into your repo (typically
`.gw/resolvers/`) or onto your `$PATH`.

## Files

- [`linear-to-gh.sh`](./linear-to-gh.sh) — turn a Linear review URL into
  GitHub PR metadata via Linear's GraphQL API.

## Resolver contract (recap)

Each resolver receives the user's identifier on **stdin** and as **`$1`**
(positional, never shell-interpolated, so it is safe to pass URLs containing
shell metacharacters). On success it writes a JSON object to stdout and exits
with status 0:

```json
{
  "prNumber": 42,
  "branch": "feat/foo",
  "owner": "mthines",
  "repo": "gw-tools",
  "isCrossRepository": false,
  "remote": "origin"
}
```

Only `prNumber` is required. Missing metadata is filled in by the `github`
builtin (when `gh` is installed). Exit non-zero or print empty stdout to pass
control to the next resolver.

## Secrets

Resolvers inherit the calling shell's environment. `gw` also auto-loads
`.gw/.env` (which is gitignored) before invoking a resolver, so per-repo
secrets like `LINEAR_API_KEY` can live there:

```bash
# .gw/.env
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxx
```

Anything you already export in your shell rc wins over `.gw/.env` — the
file provides defaults, not overrides.

## Wiring up

Once a script is in place, reference it from `.gw/config.json`:

```jsonc
{
  "prResolvers": [
    { "name": "linear", "command": "./.gw/resolvers/linear-to-gh.sh" },
    { "name": "gh", "builtin": "github" },
  ],
}
```

Resolvers are tried top-to-bottom. The `github` builtin is included
explicitly so that bare PR numbers and github.com URLs still work — when
`prResolvers` is set, it fully replaces the default `[{ builtin: "github" }]`.
