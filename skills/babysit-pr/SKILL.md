---
name: babysit-pr
description: Use when the user asks to monitor, watch, or babysit a PR.
argument-hint: "[pr]"
---

# Babysit PR

All the repos we work in have various AI review bots. They're helpful, even if they are not always right.

## How to wait

Never write your own poll loop, `until`/`while` script, `sleep N && gh pr checks`, or bare
`gh pr checks --watch`. Hand-rolled watchers keep reading the previous commit's checks, mistake a
failed `gh` call for "all done", spin forever on a failed check, and miss review comments. The git
plugin's hook blocks GitHub poll loops and any `sleep` over 30s. Pick the first option your harness
has:

1. **T3 Code** (`watch_pull_request` is available): call it with the PR URL and end your turn. T3
   wakes you when checks finish, someone comments, or the branch conflicts. Call
   `unwatch_pull_request` when you hand the PR back.
2. **Anywhere else**: run the bundled waiter in the background (the `Monitor` tool, or Bash with
   `run_in_background`) and act when it exits. It blocks until something needs you, then prints
   one JSON line. It runs under Node 22.18+ or Bun and only needs `gh`. If `Monitor` is deferred,
   load it with one `ToolSearch` (`select:Monitor`) the first time and reuse it for every later
   wait; never search for it again.

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/pr-wait.mts" <pr-number-or-url> [--repo owner/name] [--timeout 30m]
   ```

   If `${CLAUDE_SKILL_DIR}` was not substituted, use the "Base directory for this skill" path.

| Exit | `status` | Do this |
|---|---|---|
| 0 | `green` | Required checks pass on the head commit and no bot is still awaited. Done, see below. |
| 1 | `failing` | Fix the checks in `checks.failed`, push, wait again. |
| 2 | `feedback` | Handle `feedback`, wait again. |
| 3 | `timeout` | Report what is still `pending` and ask whether to keep waiting. |
| 4 | `error` | `gh` failed three polls in a row. Report `error`, do not guess the state. |
| 5 | `stopped` | `reason` is `head-moved`, `closed` or `merged`. Re-read the PR before doing anything else. |
| 6 | `conflict` | The branch conflicts with its base. Rebase, push, wait again. |

**Checks.** Only failed required checks stop the wait; optional failures still show in
`checks.failed` with `required: false`. If the repo marks no check as required, every check counts.

**Bots.** `awaitedBots` lists bots that were asked to review, or that reviewed an earlier commit of
this PR but not the head. Green waits up to `--settle` (default 10m) after the checks finish for
them. Use `--settle 0` to skip that.

**Feedback** is comments on unresolved threads, review bodies, and PR comments written after the
head commit was pushed. Anything you already replied to is skipped, so a pushback without a new
commit is not reported again, but a reply to your pushback is. Agents post as the user, so the
waiter tells your replies apart by the `RESPONDING ON BEHALF OF` header from
`address-pr-comments`: **start every comment you post with that header**. A comment from the
user's login without it is the user talking to you, and counts as feedback. Pass `--since <iso>`
to widen the window. `unresolvedThreads` counts every open thread, including ones that predate the
push. Handle those once when you start.

If `truncated` is present, GitHub cut a list short. Check the PR directly before calling it done.

**Rate limits.** `gh pr view` and `gh pr checks` use GraphQL. When that limit is used up the REST
limit is separate and usually has room: read the PR with `gh api repos/<owner>/<repo>/pulls/<n>`
and checks with `gh api repos/<owner>/<repo>/commits/<sha>/check-runs`. Check
`gh api rate_limit --jq .resources.graphql` before you start watching again, and never re-watch in
a tight loop.

## What to do with it

Only act on checks and comments newer than the latest push.

When new review comments arrive, invoke the `address-pr-comments` skill to evaluate, fix, reply, and resolve them. It owns everything about handling a comment: how to read context, when to fix versus push back, the reply format, and when resolving is appropriate. Come back here afterwards and keep monitoring.

Fix CI failures yourself, distinguishing real repository failures from infrastructure flakes.

Keep an eye on changes to `main` and rebase when needed. If an overlapping PR makes this one obsolete, stop monitoring, report it to the user, and ask before closing the PR unless closure was explicitly authorized.

Keep the PR the size the user's goal needs. Review loops grow a PR one cheap-looking fix at a time. Fix real bugs in the intended case. Decline the rest with a written reason and list them as follow-ups: unneeded tests, guards for edge cases that do not matter, extra compatibility, small performance costs. Prefer the fix that deletes or narrows code.

If nothing has changed, stay quiet rather than posting filler comments. Stop when the review bots and required checks are green on the latest commit. Merge only when the user explicitly requested it; otherwise report that the PR is ready for review.
