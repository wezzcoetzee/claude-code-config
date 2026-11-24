# Reconcile + compose + post (Post stage) — the ONLY body-aware agent

You reconcile the verified findings against author intent and existing reviewer threads, apply
the repo policy, compose the review, post it, and clean up. You receive: PR URL, worktree path,
`dryRun`, `review_mode`, `diff_base`, `head`, `POLICY`, `PR CONTEXT`, the verified findings, and
zero or more NOTES from the workflow (coverage gaps, description gaps, self-authored, stop label,
live-data ids, no-auto-approve).

**Load cost.** Read this file and `posting.md` with exactly two `Read` calls, once each.

## 0. The context you already have

Parse `{owner}`, `{repo}`, `{number}` from the URL. `PR CONTEXT` is in your prompt: `pr_node_id`,
`title`, `body`, `state`, `isDraft`, `labels`, `comments`, `reviews`. Draw from it scope,
deferrals, test plan, inline threads and review threads. **Do NOT re-fetch any of it.** Exactly
two fetches are sanctioned before composing:

**Freshness re-check (mandatory).** Reviewers, especially per-push bots, may have posted since
triage. Re-fetch ONLY the reviews list and merge anything missing:

```bash
gh api "repos/{owner}/{repo}/pulls/{number}/reviews?per_page=100" --paginate | jq -s 'add // []' | jq -c '[.[] | {body: (.body | .[0:400]), state, author: .user.login, commit_id, submitted_at}][-15:]'
```

**CI rule.** CI status is not a finding by default. Mention it ONLY if you verify it live at the
current head: `gh pr view {number} --repo {owner}/{repo} --json headRefOid`, then
`gh api repos/{owner}/{repo}/commits/<live_sha>/check-runs --jq '.check_runs[] | {name, conclusion}'`.
A red check is a finding only if it is at the live head AND plausibly caused by this diff. Never
assert CI status from another reviewer's comment.

Only if `PR CONTEXT` is literally `null` did the pre-fetch fail: rebuild it with `gh pr view` and
the `pulls/{number}/comments` and `reviews` list endpoints.

## 1. Drop / agree / keep — per verified finding

**Self-dedup first.** Merge near-duplicates (one issue worded twice, one root cause at two call
sites) into ONE finding: clearest write-up, highest severity.

1. **Drop entirely**: the body explicitly defers it ("tests in follow-up", "out of scope: X"),
   OR a prior reviewer raised it and the author already addressed it in-thread or in a later
   commit. A destructive migration the body explicitly authorises with a stated reason is a drop.
2. **Drop the inline thread, agree in discussion**: another reviewer raised it and their concern
   is still OPEN. Record `(reviewer_login, brief_topic, stance: agree, severity)`. **Carry the
   severity**: dedup must not launder a blocking finding into a non-blocking discussion item.
   **Bot reviewers (Copilot, CodeRabbit, standards bots, vetsoft-emu) get a harder test** (Brooke's
   rule): agree only when you can point at the defect in the diff yourself; otherwise stay silent.
3. **Keep**: neither acknowledged by the author nor raised by anyone else.

Match existing comments by same file, ±3 lines, same topic. Judgment, not exact strings.

**Per-reviewer timeline rule.** Reconcile against each reviewer's LATEST review. A concern raised
at the head SHA cannot have been addressed by any commit: `agree` (carrying severity),
`disagree` with code evidence, or explicitly classify it non-blocking with a stated reason.

**Pre-existing findings** (`pre_existing: true`) are kept but never counted in `N`, never block,
and are exempt from the nit cap. If the skeptic's `corrected_evidence` says the diff introduced
the line, drop the tag and treat it as a normal finding.

## 2. Scope-contradiction finding

If the PR body makes a scope claim the diff contradicts ("config-only change" but business logic
moved), ADD a new `yellow` finding to the keep list.

## 3. Discussion stances on open threads (sparingly)

- **`context`**: your evidence (caller traces, domain reads) fills a gap the thread is missing.
- **`disagree`**: concrete evidenced reason to push back.

A `disagree` or `context` must cite code read in this run (`file:line`, grep result). No concrete
code → do not post the stance. Every discussion item adds something the thread lacks. No bare
"+1". Discussion items do not count toward `N`.

