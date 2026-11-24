---
name: create-adr
description: Use when asked to write an ADR, record a decision, capture an architecture decision, document a decision the code already made, or supersede an ADR.
argument-hint: "[topic-or-input]"
---

# Create ADR

Interview the user about one decision and emit a short **Architecture Decision Record** — a page or less, one file per decision, into `docs/adr/`. The shape follows the vs-standards harness-docs standard's `process/adr.md`. When the repo has the standard installed (`vsai.yaml` lists `vetsoft/harness-docs`), read `.vsai/standards/vetsoft/harness-docs/process/adr.md` first and follow it wherever it differs from [`template.md`](template.md). Otherwise the template is the source of truth, and render structure matches it exactly.

## Interview directive — this is a loop, not a single pass

Interview the user relentlessly, one question at a time, until you reach genuine shared understanding of the decision. This is the core of the skill. **Do not draft the ADR until the interview gate (below) is satisfied.** Most failures here come from asking one round and stopping — that is the bug you are avoiding.

### The loop — run this for every section, in the order in step 3

1. **Ask exactly ONE question, then STOP and end your turn.** Wait for the user's reply before doing anything else. Never batch questions.
2. **Do not answer your own question.** You may append a recommendation — `(my recommendation: X, because …)` — but it is a *proposal the user can accept or override*, NOT a resolved answer. The user must respond before you treat anything as decided.
3. **After each answer, drill in.** Ask at least one follow-up that probes the vaguest, riskiest, or most hand-wavy part of what they just said — especially around alternatives that were dismissed too quickly and downside consequences they're glossing over. Keep following up until that thread is genuinely resolved.
4. **Walk every branch.** Move through the section's full question bank in [`reference/section-prompts.md`](reference/section-prompts.md). A second decision that surfaces mid-interview is a new ADR — note it and resolve the current one first.
5. **Explore instead of asking** only when the PRD/codebase *definitively* answers a question. If exploration leaves any ambiguity, ask. State what you found and confirm it.

### When you may stop a section

A section is done only when you cannot think of a follow-up that would change the ADR, AND you've covered its whole question bank. "I have enough to write something" is NOT the bar. An ADR is short, but it earns its brevity through a thorough interview — tighten at render time, not by skipping questions.

### Interview gate — before drafting

Do not render the ADR until you have walked Context → Decision → Why not → Consequences through the loop above AND explicitly asked: **"I think I have enough to draft the ADR — anything to add or correct before I write it?"** Only draft after they confirm.

## Workflow

### 1. Resolve optional PRD input

The slash command is `/create-adr [topic-or-input]`. The argument is optional and seeds context only — an ADR records a decision, it is not generated wholesale from a PRD. Detect the source by the argument's shape:

- Matches `https://*atlassian.net/wiki/*` → **Confluence URL** (PRD). Needs the Atlassian MCP server (see below); fetch the page and use it as background.
- Matches `^[A-Z]+-\d+$` (e.g. `VLT-1234`) → **Jira ticket**. Needs the Atlassian MCP server; fetch via `mcp__plugin_atlassian_atlassian__getJiraIssue`.
- Ends in `.md` and points to an existing file → **local markdown**. Read it.
- Anything else → treat as the decision topic in plain words.
- Empty → ask: "What decision are we recording?"

**Atlassian MCP check (only for Confluence/Jira inputs):** if they are deferred, load the one you need with a single `ToolSearch` `select:` and don't search for it again. If they aren't available at all, tell the user to install the `atlassian` plugin or paste the PRD text / point to a local file instead. Plain-topic and local-markdown inputs need nothing.

### 2. Determine the ADR number and directory

- The ADR directory is `docs/adr/` at the repo root. Create it if missing.
- Scan existing `docs/adr/NNNN-*.md` files. The new number is the highest existing number + 1, zero-padded to four digits (`0007`). If the directory is empty, start at `0001`. Numbers are never skipped or reused.
- Filename: `<NNNN>-<title-kebab-case>.md` (e.g. `docs/adr/0007-rfc-7807-problem-details.md`).
- If the repo already keeps ADRs elsewhere (such as `docs/adrs/ADR-NNNN-*.md`), keep writing there in its numbering, and tell the user the standard puts them in `docs/adr/`. Moving existing ADRs is its own change, and it must keep every number.

### 3. Interview in dependency order

Resolve the decision before describing it. Order:

1. **Context** — what forces the decision; constraints, problem, relevant facts.
2. **Decision** — what we will do, stated plainly.
3. **Why not** — each real alternative and why it lost, one section per alternative.
4. **Consequences** — honest trade-offs, including the downsides.

Run the interview loop (top of this file) for each section in this order. Track progress with a TodoWrite item per section so you don't stop early or skip a branch. Explore the codebase to resolve questions you can answer definitively before asking the user. Section question banks: [`reference/section-prompts.md`](reference/section-prompts.md).

### 4. Fill the frontmatter and title

| Field | Source |
|---|---|
| `type` | always `ADR` |
| `status` | `proposed` by default; `accepted` when the user confirms the decision is already made; `as-built` when the record recovers a decision the code already made, never ratified as one |
| `date` | the day the decision was made. For `as-built`, the day the behaviour was introduced (from the commit), not today |
| `deciders` | always ask; default to `git config user.name` plus any names the user gives |
| Title | short imperative phrase from the Decision, with no number in it (the filename carries the number) |

### 5. Render in template order

Render the completed ADR following [`template.md`](template.md) **exactly** — same headings, same order, same frontmatter. Replace all `<…>` placeholders with interview answers. Keep it to a page or less; if a section runs long, tighten it. Write the file to the path from step 2 and show the user the final path and the rendered ADR.

### 6. Superseding an existing ADR

When the user wants this decision to replace an older one (or asks to supersede an ADR):

1. Create the new ADR per steps 2–5, and link the old one under **Related** ("Supersedes [NNNN: <title>](NNNN-<title>.md)").
2. Edit the old ADR in place: set `status: superseded` and add "Superseded by [NNNN: <title>](NNNN-<title>.md)." as the first line of its body. Change nothing else: ADRs are immutable except for these two edits.
3. Show the user both the new ADR and the diff to the old one.

## Behavioural constraints

- **One decision per file.** If the interview surfaces a second distinct decision, offer to write a separate ADR for it.
- **One question per turn, then stop.** Ask a single question and end your turn. Long lists get half-answered; answering your own questions defeats the interview.
- **The interview is multi-round.** One pass is the failure mode. Keep drilling with follow-ups until further questions wouldn't change the ADR.
- **Don't draft before the gate.** No ADR rendering until all four sections are walked and the user confirms at the interview gate.
- **Explore before asking** only when the source *definitively* answers it. Ambiguity → ask.
- **Don't invent.** Never fabricate constraints, alternatives, or consequences. If a value isn't derivable, ask or leave a clearly-marked TBD.
- **ADRs are immutable.** To change a recorded decision, write a new ADR that supersedes the old one — don't rewrite history.
- **Template is source of truth.** Don't reorder, rename, or drop sections. To evolve the format, edit [`template.md`](template.md).
