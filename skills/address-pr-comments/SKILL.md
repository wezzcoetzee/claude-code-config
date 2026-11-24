---
name: address-pr-comments
description: Use when the user asks to address, handle, or resolve PR comments or review threads.
allowed-tools: Bash(gh api:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr comment:*), Bash(git pull:*), Bash(git add:*), Bash(git commit:*), Bash(git push), Bash(sed -n:*), Read, Edit, Grep, Glob
metadata:
  harness: [claude, codex]
  platform: [darwin, linux]
  scope: fleet
argument-hint: "[pr]"
model: opus
---

Address unresolved review comments on a pull request. Use `gh api` for all GitHub interactions.

Fetch narrowly. Always filter API responses with `--jq` and read line windows rather than whole files — the raw payloads are mostly URLs and duplicated diff context, and a large PR will otherwise fill the context window before you have fixed anything.

## Step 1 — Sync and fetch state

If no PR number given, get it via `gh pr view --json number,url`. Then run in parallel:

- `git pull` to sync local code
- `gh pr diff {pr_number} --name-only` for the list of changed files
- Unresolved threads, via GraphQL (REST does not expose resolution state):

  ```bash
  gh api graphql -f owner={owner} -f repo={repo} -F pr={pr_number} -f query='
  query($owner:String!,$repo:String!,$pr:Int!){
    repository(owner:$owner,name:$repo){
      pullRequest(number:$pr){
        reviewThreads(first:100){ nodes{
          id isResolved isOutdated path line originalLine
          comments(first:20){ nodes{ databaseId author{login} createdAt body diffHunk } }
        } }
      }
    }
  }' --jq '[.data.repository.pullRequest.reviewThreads.nodes[]
    | select(.isResolved|not)
    | {id, path, line: (.line // .originalLine), isOutdated,
       stale_context: (if .line == null then .comments.nodes[0].diffHunk else null end),
       comments: [.comments.nodes[] | {id: .databaseId, author: .author.login, createdAt, body}]}]'
  ```

- Top-level review bodies (bot summaries live here, not in threads):

  ```bash
  gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews --paginate \
    --jq '.[] | {id, state, user: .user.login, submitted_at, body} | select(.body != "")'
  ```

The GraphQL `id` on each thread is the `threadId` for `resolveReviewThread` in Step 3 — keep it, and do not look it up again.

## Step 2 — Read just enough context

The threads returned are already unresolved; no further filtering is needed.

`isOutdated: true` means the comment's lines are no longer in the diff. Judge those from `stale_context` (the code as the reviewer saw it) and confirm against current code before acting — the concern may already be fixed.

For live threads, read a window around the comment rather than the whole file:

```bash
sed -n "$((line>40 ? line-40 : 1)),$((line+40))p" "$path"
```

Widen the window, or read the file in full, whenever the window is not self-contained — the comment turns on an import, a type definition, a caller elsewhere in the file, or the enclosing function is cut off. Never reply based on a window you had to guess at.

## Step 3 — Evaluate and address each comment

Verify every bot finding against the source before changing code. Be skeptical of comments that are vague, nitpicky, or subjective. Comments from `vetsoft-emu` and `copilot` warrant extra scrutiny — they are often nitpicky and not worth addressing.

For each unresolved thread, classify as **needs fix** or **needs discussion**, then act:

**Needs fix** (legitimate issue, bug, or improvement):
- Make the code change
- Reply to the thread explaining what you changed
- Resolve it, using the thread `id` from Step 1:
  ```bash
  gh api graphql -f query='mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }' -f id="<thread_id>"
  ```

**Needs discussion** (current code is correct or suggestion wouldn't improve it):
- Reply with a respectful explanation of why the current approach was chosen, acknowledging the reviewer's perspective
- Tag the commenter and ask them to resolve if satisfied
- Do NOT resolve these yourself

If ambiguous or unsure, ask the user before responding.

If a review bot leaves feedback you believe is not worth addressing, reply and resolve the comment. Format comments left on the user's behalf as:

```md
[MODEL-SLUG] RESPONDING ON BEHALF OF <GIT USER NAME>
-----
[actual reply]
```

## Step 4 — Commit, push, and report

If any fixes were made, stage only changed files, commit with "Address PR review comments", and push. Then summarize: how many fixed, how many responded to with reasoning, and any that need the user's input.
