---
name: workflow-subagents-implementation
description: Use when the user has a plan, spec or staged task list and asks to implement it with subagents, fan out the stages, or run the plan as a workflow. Not for one-off parallel searches or reviews.
argument-hint: "[plan path | URL | text]"
---

# Workflow subagents implementation

You are the **lead**. Subagents implement **stages**; a skeptical verifier checks every stage; you route questions and own the final check of output against input. Invoking this skill is the user's opt-in to the Workflow tool.

The workflow script is `workflow.js`, beside this file. It is data-driven: you never edit it, you pass the plan to it as `args`.

## 1. Pin the input

Take the plan from the argument (file path, URL, or pasted text), or from the conversation when there is none. Ask for one if neither holds a plan.

Extract **requirements**: every outcome, acceptance criterion, and constraint the plan states, one per id (`R1`, `R2`, ...), in the plan's words. Constraints count ("keep the public API unchanged" is a requirement). Done when every sentence of the plan that states an outcome maps to an id.

Record the starting point (`git rev-parse HEAD`, `git status --short`) so the final diff is attributable.

## 2. Cut stages

A stage is a slice of work that ends in a checkable state:

```json
{
  "id": "api",
  "title": "Add the export endpoint",
  "goal": "What the stage delivers, in two or three sentences",
  "requirements": ["R1", "R3"],
  "files": ["src/routes/export.ts", "src/routes/export.test.ts"],
  "verify": "bun test src/routes/export.test.ts && bun run typecheck",
  "model": "sonnet",
  "dependsOn": ["schema"]
}
```

- **Owned files are disjoint.** Two stages that must touch one file are either chained with `dependsOn` or merged. Stages without a dependency between them run in parallel in the same tree.
- **Every requirement is covered** by at least one stage.
- **`verify` is concrete**: commands to run and observable results, never "works correctly".
- **`model`**: `sonnet` when the stage is fully specified and mechanical; `opus` when it needs design judgement, crosses subsystems, or the plan is thin there. Verifiers always run on Opus.
- **Few stages.** Each costs at least two agents. If the whole plan is one focused change, tell the user this skill is more ceremony than the task needs and offer to implement it directly.

Show the user the stage table (id, title, model, owned files, depends on) so ownership is stated up front, then run.

## 3. Run the workflow

```
Workflow({
  scriptPath: "<this skill's base directory>/workflow.js",
  args: { plan, requirements, stages, answers: {}, done: {} }
})
```

`plan` is the full input text, `requirements` maps id to text. The workflow returns one result per stage:

| status | meaning | your move |
|---|---|---|
| `done` | implemented and passed verification | copy the result into `args.done[id]` |
| `questions` | the subagent stopped before editing to ask | answer, add to `args.answers[id]` |
| `failed` | still rejected after the fix rounds | revise the stage or ask the human |
| `waiting` | a dependency is not done yet | nothing; it runs once the dependency does |

**Questions**: answer from the plan, the code, or earlier answers when they settle it. When they don't, ask the human with `AskUserQuestion`, batching questions across stages, passing the subagent's `options` through as choices. Store each as `{ question, answer }` under the stage id.

**Failures**: read the verifier's problems. Fix the stage definition (sharpen `goal`, split it, widen `files`, switch to `opus`) or take the blocker to the human. A failed stage has no entry in `done`, so it re-runs on the next pass.

Re-run with the same `scriptPath` and the updated `args` until every stage is `done`. Stages in `done` return immediately without spawning agents.

## 4. Verify output against input

This step is yours, not a subagent's. Re-read the original input, not only your requirements list: the list is a copy and can have lost something.

1. For every requirement, cite the evidence yourself: `file:line`, or command output. A stage verifier's pass is a lead, not proof.
2. Run the project's full checks (tests, typecheck, lint, build), not only the per-stage commands, since parallel stages were each verified against a moving tree.
3. Read the whole diff since the recorded starting point for edits outside every stage's owned files, leftover stubs or debug code, and changes the plan never asked for.
4. Review every `assumptions` entry from the stage results against the input. Keep the ones the plan supports; surface the rest to the user.

Close gaps directly when they are small; otherwise add a stage and re-run. Done when every requirement has evidence, every check is green, and every assumption is either backed by the input or raised with the user.

## 5. Report

- A table of requirement → met / not met → evidence.
- Assumptions made, and which ones need the user's call.
- Commands run and their result.

Leave the changes uncommitted unless the user asked for a commit or PR.
