---
name: worktree-cleanup
description: Use when asked to find, list, audit, prune, or clean up worktrees, or to reclaim space left by agent runs.
argument-hint: "[path]"
---

# Worktree cleanup

Agents leave worktrees in several places, and most are invisible from wherever you are browsing:

| Creator | Path shape |
|---|---|
| manual | anywhere, usually a sibling of the main clone |
| claude | `<repo>/.claude/worktrees/<name>`, nested inside the main clone |
| t3 | `~/.t3/worktrees/<repo>/t3code-<hash>` |
| codex, cursor | `~/.codex/worktrees/...`, `~/.cursor/worktrees/...` |

Agent runs often delete the working directory but leave the registration in `<repo>/.git/worktrees/<id>` and the branch in `refs/heads`. Those **orphans** are usually the bulk of the mess, and only `git worktree list` sees them, so the inventory always enumerates from each repo, never from the filesystem alone.

Both scripts live in `scripts/` beside this file.

## 1. Inventory

Run `scripts/inventory.sh [root ...] > <scratchpad>/worktrees.tsv`. With no root it scans all of `$HOME`, which is "across the machine" (a full scan takes a couple of minutes: most of it is one `gh pr list` per repo). A root the user names limits the rows to worktrees under it, or to every worktree of a repo whose main clone is under it.

One tab-separated row per registered worktree:

```
repo  creator  present  path  branch  age_days  dirty  pushed  locked  status  gitdir
```

- `present=no` is an orphan: the directory is gone, so `dirty` is always `no`.
- `age_days` is the age of the branch tip.
- `dirty` counts untracked files too, but not ignored build output.
- `pushed` is whether `origin/<branch>` exists; `-` for a detached HEAD.
- `status` is `merged` (in the default branch, or its PR merged, which catches squash merges), `open-pr`, `closed-pr`, `no-pr`, or `unknown` (`gh` failed, so nothing is proven).

Report the per-repo counts first (registered, present, orphan) so the scale is visible before any list, and give the path of the saved inventory.

## 2. Classify

Sort every row into one bucket, checked in this order:

1. **Orphan**: `present=no` and not locked. Recommend removing all of them, whatever their age or status: there is no working tree to lose.
2. **Hold**: dirty, locked, `open-pr`, `unknown`, under 14 days old, or containing the current directory. List these; they are not touched.
3. **Safe**: clean, and `merged` or `closed-pr`. Recommend removing.
4. **Stale**: clean, `no-pr`, 14 days or older. Recommend removing the worktree. Name the branches with `pushed=no` individually: their local branch is the only copy of that work, so they are kept unless the user approves deleting them by name.

When a bucket passes 20 rows, collapse it by repo (`my-app: 180 safe`) and keep the saved inventory as the full list. Always list Hold rows and never-pushed Stale branches line by line.

Ask which buckets, or which individual rows, to remove. Removing everything recommended is the default the user can accept in one answer.

## 3. Remove

Filter the approved rows out of the inventory and pipe them to `scripts/remove.sh`. Pass `--delete-unpushed` only when the user approved deleting never-pushed branches.

```bash
awk -F'\t' '<approved rows>' worktrees.tsv | scripts/remove.sh
```

The script:

- prunes the orphans with one `git worktree prune` per repo, which drops every dead registration in that repo at once;
- runs `git worktree remove --force` on each present worktree, since agents leave ignored build output behind;
- deletes the branch when it is `merged`, `closed-pr`, or pushed `no-pr`, and keeps `open-pr`, `unknown`, and never-pushed branches;
- re-checks each worktree just before removing it and skips any that is dirty now, locked, or holds the current directory, whatever was approved. A live run may have started writing since the inventory.

An approved Hold row the script skipped goes back to the user on its own, naming what it holds.

Leftover empty `~/.t3/worktrees/<repo>` and `<repo>/.claude/worktrees` directories are safe to `rmdir`. The worktrees root itself stays: a live run may hold a sibling.

Deleted branches leave their objects in the pack. Offer `git --git-dir=<gitdir> gc --prune=now` only for repos that lost more than 20 branches, and run it only when the user wants the space back, since it takes minutes on a large repo.

Done when every approved row has a result line and every skip is explained.

## 4. Report

Per repo: orphans pruned, worktrees removed, branches deleted, and `git --git-dir=<gitdir> worktree list | wc -l` afterwards. Then every row that was skipped or failed, with the reason.
