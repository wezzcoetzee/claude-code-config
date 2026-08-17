---
name: create-pull-request
description: File a concise pull request. Use when the user asks to file, open or create a PR
---

# Create Pull Request

Open a well-formed GitHub PR that matches the repository's conventions and links its issues correctly.

## When to use

The user has committed work on a branch and wants to open it for review, or asks anything like "create a PR", "open a pull request", "raise a PR for this". If work isn't committed yet, commit it first (only when the user wants that) before continuing.

## Workflow

### 1. Gather context

Run these to understand the state of the branch:

```bash
gh pr view --json url,state,isDraft 2>/dev/null
git branch --show-current
git log --oneline origin/HEAD..HEAD 2>/dev/null || git log --oneline -10
git diff --stat origin/HEAD...HEAD 2>/dev/null || git diff --stat
```

If a PR already exists for this branch, stop and tell the user — update it rather than opening a duplicate.

Read the actual diff (`git diff origin/HEAD...HEAD`) so the PR description reflects what truly changed — not a guess. The diff tells you *what* changed; the user's original prompt tells you *why it mattered*. You need both.

### 2. Find the PR template

Look for the repository's template, checking these paths in order (GitHub recognizes all of them, case-insensitively):

- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/pull_request_template.md`
- `PULL_REQUEST_TEMPLATE.md`
- `docs/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/` (a directory of multiple templates — if present, pick the most relevant or ask the user)

```bash
ls .github/PULL_REQUEST_TEMPLATE.md .github/pull_request_template.md PULL_REQUEST_TEMPLATE.md docs/PULL_REQUEST_TEMPLATE.md 2>/dev/null
```

If a template exists, use it verbatim as the structure and fill in its sections from the diff. The repo's own template always wins over the default — it encodes that team's conventions.

If none exists, use the default template in `assets/default_template.md`.

### 3. Fill out the template

Populate the template honestly from the diff and commits:

- Check the boxes that apply (PR type, testing done). Don't check testing boxes for tests you can't confirm ran — leave them unchecked or note what's still needed.
- Only claim things the diff supports. An empty section is better than an invented one.

Open the description with a plain statement of the problem, drawn from the user's original prompt, then briefly explain the solution. Never lead with an inventory of what you deleted and renamed — that's the part a reviewer can read from the diff.

BAD
> ❌ Removed implicit workspace carry-over from every "new thread" entry point (cmd+n, sidebar v1/v2 buttons, command palette). New threads inherit only the project from context. Deleted `buildContextualThreadOptions`, `startNewThreadInProjectFromContext`, and the v1 sidebar's seed-context machinery.

GOOD
> ✅ Starting a new thread from an existing worktree silently ignored your "new worktree" default and reused the current one. Now new threads always take branch, worktree, and env mode from your configured defaults, and only inherit the project.

Close the body with a short line naming the model and harness that made the change.

### 4. Link issues so merging closes them

If the branch came from a GitHub issue, or the user mentions an issue number, wire up closing keywords so the issue auto-closes when the PR merges. Use GitHub's closing keywords, one issue per keyword:

```
Closes #123
Closes #456
```

To detect the issue, check the branch name (e.g. `feature/123-add-auth`, `fix/issue-456`) and ask the user if ambiguous. Put the `Closes #N` lines in the PR body (the default template has a `Closes #` line under Description for this). For multiple issues, use a separate `Closes #N` for each — `Closes #1, #2` does **not** close both.

### 5. Add a mermaid diagram when it clarifies

If the change has structure worth showing — a new flow, a sequence of calls, a state machine, a non-trivial architecture change — include a mermaid diagram in the description. It often explains a PR faster than prose. Skip it for small or purely textual changes; a diagram for a one-line fix is noise.

````
```mermaid
flowchart LR
    A[Client] --> B[New middleware]
    B --> C[Handler]
```
````

### 6. Create the PR

Push the branch and create the PR with `gh`. Write the body to a temp file to preserve formatting:

```bash
git push -u origin HEAD
gh pr create --title "<title>" --body-file /tmp/pr_body.md
```

Open a real PR, never a draft — review bots don't run on drafts.

Titles usually become the squashed commit message, so match the repo's convention (check recent PRs with `gh pr list --state all --limit 10` if unsure — e.g. Conventional Commits like `feat(auth): ...`). Within that convention, name the outcome rather than the mechanism:

BAD
> ❌ perf(server): negotiate permessage-deflate on the websocket

GOOD
> ✅ perf(server): cut websocket frame size by 70% with compression

After creation, show the user the PR URL. If they also asked you to watch it, continue with the `babysit-pr` skill.

## Notes

- If `gh` isn't authenticated (`gh auth status` fails), tell the user to run `gh auth login` rather than failing silently.
- Never invent test results or check boxes for work not done — a reviewer trusts the checklist.
- Match the existing repo conventions over personal preference: title style, label usage, base branch.
