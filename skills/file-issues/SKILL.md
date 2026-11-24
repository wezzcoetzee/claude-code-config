---
name: file-issues
description: Use whenever the user asks to "file these as issues", "create issues for each problem", "track these findings in GitHub", or wants audit/bug-hunt output turned into a triageable backlog. Also invoked at the end of the clean-code and bug-hunt skills. Prefer this over hand-rolling `gh issue create` whenever findings need labels or a consistent template.
model: sonnet
---

# File GitHub issues

This skill does one job well: take a set of findings and turn each one into a tracked GitHub issue with a consistent template and label taxonomy, so the user can triage by severity, by category, and by what model is best suited to fix it.

It does **not** audit code. The findings come from somewhere else — `clean-code`, `bug-hunt`, a PR review, or the user pasting a list. If there are no findings yet, run one of those skills first.

## Why this skill exists

An audit report rots in terminal scrollback. Turning findings into GitHub issues gives the user a triageable backlog, lets them assign work to the right model (Haiku for mechanical fixes, Opus for architectural ones), and surfaces severity at a glance. The template is deliberate — every issue answers the same four questions so any future agent (or human) can pick one up cold.

## Input

A list of findings. Each finding needs, at minimum:

- **Title** — imperative or declarative, one line
- **Location** — `file:line` (or multiple if cross-cutting)
- **Severity** — Critical / Warning / Low
- **Category** — security, bug, cleancode, performance, testing
- **Why it matters** — the concrete harm or risk
- **Suggested fix** — specific and implementable

If a finding is missing a location or a concrete harm story, don't file it — ask for the detail or drop it. Vague issues are worse than no issues.

## Workflow

Pause at the confirmation checkpoint — creating labels and issues is a remote side effect and should never happen without the user's explicit go-ahead.

### 1. Verify prerequisites

Run these checks in parallel before doing anything else:

- `gh auth status` — confirms the `gh` CLI is installed and authenticated
- `gh repo view --json nameWithOwner` — confirms the working directory is a GitHub-tracked repo
- `gh label list --limit 100` — lists existing labels so you don't blindly recreate them

If `gh` is missing or unauthenticated, stop and tell the user how to fix it (`brew install gh && gh auth login`). If the repo has no GitHub remote, offer to write the findings to `AUDIT.md` instead.

### 2. Assign labels

Each finding gets one severity label, one or more category labels, and exactly one model label.

The model label tells the user which Claude tier is right for fixing the issue:

- **model:haiku** — single file, single function, mechanical change, no architectural decisions. Examples: add a radix to `parseInt`, add a missing key to a redaction list, replace default credentials in an env file.
- **model:sonnet** — multi-file or requires judgment but localized. Examples: add input validation with a shared schema, extract a duplicated helper, write integration tests for a feature.
- **model:opus** — cross-cutting, architectural, or requires holistic understanding of the system. Examples: add authentication across all routes, migrate float math to a decimal library, fix a concurrency race that requires choosing an isolation strategy.

When in doubt, pick the lower tier — Haiku handles more than people expect and the user can always escalate.

### 3. Check for duplicates

Before proposing anything, search for matching open issues (`gh issue list --state open --search "<title keywords>"`). Flag likely duplicates in the plan and default to skipping them.

### 4. Present the plan and pause for confirmation

```markdown
## Issues to file — <repo name>

### 🔴 Critical (<count>)
**<N>. <Title>**
- Location: `<file:line>`
- Labels: `<list>`

### 🟡 Warning (<count>)
... same shape ...

### 🟢 Low (<count>)
... same shape ...

### Skipped as duplicates
- <title> → #<existing issue>

### Labels to create
<table of labels, with colors — only those missing from the repo>

## Next step
Want me to create <N> labels and <N> issues?
If you'd like to trim (e.g. criticals only, skip low-severity), tell me the cutoff.
```

**Stop here and wait for the user's response.** Do not create anything without explicit confirmation. If the user says "only criticals" or similar, filter before creating.

### 5. Create labels

Use `gh label create --force` (idempotent — updates if it exists). Run each label creation as a separate Bash call in parallel since they're independent.

| Label | Color | Description |
|---|---|---|
| `severity:critical` | `b60205` | P0 — exploit, data loss, or money loss risk |
| `severity:warning` | `d93f0b` | P1 — real bug or risk, no active exploit |
| `severity:low` | `fbca04` | P2 — quality / suggestion |
| `cleancode` | `5319e7` | Naming, structure, dead code, DRY |
| `security` | `000000` | Auth, secrets, SSRF, input validation |
| `performance` | `1d76db` | N+1, races, unnecessary work |
| `testing` | `0e8a16` | Missing or flaky tests |
| `model:haiku` | `c5def5` | Small/mechanical fix — suitable for Haiku |
| `model:sonnet` | `5dade2` | Medium complexity — Sonnet default |
| `model:opus` | `2874a6` | Cross-cutting / architectural — needs Opus |

`bug` is a GitHub default and usually already exists; reuse it rather than recreating.

### 6. Create issues

For each confirmed finding, run `gh issue create` with the title, labels, and body. Use a HEREDOC for the body to preserve formatting. The body must follow the template in [references/issue-template.md](references/issue-template.md) exactly — every issue has the same four H2 sections in the same order.

Run issues sequentially (not parallel) so the numbering is predictable and the user can see them appear in order.

### 7. Final summary

Output the created issues with links, grouped by severity. Suggest a fix order — typically criticals first, then warnings batched by model for efficiency (Haiku fixes first since they're quick to clear).

## Output template (mandatory)

Every issue body must match this shape. See [references/issue-template.md](references/issue-template.md) for the full template with examples.

```markdown
## Summary
<what's wrong, 1–2 sentences>

## Location of code
<file:line — with a code snippet if it clarifies>

## Why it matters
<concrete harm or risk>

## Suggested Fix
<specific, implementable action>
```

Title format: prefix with `[Critical]` / `[Warning]` / `[Low]`, name the problem rather than the fix, keep it under ~80 characters.

## Error handling

- **`gh` not authenticated** — stop, instruct the user to run `gh auth login`, don't proceed.
- **Not a GitHub repo** — offer to write the findings to `AUDIT.md` instead.
- **Label creation fails** — report which label, continue with others. Labels use `--force` so existing labels won't block.
- **Issue creation fails partway through** — report which issues were created, which failed, the error, and offer to retry the failures.
- **User interrupts during creation** — stop, report progress so far, don't orphan state.

## Common pitfalls to avoid

- **Don't create issues without confirmation.** Every run pauses at step 4. No exceptions.
- **Don't audit here.** If the findings look thin, say so and suggest `clean-code` or `bug-hunt` — don't start reading source files to invent more.
- **Don't pad the backlog.** Five real criticals beat twenty speculative cleancode nits.
- **Don't file vague titles.** "Improve error handling" is useless; "API error responses leak internal error messages" is filable.
- **Don't duplicate issues across runs.** Step 3 exists for this.
- **Don't bikeshed label colors.** The taxonomy in step 5 is deliberate; match it unless the user explicitly customizes.
- **Don't over-escalate model labels.** Most findings are `model:haiku`. Reserve `opus` for genuinely architectural work.
