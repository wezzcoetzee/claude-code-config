---
name: full-stop
description: Use when the user says "full stop", even as a closing "Full stop." that reads like emphasis. Same as full-send, but stops with the PR ready to merge.
---

# Full Stop

Do the same work as [full-send](../full-send/SKILL.md), but stop with the PR ready for the user to
merge. Follow its steps, proof rules, testing permission, review and babysitting. Its merge
permission does not apply, and the rules below override it.

## No merging

You may commit, push, rebase, fix conflicts, and `--force-with-lease` this task's branch. Never
merge, enable auto-merge, enter a merge queue, push to the default branch, or delegate any of
those.

If the PR already has auto-merge on or sits in a merge queue, turn that off before you start and
check again before each push. Report that you did. If you cannot stop it merging on its own,
report that before going further.

## Stop at the gate

Use full-send's merge gate as the readiness check, on the final diff. Re-read the live PR (head,
base, checks, reviews, mergeability) and hand off with one verdict:

- **Ready to merge:** the gate passes. Leave the PR open.
- **Waiting on approval:** only a human approval is missing. Confirm that is the real blocker.
- **Blocked:** what stops it, what you tried, and what is needed. Ask as full-send describes.

Unwatch the PR before the handoff. Report the PR link, final head, verdict, proof, review outcome
and remaining risks, and state that the PR is still open and unmerged.
