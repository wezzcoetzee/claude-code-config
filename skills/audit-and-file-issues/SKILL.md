---
name: audit-and-file-issues
description: Audit a repository for clean code, security, performance, accessibility, and testing issues, then create categorized GitHub issues — one per finding — with severity, category, and model-recommendation labels. Use whenever the user asks to "audit this repo and file issues", "review the code and create GitHub issues", "audit + file bugs", "run security audit and track findings", or combines any code review with issue tracking. Also trigger on "create issues for each problem", "file these as issues", or mentions of using GitHub issues as a backlog for audit output. Prefer this over a plain audit whenever the user mentions GitHub issues, labels, or tracking findings.
---

# Audit and file GitHub issues

This skill does one job well: audit a codebase, then turn each finding into a tracked GitHub issue with a consistent template and label taxonomy so the user can triage by severity, by category, and by what model is best suited to fix it.

## Why this skill exists

A plain audit produces a markdown report that rots in a terminal scrollback. Turning findings into GitHub issues gives the user a triageable backlog, lets them assign work to the right model (Haiku for mechanical fixes, Opus for architectural ones), and surfaces severity at a glance. The template is deliberate — every issue answers the same four questions so any future agent (or human) can pick one up cold.

## Workflow

Follow these steps in order. Pause at the confirmation checkpoint — creating labels and issues is a remote side effect and should never happen without the user's explicit go-ahead.

### 1. Verify prerequisites

Run these checks in parallel before doing anything else:

- `gh auth status` — confirms the `gh` CLI is installed and authenticated
- `gh repo view --json nameWithOwner` — confirms the working directory is a GitHub-tracked repo
- `gh label list --limit 100` — lists existing labels so you don't blindly recreate them

If `gh` is missing or unauthenticated, stop and tell the user how to fix it (`brew install gh && gh auth login`). If the repo has no GitHub remote, offer to run the audit locally and output a markdown report instead.

### 2. Determine scope

Read the user's request for scope hints. Common variants:

| User says | Scope |
|---|---|
| No scope mentioned | Full working tree audit, excluding generated/vendored dirs |
| "just changed files" / "this branch" | `git diff --name-only origin/main...HEAD` |
| "only security" / "just the critical stuff" | Filter categories after auditing |
| A file path or glob | Audit only those files |

For a full audit, skip large generated directories: `node_modules`, `.next`, `dist`, `build`, `generated/`, `coverage`, `__snapshots__`, lockfiles. Read the project's `AGENTS.md`, `CLAUDE.md`, or `README.md` first if present — they reveal stack, conventions, and key directories worth prioritizing.

### 3. Run the audit

Evaluate each in-scope file against the five categories in [references/audit-rubric.md](references/audit-rubric.md). Rank findings by severity: Critical > Warning > Low.

For each finding, collect:
- **Title** — imperative, one line, prefixed with `[Critical]` / `[Warning]` / `[Low]`
- **Summary** — what's wrong, in 1–2 sentences
- **Location** — `file:line` (or multiple if cross-cutting), with a short code snippet when it clarifies
- **Why it matters** — the concrete harm or risk, not a style preference
- **Suggested fix** — specific, implementable, names the files or patterns to change
- **Category labels** — `security`, `cleancode`, `performance`, `bug`, `testing` (one or more)
- **Model label** — `model:haiku`, `model:sonnet`, or `model:opus` (pick using the heuristic below)

### 4. Pick model labels

The model label tells the user which Claude tier is right for fixing the issue. Apply this heuristic:

- **model:haiku** — single file, single function, mechanical change, no architectural decisions. Examples: add a radix to `parseInt`, add a missing key to a redaction list, replace default credentials in an env file.
- **model:sonnet** — multi-file or requires judgment but localized. Examples: add input validation with a shared schema, extract a duplicated helper, write integration tests for a feature.
- **model:opus** — cross-cutting, architectural, or requires holistic understanding of the system. Examples: add authentication across all routes, migrate float math to a decimal library, fix a concurrency race that requires choosing an isolation strategy.

When in doubt, pick the lower tier — Haiku handles more than people expect and the user can always escalate.

### 5. Present findings and pause for confirmation

Output a report in this exact shape:

```markdown
# Audit Report — <repo name>

## Summary
<1–2 sentence overall health read>

## Label suggestions
<table of labels the skill will create, with colors and descriptions — include rationale for model tiers>

## Findings

### 🔴 Critical (<count>)
**<N>. <Title>**
- Location: `<file:line>`
- Why it matters: <impact>
- Suggested fix: <concrete action>
- Labels: `<list>`

### 🟡 Warning (<count>)
... same shape ...

### 🟢 Low (<count>)
... same shape ...

## Recommendations (top 3)
1. <highest-impact action>
2. <second>
3. <third>

## Next step
Want me to create:
- <N> labels
- <N> issues
?

If yes, confirm. If you'd like to trim (e.g. criticals only, skip low-severity), tell me the cutoff.
```

**Stop here and wait for the user's response.** Do not proceed to create anything without explicit confirmation. If the user says "only criticals" or similar, filter before creating.

### 6. Create labels

Use `gh label create --force` (idempotent — updates if exists). Run each label creation as a separate Bash call in parallel since they're independent.

Always create this fixed taxonomy (skip any that already exist and match):

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

### 7. Create issues

For each confirmed finding, run `gh issue create` with the title, labels, and body. Use a HEREDOC for the body to preserve formatting. The body must follow the template in [references/issue-template.md](references/issue-template.md) exactly — every issue has the same four H2 sections in the same order.

Run issues sequentially (not parallel) so the numbering is predictable and the user can see them appear in order. Collect the URLs and present a final summary grouped by severity.

### 8. Final summary

After all issues are created, output a summary with links, grouped by severity. Suggest a fix order (typically criticals first, then warnings batched by model for efficiency — Haiku fixes first since they're quick to clear).

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

## Error handling

- **`gh` not authenticated** — stop, instruct the user to run `gh auth login`, don't proceed.
- **Not a GitHub repo** — offer to output a markdown audit report to `AUDIT.md` instead.
- **Label creation fails** — report which label, continue with others. Labels use `--force` so existing labels won't block.
- **Issue creation fails partway through** — report which issues were created, which failed, the error, and offer to retry the failures.
- **User interrupts during creation** — stop, report progress so far, don't orphan state.

## Common pitfalls to avoid

- **Don't create issues without confirmation.** Every run pauses at step 5. No exceptions.
- **Don't pad findings.** If a category has nothing to report, skip it. Five real criticals beat twenty speculative cleancode nits.
- **Don't file vague titles.** "Improve error handling" is useless; "API error responses leak internal error messages" is filable.
- **Don't duplicate issues across runs.** Before creating, offer to check if a matching open issue already exists (`gh issue list --search "<title keywords>"`) and skip duplicates.
- **Don't bikeshed label colors.** The taxonomy in step 6 is deliberate; match it unless the user explicitly customizes.
- **Don't assume the stack.** JavaScript/TypeScript heuristics don't apply to Go, Python, Rust — read the repo first.
- **Don't over-escalate model labels.** Most findings are `model:haiku`. Reserve `opus` for genuinely architectural work.
