---
id: push-hook-tracking-ref
title: Push hook auto-commits and pushes but leaves branch without tracking ref
type: observation
trigger-context: creating a PR after gw checkout in gw-tools
confidence: 0.9
seen_count: 1
created: 2026-06-17T00:00:00Z
expires: 2027-06-17T00:00:00Z
status: active
---

The pre-push hook in gw-tools (husky) runs `nx format:write`, auto-commits any
formatting changes, and pushes them. This leaves the local branch without an
upstream tracking ref because the hook's push sets the remote but `git push -u`
was not called by the hook itself.

Symptom: `gh pr create` fails with "you must first push the current branch to a
remote, or use the --head flag" even though the branch is clearly on the remote.

Resolution: after the worktree's first push, run:
git push --set-upstream origin <branch>

Or use `--head <branch>` flag with `gh pr create` as a workaround.
