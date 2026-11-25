---
name: greenfield
description: Use when the user says "greenfield", or asks what they would change about a whole system if they started it again from scratch.
argument-hint: "[path | repo]"
---

# Greenfield

Audit a whole system as if you were about to build it again from an empty repo, then report what you would keep, change, remove, and add, and the path from today to there. The output is a hosted report. This is a read: the tree ends the run exactly as it started.

Three leading words run through every step:

- **Essential complexity** is what the problem demands. **Accidental complexity** is what history added. A greenfield rebuild keeps the first and drops the second.
- **Chesterton's fence**: before proposing to remove or replace something, find out why it is there (`git log -S`, `git blame`, the PR that added it, the docs). A fence you cannot explain gets `fence: unknown` and a lower confidence, never a silent removal.
- **Second-system effect**: the rebuild that fixes everything at once by adding everything at once. Every proposal must be smaller, faster, or safer than what it replaces, and say which.

## 1. Map

Build the **system map**: what the system does today and the decisions it rests on. Read, in one batch:

- `CLAUDE.md`, `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, ADRs, and any `docs/` index.
- Every manifest and lockfile (`package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, `Dockerfile`, compose and IaC files).
- Every CI workflow and deploy config.
- The directory tree two levels deep, skipping vendored and generated output.
- Churn hotspots: `git log --since=1.year --name-only --format= | sort | uniq -c | sort -rn | head -30`.
- Test layout and the commands that run it.

Then measure what can be measured without changing the tree:

- CI duration and failure rate: `gh run list --limit 50 --json workflowName,conclusion,startedAt,updatedAt`.
- Dependency count and the oldest direct dependencies.
- Lines of source versus tests, excluding generated code.
- Test and build wall time, only when the repo's own command writes nothing tracked to the tree.

The map is done when every top-level directory, every CI workflow, every runtime or deploy target, and every external service is named in it with one line on its job. Write down the system's **job**: one paragraph a newcomer could check the rebuild against.

## 2. Audit

Apply every lens in [`lenses.md`](lenses.md). Mark a lens `not applicable` with a reason when the system has nothing for it (a static library has no runtime monitoring); every other lens produces records.

Each finding is one **record**:

```
lens: <lens name>
verdict: keep | change | remove | add
today: <what exists, with file:line or a measured number>
greenfield: <what you would build instead; for keep, why it stays>
why: <the gain, measured or estimated, with its basis>
fence: <why today's choice was made, with the source, or "unknown">
migration: <incremental steps from today, or "rebuild only">
cost: S | M | L
impact: S | M | L
```

`keep` records are part of the deliverable. A report that changes everything is as useless as one that changes nothing, and the keeps tell the reader which decisions were good.

**Single pass or fan out.** Audit inline when the map fits comfortably in your context (roughly under 150 source files). Otherwise fan out read-only `code-auditor` agents (`subagent_type: "code-auditor"`, `model: "sonnet"`), one per slice, all in one message so they run in parallel. Group the applicable lenses into at most five slices. Each brief carries: the system map, the job paragraph, the lens names it owns, and the instruction to apply the `greenfield` rubric. In Codex, which does not load Claude agents, start fresh native subagents with the [code-auditor definition](../../agents/code-auditor.md) as their brief. Slices are by lens, never by directory, so every agent may read the whole repo; the tree is read-only, so nothing collides.

The audit is done when every applicable lens has at least one record and every top-level directory from the map is covered by some record.

## 3. Verify

Records lie in two ways: evidence that does not say what the record claims, and fences nobody looked for. Check every `change`, `remove`, and `add` record:

- Open its `today` evidence and confirm it.
- Fill or confirm `fence` from history.
- Drop a record whose gain you cannot state in one sentence.
- Merge records from different lenses that propose the same change.

After a fan-out, run this step in one fresh `code-auditor` (`model: "sonnet"`) with the merged records and the instruction to return each one as confirmed, corrected, or rejected with a reason. Its verdicts are inputs; you make the final call on each record.

Done when every surviving record has confirmed evidence and a filled `fence`.

## 4. Design

From the surviving records, draw the greenfield target:

- A **today** diagram and a **greenfield** diagram of the same system at the same zoom, so the reader can diff them by eye.
- A **migration path**: the change, remove, and add records ordered into three waves. **Now** is high impact at cost S, each doable in one PR. **Next** needs a few PRs. **Bets** are cost L, or only reachable by a rebuild; each bet states the evidence that would justify it.
- A **scorecard**: each applicable lens scored out of 10 for today, with one line on why.

Every change, remove, and add record lands in exactly one wave.

## 5. Report

Publish the report with the `principle-html-communication` skill. If it is not installed, write the same report as one self-contained HTML file and give its path. Sections, in order:

1. **Verdict**: three sentences. Is this system worth evolving, or worth rebuilding, and the single change that matters most.
2. **Scorecard**: lens, score, one line.
3. **Today versus greenfield**: the two diagrams side by side.
4. **Impact versus cost**: a chart of the change, remove, and add records.
5. **Migration path**: Now, Next, Bets, each record with its `today`, `greenfield`, and `why`.
6. **Keep**: the decisions you would make again, and why.
7. **Per lens**: every record, grouped by lens, with evidence links.
8. **Open questions**: decisions only the user can make, such as product direction, team size, or a budget that would change a bet.

Before publishing, validate every Mermaid block against Mermaid 11 and quote any label containing `@`, `(`, `:`, or `/`.

Report the URL. Then offer to file the Now and Next waves as GitHub issues through the `file-issues` skill, which owns labels, the template, and the confirmation step. Skip the offer when the repo has no GitHub remote.
