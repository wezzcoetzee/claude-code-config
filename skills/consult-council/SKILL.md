---
name: consult-council
description: Use when asked to consult the council, get a second opinion before merging, or "merge once they're happy".
argument-hint: "[pr] [--no-merge]"
---

# Consult Council

Three reviewers from three labs read the PR independently. You argue with them until they agree,
then merge. Different labs miss different things; that is the point.

## The council

| Seat | Provider | Model |
|---|---|---|
| Claude | `claudeAgent` | newest Opus |
| GPT | `codex` | newest GPT Sol (`gpt-*-sol`) |
| Grok | `grok` | newest non-fast Grok |

Models are not pinned. Call `orchestrator_capabilities` first and pick the newest top-tier model in
each provider from the live catalog. Name the exact model IDs you picked in your status message.
If a seat's provider is disabled or missing, say so and stop; do not quietly run a two-seat council.

## Run it

1. Resolve the PR (argument, or the PR for the current branch). Read its diff and description so
   you know what it claims to do. Address outstanding PR comments, fix issues you already know
   about, and run the relevant checks first. The council reviews the code you would ship, not
   problems you were going to fix anyway.
2. Spawn the three seats in parallel with `delegate_task`, each with `reasoningEffort`/`effort` set
   to `medium`, read-only: tell them they may read code and run `gh`/`git`/tests, but must not edit,
   push, comment, or merge.
3. Give each the same brief: the PR URL, what it claims to do, and the specific risks you see in
   the diff as a bullet list. Ask for a verdict of `SAFE` or `BLOCK`, a score out of 10, and each
   finding as `<id> [blocker|should|nit] <file>:<line> <failure scenario>`. `blocker` means the
   intended case is wrong, `should` is a real bug callers will hit, and everything else (other
   paths, rare cases, small perf, extra compat) is a `nit`.
4. Tell the user who is reviewing and what they are checking, then wait for the tasks.

## Argue

- Verify every finding and its severity against the source before acting. Reviewers are wrong
  sometimes, and a rare case is a nit whatever label it came with.
- Keep a ledger across rounds: finding id, seat, severity, outcome (`fixed`, `disputed`,
  `declined`) and evidence. Never reconstruct it from memory.
- Real blocker or should: make the smallest fix, preferring to delete or narrow code over adding a
  guard, helper or option. Push and start a fresh round. Each round is a new `delegate_task` with
  its own `clientRequestId`, carrying the original brief, the ledger, and the change since the last
  round. Later rounds check only open ids and changed code.
- Nits: decline in one line and list them as follow-ups. Declined nits and comment, doc or format
  fixes do not need a new round, so stop early once only nits remain.
- Disagree: put your reasoning in the next round's brief and let that seat answer it. Do not drop a
  blocker because you disagree; drop it only when the seat that raised it withdraws it.
- Budget: three rounds. Go to five only for auth, permissions, data loss or concurrency while a
  blocker stays open with evidence, or when the user asks. Then report the open disagreement, both
  sides in two or three lines, and let the user decide. Running out of budget is not approval.
- Fight scope creep. If a round grew the diff, cut before the next one.

## Record it on the PR

Edit the PR description (no comment) to add this above the model and harness line, with one column
per round. Write `no score` where a seat gave none; never invent one.

```markdown
## Council review

Rounds: 2

| Seat | Round 1 | Round 2 |
| --- | --- | --- |
| Claude Opus | 7/10 BLOCK | 9/10 SAFE |
| GPT Sol | 8/10 SAFE | 10/10 SAFE |
| Grok | 7/10 BLOCK | 9/10 SAFE |
```

## Merge

Merge only when every seat returned `SAFE` on the current head commit and CI is green. Use the
repo's usual merge method. With `--no-merge`, report the verdicts and stop.

Finish with one line per seat: model ID, verdict, and anything they flagged that you chose not to fix.
