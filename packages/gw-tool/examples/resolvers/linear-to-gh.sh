#!/usr/bin/env bash
#
# linear-to-gh.sh — example gw pr resolver
#
# Translates a Linear review URL (https://linear.app/<workspace>/review/<slug>)
# into the GitHub PR metadata that `gw pr` needs.
#
# Resolver contract (see `gw pr --help`):
#   - input on stdin AND as $1
#   - exit 0 with JSON `{ "prNumber": <int>, "branch"?, "owner"?, "repo"?, ... }`
#     to claim the identifier
#   - exit non-zero or empty stdout to pass control to the next resolver
#
# Requirements:
#   - curl, jq, and gh on PATH
#   - LINEAR_API_KEY exported (or set in .gw/.env, which gw auto-loads)
#
# Wire it up in .gw/config.json:
#   {
#     "prResolvers": [
#       { "name": "linear", "command": "./.gw/resolvers/linear-to-gh.sh" },
#       { "name": "gh",     "builtin": "github" }
#     ]
#   }

set -euo pipefail

input="${1:-$(cat)}"

# Only handle Linear review URLs; let the next resolver take everything else.
if [[ "$input" != *"linear.app/"*"/review/"* ]]; then
  exit 1
fi

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "linear-to-gh: LINEAR_API_KEY is not set. Add it to .gw/.env." >&2
  exit 1
fi

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "linear-to-gh: missing dependency: $cmd" >&2
    exit 1
  fi
done

# Linear review URLs end in `<slug>-<12-hex>` where the trailing 12 hex chars
# are the prefix of the diff (PullRequest) ID.
slug_tail="$(printf '%s' "$input" | sed -nE 's#.*/review/([^/?#]+).*#\1#p')"
if [[ -z "$slug_tail" ]]; then
  echo "linear-to-gh: could not extract slug from URL: $input" >&2
  exit 1
fi

# GraphQL: look up the pullRequest by url. Linear's API accepts the full
# review URL via the `searchPullRequests` query. Adjust the query if your
# workspace exposes a different field.
response="$(curl -fsS https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{ "query": "query (\$url: String!) { searchPullRequests(term: \$url, first: 1) { nodes { number url branch repository { owner name } } } }", "variables": { "url": "$input" } }
EOF
)"

node_json="$(printf '%s' "$response" | jq -c '.data.searchPullRequests.nodes[0] // empty')"
if [[ -z "$node_json" ]]; then
  echo "linear-to-gh: no PR found for $input" >&2
  exit 1
fi

# Project the Linear response into the gw resolver output shape.
printf '%s' "$node_json" | jq -c '{
  prNumber: .number,
  branch: .branch,
  owner: .repository.owner,
  repo: .repository.name
}'
