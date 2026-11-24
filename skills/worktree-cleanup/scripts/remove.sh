#!/usr/bin/env bash
# Remove the approved worktrees: reads inventory.sh rows on stdin (header optional), one per approval.
# Prints one tab-separated line per action: path, branch, worktree result, branch result.
#
#   --delete-unpushed   also delete no-pr branches that were never pushed (the only copy of that work)
#
# Guardrails hold whatever the approval: a worktree that is dirty now, locked, or holds the current
# directory is skipped; open-pr and unknown branches are kept.
set -uo pipefail

delete_unpushed=no
[ "${1:-}" = --delete-unpushed ] && delete_unpushed=yes
here=$(pwd -P)
rows=$(mktemp)
trap 'rm -rf "$rows"' EXIT
grep -v $'^repo\tcreator\t' > "$rows"

holds_here() {
  case "$here/" in "$1"/*) return 0 ;; esac
  return 1
}

keep_branch() {
  local status=$1 pushed=$2
  case "$status" in
    merged | closed-pr) return 1 ;;
    no-pr) if [ "$pushed" = yes ] || [ "$delete_unpushed" = yes ]; then return 1; fi ;;
  esac
  return 0
}

# Orphans have no directory to remove: one prune per repo drops every dead registration at once.
awk -F'\t' '$3 == "no" { print $11 }' "$rows" | sort -u | while IFS= read -r gitdir; do
  git --git-dir="$gitdir" worktree prune >/dev/null 2>&1
done

while IFS=$'\t' read -r repo creator present path branch age dirty pushed locked status gitdir; do
  if [ "$present" = no ]; then
    wt_result=pruned
    git --git-dir="$gitdir" worktree list --porcelain | grep -qxF "worktree $path" && wt_result="still registered (locked?)"
  elif [ "$locked" = yes ]; then
    wt_result="skipped: locked"
  elif holds_here "$path"; then
    wt_result="skipped: current directory"
  elif [ -n "$(git -C "$path" status --porcelain 2>/dev/null | head -1)" ]; then
    wt_result="skipped: dirty now"
  elif err=$(git --git-dir="$gitdir" worktree remove --force "$path" 2>&1); then
    wt_result=removed
  else
    wt_result="failed: ${err%%$'\n'*}"
  fi

  br_result=kept
  if [ "$branch" = "(detached)" ]; then
    br_result="none (detached)"
  elif [ "$wt_result" != removed ] && [ "$wt_result" != pruned ]; then
    :
  elif ! keep_branch "$status" "$pushed"; then
    if git --git-dir="$gitdir" branch -D "$branch" >/dev/null 2>&1; then br_result=deleted; else br_result="failed: branch -D"; fi
  fi

  printf '%s\t%s\t%s\t%s\n' "$path" "$branch" "$wt_result" "$br_result"
done < "$rows"
