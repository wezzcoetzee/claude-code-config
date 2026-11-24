---
name: fix-up-pr
description: Use when the user says "fix up this PR", "get my PR green", "make the PR mergeable", "the CI is failing on my PR", "my PR has conflicts", or asks to bring a branch up to date with main and pass checks. Does not merge the PR.
allowed-tools: Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr diff:*), Bash(gh pr ready:*), Bash(gh run view:*), Bash(gh run rerun:*), Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git fetch:*), Bash(git rebase:*), Bash(git merge:*), Bash(git add:*), Bash(git commit:*), Bash(git push), Read, Edit, Write, Grep, Glob
argument-hint: "[pr]"
model: opus
---

# Fix Up a Pull Request

Get the PR for the current branch into a mergeable, green state. Work through the phases in order. **Announce a short plan first, then work autonomously**, stopping only at the guardrails below.

## Guardrails — never cross without explicit confirmation

- **Never merge the PR.** Fixing up ≠ merging. Leave the final merge to the user.
- **Never force-push a shared branch** (anyone else has commits, or it's a protected/long-lived branch) without confirmation.
- **Confirm before any history rewrite** — rebase that force-pushes, squash, `commit --amend` on pushed commits, `reset`.
- **Stop and ask** when a conflict or CI failure needs a product/design/architecture decision, not a mechanical fix. Do not guess at intent.
- **Never fabricate a green result.** Report failures with the actual log output.

## Phase 0 — Establish state

Run in parallel:
- `gh pr view --json number,title,body,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,url` (if no PR, tell the user and stop)
- `git status` and `git log --oneline @{u}.. 2>/dev/null` (unpushed commits)
- `git fetch origin`

Determine the base branch from `baseRefName` (don't assume `main`). Determine if the branch is **shared**: check `git log origin/<branch> --format='%an' | sort -u` for authors other than the user — if any, treat as shared.

## Phase 1 — Sync with base branch (detect convention)

Detect the repo's convention rather than assuming:
- **Prefer rebase** if base-branch history is linear (few/no merge commits: `git log --merges origin/<base> -20` is sparse) and the branch is **not shared**.
- **Prefer merge** if history has regular merge commits, the branch is shared, or the repo config/CONTRIBUTING says so.

Then:
- **Rebase path:** `git rebase origin/<base>`. Force-push needs `--force-with-lease` — this is a history rewrite, so obey the guardrail (confirm if shared).
- **Merge path:** `git merge origin/<base>` — no force-push, safe for shared branches.

If already up to date, skip. If conflicts arise, go to Phase 2 before continuing.

## Phase 2 — Resolve merge conflicts by intent

For each conflicted file:
1. Read the full file and understand **both sides' intent** — what each change was trying to accomplish (use `git log` on both branches for context).
2. Resolve to preserve both intents. Never blindly take one side or delete code to make it compile.
3. If the correct resolution requires knowing product/design intent you don't have, **stop and ask**.

After resolving: build + run the affected tests **locally** to prove the resolution is correct before continuing (`git add` + continue rebase/merge only once it passes).

## Phase 3 — Fix CI in a loop (autonomous)

Loop until all required checks are green:
1. Wait with the `babysit-pr` waiter in checks-only mode, in the background, and act on its JSON
   line. Do not write your own poll loop or use bare `gh pr checks --watch`.
   ```bash
   node "${CLAUDE_SKILL_DIR}/../babysit-pr/scripts/pr-wait.mts" <pr> --checks-only
   ```
   Exit 0 is green, 1 lists `checks.failed`, 3 is a timeout, 4 is a `gh` error, 5 means the
   head moved or the PR closed, and 6 is a merge conflict (back to Phase 2). If `${CLAUDE_SKILL_DIR}` was not substituted, start from the
   "Base directory for this skill" path.
2. For each failing check: `gh run view <run-id> --log-failed` to read the actual failure.
3. Classify: **flake** (retry once via `gh run rerun --failed`), **real failure** (fix root cause), or **needs-a-decision** (stop and ask).
4. Fix the root cause in code. **Before pushing**, reproduce the check locally to avoid burning CI cycles — run the repo's lint, format, typecheck, and test commands (discover them from `package.json` scripts, `Makefile`, CI workflow files, etc.).
5. Push (plain `git push`; force only per guardrails), then re-poll.

Do not declare victory until `gh pr checks` shows every required check passing.

## Phase 4 — PR hygiene

- **Title & description match the current diff** — update if the scope drifted. If the repo has a PR template (`.github/PULL_REQUEST_TEMPLATE*`), ensure sections are filled.
- **Linked issue** — confirm the body references the issue it closes if one exists.
- **Mergeability** — re-check `mergeable` / `mergeStateStatus`; surface any blocking branch-protection requirements (required reviews, required checks, up-to-date requirement).
- **Draft status** — if the PR is a draft and now ready, suggest marking ready (`gh pr ready`) but let the user decide.

## Phase 5 — Test coverage check

Inspect the diff (`gh pr diff`) for new or changed product code. Flag any new logic that lacks corresponding tests — either add the tests or, if intent is unclear, list the untested paths for the user. Missing tests are a finding, not a silent pass.

## Final report

Summarize: sync method used, conflicts resolved, CI checks now passing (with evidence), hygiene fixes, and any test gaps or decisions still needing the user. State plainly what is done and what remains.
