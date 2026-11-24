# Review posting protocol (GitHub)

How the post stage turns verified findings into one posted review. Read once with `Read`.

## Severity words

Posted text never uses `red`/`yellow`/`blue` or coloured circles. Write the word:

| internal | posted word | means |
|---|---|---|
| `red` | **must fix** | likely bug or security problem |
| `yellow` | **fix** | risk worth justifying |
| `blue` | **nit** | optional, no runtime effect |
| `mechanism: true` | **confirm** | defect confirmed in the changed code, consequence untraced: an open question, never a nit |
| `pre_existing: true` | **pre-existing** | real bug this PR did not introduce; awareness only, never blocks |

## 0. Private scratch directory (mandatory)

Many post agents can run concurrently in one filesystem. A shared `/tmp/body.txt` has posted one
PR's review onto another PR. Every file you create lives here:

```bash
WORK=/tmp/universal-review/post/{owner}-{repo}-{number}
rm -rf "$WORK" && mkdir -p "$WORK"
```

## 1. Filter live data

Findings marked `used_live_data: true` were confirmed against a real system. Keep the conclusion,
drop the data. Drop a claim you cannot state without it. Quoting the PR's own changed lines is
always fine.

## 2. Check every inline line number

For each `inline_findings` entry, confirm `file:line` points to a `+` line in the filtered diff
(`@@ -OLD,LEN +NEW,LEN @@`, counting `+` and ` ` lines from `NEW`). Within ±5 lines, snap to it.
No match → drop the thread and move the finding to `### Notes`. **Never silently drop a finding
because it would not anchor.** Anchor to the code the claim is about, not to a comment or blank
line.

## 3. Compose the body

**The review must be faster to read than the diff.** Per line: does this change what the author
does next, or tell them something their diff does not? If not, cut it. A one-line fix earns a
one-line review. Findings live in the inline threads; the body says what the reviewer concluded.
Omit any section with no content.

### Attribution line (always the very first line)

The body opens with this line verbatim, then a blank line, then the verdict heading:

```
_Reviewed using Hyperion shared code review skill_
```

### Verdict heading (second line of the body)

| outcome | heading |
|---|---|
| `approve-clean` | `## Approved` |
| `approve-nits` | `## Approved ({Z} nits)` |
| `approve-discussion` | `## Approved — see discussion` |
| `comment` | `## Reviewed — {N} findings` |

Singularise at 1. When the only concern sits in `### Discussion`, write
`## Reviewed — {N} unresolved concerns`. Never a heading with no count.

Self-authored PR: event `COMMENT`, heading `## Would approve (self-authored — GitHub blocks
self-approval)`, and still return `posted: approve`. Repo with `no_auto_approve`: event
`COMMENT`, heading `## Would approve — flagged for human approval (repo policy)`.

### Lede (1 to 3 sentences)

State the judgment: what holds up, what the main gap is. Name files and symbols. Do not
paraphrase the diff or list the findings again.

### Description line (only when NOTES carry description gaps)

One sentence immediately after the lede: `The description is missing: <gaps>. A reader should
be able to understand this PR from the title and body alone.` If REVIEW.md blocks on it, the
lede opens with that.

### Sections, in order (each optional)

| section | holds | cap |
|---|---|---|
| `### Checked` | work beyond reading the diff: callers traced, configs cross-referenced, a stated-intent claim confirmed | 1 to 2 bullets, ≤20 words |
| `### Couldn't verify` | `unverified` findings, one line each, **each naming the fact that would settle it** | ≤35 words each |
| `### Discussion` | engagement with existing threads. Lead with `Agree with` / `Context for` / `Disagree with` @who (topic), then reason and `file:line`. All bare agrees collapse into ONE line naming reviewers and topics | ≤40 words each |
| `### Pre-existing` | pre-existing findings that would not anchor to a `+` line, with `file:line`; "predates this PR, does not block" | 1 line each |
| `### Notes` | findings that would not snap to a `+` line; `{K} further nits not posted (cap {nit_cap})` when the cap dropped any | 1 to 2 lines each |

