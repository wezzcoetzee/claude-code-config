# Section question banks

Questions are ordered by dependency: resolve the decision before you describe it. Render output follows [`../template.md`](../template.md). Interview order is below.

Rules for every section:

- Ask ONE question, then stop and wait for the reply. Never batch.
- Append a recommendation as a *proposal* (`my recommendation: …`), not a self-answer. The user must respond before it's decided.
- After each answer, ask at least one follow-up drilling into the vaguest or riskiest part before advancing.
- The numbered prompts below are a *starting point*, not the full interview — generate follow-ups as answers reveal new branches.
- Explore the PRD/codebase only when it *definitively* answers a question; otherwise ask. Any ambiguity → ask.
- Stop a section only when a further question wouldn't change the ADR — not merely when you have something to write. An ADR is a page or less, but earn the brevity by tightening at render time, not by skipping questions.

---

## Context (asked FIRST)

1. "What's forcing this decision now? (recommend: [the trigger you inferred from the PRD/topic])"
2. "What are the hard constraints — existing systems, deadlines, team skills, prior decisions this must respect?"
3. "What facts would a reader need in a year to understand the situation without the original conversation?"
4. "Is there a related or prior ADR this builds on or conflicts with?" (grep `docs/adr/`)
5. "Is this a decision being taken now, or one the code already made that we are writing down?" An already-made one is `as-built`: find the commit that introduced it and cite it.

Output: a short paragraph framing the problem and constraints. No solution yet.

## Decision

1. "State the choice in one sentence beginning 'We will …'. (recommend: [the option the context points to])"
2. "Is this decision already made (`accepted`), or are we proposing it for review (`proposed`)?" Skip this for an `as-built` record.
3. "Who are the deciders?" (default: `git config user.name` + named stakeholders)

Output: one or two plain sentences. The title is the imperative form of this.

## Why not

1. "What other options were genuinely on the table?" (recommend: [alternatives implied by the context])
2. For each alternative: "In one line — why didn't we pick it?"
3. "Was 'do nothing / status quo' a real option? If so, why rejected?"

Output: one `## Why not <alternative>` section per alternative, each with the reasons it lost. This is where most of an ADR's long-term value lives: it is what stops someone re-proposing a rejected path. Skip strawman options nobody considered.

## Consequences

1. "What becomes easier or unlocked by this decision?"
2. "What becomes harder, slower, or more constrained?"
3. "What do we now have to live with — new dependencies, migration debt, things we can't easily undo?"
4. "What follow-up work or future decision does this set up?"

Output: honest trade-offs, including the downsides. An ADR with only upsides is incomplete.
