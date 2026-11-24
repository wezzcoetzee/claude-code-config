---
name: full-send
description: Use when the user says "full send". Finish the work end to end, unattended, through to a merged PR.
---

# Full Send

The user is not watching this thread. They want the work done end to end without them, and your
updates go unread until long after you stop. You own the work from its current state to a merged
PR.

Only apply this when the user clearly asked for "full send". Otherwise do not assume this much
autonomy.

## What the request grants

- Merging the PR once the merge gate passes.
- Force-pushing the PR's own branch with `--force-with-lease` after a rebase.
- Running whatever tests Proof needs (the app, a dev server, browser automation, simulators,
  screenshots) without asking first, even where a project file says to ask. Rules about *how* to
  test still apply.

It grants nothing under "Asking the user" below, and it never bypasses a harness approval prompt.

## Steps

1. **Finish the change.** Make the smallest change that meets the goal. Fix the case that
   happened, not every case that could. If you are on the default branch, branch first.
2. **Prove it.** Get proof for every change (see Proof).
3. **Get review.** Run `consult-council` with `--no-merge`, and fix what it confirms.
4. **File the PR** with `create-pull-request`, rebased on the latest default branch. Add one
   line to the description saying how you proved the change.
5. **Babysit** with `babysit-pr`. Prove each fix before you push it.
6. **Merge** when the merge gate passes.
7. **Report** the PR link, merge commit, proof, and each decision you made for the user.

Stay active from step 1 to step 7. If you end your turn while checks or bots are pending, nobody
will prompt you again. Wait with the `babysit-pr` watcher so the PR wakes you. If you stop before
the merge, unwatch first.

## Proof

Proof is evidence you saw yourself in this session: command output, a reproduction, a screenshot.
Use the most direct kind the change allows:

- Reproduce the original failure, apply the fix, and watch the same reproduction pass.
- Run the checks the repo's CI runs (typecheck, lint, tests).
- Add one focused test that fails without the fix, when the behaviour has none and the repo has a
  test setup.
- For UI and runtime behaviour, run the app and look. Green mocked tests do not prove the user
  experience works.

If you cannot prove a change, you are not confident. Ask the user.

## Merge gate

All of these hold on the latest commit:

- Your proof covers every change in the diff.
- Required checks are green.
- Review bots have finished, and each finding is fixed or dismissed with a written reason.
- No human review still requests changes.
- The branch is up to date with the default branch and GitHub reports it mergeable.

Merge with the method the repo uses. If it uses a merge queue or auto-merge, stay until GitHub
reports the PR merged. Never use `--admin` or any other bypass of branch protection.

## Asking the user

A question in a normal message goes unseen and the thread looks finished. Ask with the harness's
question tool (`AskUserQuestion` in Claude Code, `request_user_input` in Codex), with the PR link,
the blocker and the options in the question itself, your recommendation first.

Ask only when you cannot continue alone:

- You cannot prove the change.
- The merge gate cannot pass and you cannot fix that yourself.
- The next step deletes data, touches production, changes things outside the repo, or closes a PR.