Never include CI status unless verified live at head per `reconcile.md`. Cut: praise sections,
"read the diff" as evidence, bare agreement, process advice, proposals to split the PR.
Never write the head SHA, short SHA or branch name into the body (Denny's rule); GitHub already
binds the review to a commit.

### Scope line and footer (always last)

```
_{scope_line}_
<!-- universal-review:reviewed sha={head_sha} mode={full|incremental} -->
[Claude Code](https://claude.ai/code) · AI reviews may contain mistakes.
```

`{scope_line}`: one sentence, 6 to 14 words, what was reviewed, framed by the PR's domain, and
honest about coverage gaps the NOTES named. Never name a tier or internal axis. The HTML comment
is invisible on GitHub and is the machine-readable marker other tooling scans for.

### A full comment review

```markdown
_Reviewed using Hyperion shared code review skill_

## Reviewed — 2 findings

The list-side gate matches the stated intent: `buildDeceasedGate(includeDeceased)` now agrees
with the single-tenant reader. The gap is one endpoint over — the pet-owner single fetch still
hard-gates deceased, so rows this PR lists drill into an empty 200.

### Checked
- All four `repo.ItemKey` constructions in non-test code; none set `IncludeDeceased`

_Reviewed for API contract changes, authorization gating, and cursor-token trust boundaries._
<!-- universal-review:reviewed sha=abc123… mode=full -->
[Claude Code](https://claude.ai/code) · AI reviews may contain mistakes.
```

## 4. Inline thread format

```
**{must fix|fix|nit|confirm|pre-existing}: {short_title}**
{≤4 sentences: consequence first, evidence, fix last}
→ {the fix, one line; omit if obvious}
```

`short_title` names the consequence. One thread per issue, `side: RIGHT`. A **confirm** thread
ends with the one external fact that would settle it. Findings in `unverified` never get a
thread. **Suggestion blocks** when the fix is mechanical and ≤5 lines and fully resolves the
issue: a ```` ```suggestion ```` block holding only the replacement.

## 5. Read before write (mandatory, Brooke's guard)

GitHub's review-create endpoint is non-idempotent. Immediately before posting:

```bash
CURRENT_USER=$(gh api user -q .login)
gh api "repos/{owner}/{repo}/pulls/{number}/reviews?per_page=100" --paginate | jq -s 'add // []' \
  | jq --arg u "$CURRENT_USER" --arg s "{head_sha}" '[.[] | select(.user.login == $u and .commit_id == $s and .state != "DISMISSED" and (.body | contains("universal-review:reviewed sha=")))] | {count: length, ids: [.[].id]}' > "$WORK/existing.json"
```

If `count ≥ 1`, a review by you already exists at this head. **Do NOT POST.** Return
`{"line": "skipped: already-posted-at-head-sha"}`.

Match on the marker, not on the actor alone: replying to a thread makes GitHub record an
empty `COMMENTED` review by you at the current head, and counting those skips every second round.

Also confirm `gh pr view {number} --repo {owner}/{repo} --json state` is `OPEN`; otherwise return
`skipped: closed-or-merged`.

## 6. Post it — ONE bash invocation

**Never write JSON by hand here.** Thread bodies are your own prose: they carry quotes,
backslashes, backticks and — in every ```` ```suggestion ```` block — literal newlines, none of
which are legal inside a JSON string. Interpolating them into a JSON literal produces a payload
that fails to parse, and the whole review is lost at the last step. Every field below reaches
JSON through `jq`, which escapes it for you.

Write one **pair** of files per inline thread: `NNN.md` holds the body verbatim, `NNN.meta` holds
the path and line. Then let `jq` assemble the array.

```bash
WORK=/tmp/universal-review/post/{owner}-{repo}-{number}
mkdir -p "$WORK/threads"; rm -f "$WORK"/threads/*

cat > "$WORK/body.md" << 'BODY_EOF'
{review_body}
BODY_EOF

# Repeat this pair once per inline thread, numbered 001, 002, … If a body could
# ever contain the delimiter on a line of its own, lengthen the delimiter.
cat > "$WORK/threads/001.md" << 'THREAD_EOF'
{thread_body}
THREAD_EOF
printf '%s\t%s\n' '{file_path}' '{line_number}' > "$WORK/threads/001.meta"

# Assemble. `jq -s` over no input yields [], so zero threads needs no special case.
for meta in "$WORK"/threads/*.meta; do
  [ -e "$meta" ] || break
  IFS="$(printf '\t')" read -r cpath cline < "$meta"
  jq -n --arg path "$cpath" --argjson line "$cline" --rawfile body "${meta%.meta}.md" \
    '{path: $path, line: $line, side: "RIGHT", body: $body}'
done | jq -s '.' > "$WORK/comments.json"

grep -q '^## ' "$WORK/body.md" || { echo "body missing heading"; exit 1; }
head -1 "$WORK/body.md" | grep -qx '_Reviewed using Hyperion shared code review skill_' \
  || { echo "body missing attribution line"; exit 1; }
jq -e . "$WORK/comments.json" >/dev/null || { echo "comments.json is not valid JSON"; exit 1; }

jq -n --rawfile body "$WORK/body.md" --slurpfile comments "$WORK/comments.json" \
  --arg sha "{head_sha}" --arg event "{APPROVE|COMMENT}" \
  '{commit_id: $sha, event: $event, body: $body, comments: $comments[0]}' > "$WORK/payload.json"
gh api "repos/{owner}/{repo}/pulls/{number}/reviews" -X POST --input "$WORK/payload.json" > "$WORK/resp.json"
jq -r '.id, .html_url, (.body | .[0:120])' "$WORK/resp.json"
```

With zero inline threads, write no `threads/` files at all; the loop produces an empty array,
which the API accepts. `commit_id` pins the review to the reviewed SHA. Never `REQUEST_CHANGES`.

## 7. Verify what landed (mandatory)

If `.id` is empty, treat the POST as ambiguous: re-run the step-5 GET. If a review by you now
exists at this head, it succeeded; never blindly re-POST. The one exception is an HTTP 422 on
comment anchoring: that POST created nothing, so retry once with `comments: []` after moving all
findings to `### Notes`.

Then read the created review back by id:

```bash
gh api "repos/{owner}/{repo}/pulls/{number}/reviews/$ID" --jq '.body' > "$WORK/landed.md"
```

Assert the body contains the `universal-review:reviewed sha={head_sha}` marker and cites no
`github.com/<other-owner>/<other-repo>` link. If either check fails, do NOT re-POST; return
`failed: read-back-mismatch review=$ID` so a human can retract it.

## 8. Return the status line

Your entire final message is exactly one of:

```
posted: approve
posted: approve: N nits
posted: comment: N findings
skipped: <reason>
failed: <reason>
```

`N` counts posted findings: inline threads plus `### Notes` entries plus any blocking concern
that forced `comment` without a thread. `context`, `disagree`, `agree`-on-nit, `pre-existing`
and everything in `### Couldn't verify` do not count. In dryRun the prefix is `dry-run: `, never
`posted: `. Nothing else. No prose, no review body.