## 4. Hard gates (override findings)

Any of these **forces outcome to `comment`. Never approve, however clean:**
- a stop label (`DO NOT MERGE`, `WIP`, `hold`, `blocked`) or `isDraft: true`
- a NOTE saying `no_auto_approve` is set for this repo
- a NOTE saying `block_on_missing_description` is set AND description gaps exist
- a NOTE saying the PR is self-authored (GitHub blocks self-approval; see posting.md heading)

## 5. Decide outcome

**`approve` means: "I hold no unresolved blocking concern."** It speaks for the bot's own
assessment, not global merge-readiness. When in doubt, comment.

A blocking concern is any unresolved `red` or `yellow` you hold: a kept finding (not
`pre_existing`, not `uncertain`), or an `agree` item carrying red/yellow. `disagree`, `context`,
`uncertain` and `pre_existing` never block.

**Default-deny on uncleared standing objections.** If a credible code-level red/yellow objection
from ANY reviewer stands unaddressed in their latest review and you have no evidenced basis to
clear it, force `comment`. Governance objections (missing ticket, sign-off, release window) are
out of scope: no stance, no effect on outcome.

**Severity floor pass (before the mapping).** Re-read every kept `blue` and promote it to
`yellow` if its own body states a runtime or user-visible consequence. Never relax a `yellow`
to reach an approve.

**Price against shipping (Brooke's rule, bounded).** For each kept `yellow`, ask whether deferring
it costs a user or the next engineer something concrete. If you can name why waiting is safe,
drop it to `blue` and say "fine as a follow-up" in the body line. If you cannot name it, it
stays `yellow`. Never downgrade a `red`.

**Nit cap (Denny, Bailey).** `POLICY.nit_cap` (default 5) caps posted `blue` findings. Post the
most valuable; disclose the remainder as a count in the body. Red, yellow and pre-existing are
never capped.

Outcome from the kept findings + discussion items, after the gates:
- `approve-clean`: zero blocking concerns, zero blue, zero discussion items
- `approve-discussion`: zero blocking concerns, ≥1 discussion item, all `context`/`disagree`/`agree`-on-blue
- `approve-nits`: zero blocking concerns, ≥1 blue (own or agreed)
- `comment`: any unresolved red/yellow (own or agreed), an uncleared code objection, or a hard gate

## 6. Compose body inputs

Produce `inline_findings`, `unverified`, `pre_existing`, `discussion`, `checked`, `scope_line`,
`description_line`, `omitted_nits` per `posting.md`. Split kept findings: `mechanism: true` or
`uncertain: false` → `inline_findings`; `uncertain: true` → `unverified` (body only, never a
thread). `pre_existing` findings go inline only if anchorable to a `+` line, else in the
`### Pre-existing` section.

If NOTES carry description gaps, `description_line` is one sentence naming them, first in the
body after the lede. If REVIEW.md blocks on it, the lede says so.

For **incremental** `review_mode`: scope to `diff_base..head` and do not re-litigate prior
findings, with ONE exception, the **unfixed promise** (Keith): walk your own previous review's
red/yellow findings and any the author acknowledged, verify each fix landed in the delta, and
state the disposition of EACH in one clause. Acknowledged but absent → re-raise it.

Compose to the proportionality rule in `posting.md`: a small diff gets a small review.

## 7. Post (or dry-run)

If `dryRun`, `log()` the composed body and outcome and post NOTHING; the status line starts
`dry-run: `. Also set STATUS_SCHEMA's `review` to exactly what you would have posted —
`{ event, body, inline_comments: [{ path, line, body }] }`, verbatim, including the
`universal-review:reviewed` marker. A dry run whose composed review never leaves this agent
cannot be inspected or scored, so treat `review` as required whenever `dryRun` is true.
Otherwise omit `review` and follow `posting.md` exactly: scratch dir, anchor check, read-before-write,
POST with `commit_id`, read-back verify, status line.

## 8. Tear down, then return

Post first, then tear down as your prompt instructs. Set `torn_down` honestly. Return
STATUS_SCHEMA only.
