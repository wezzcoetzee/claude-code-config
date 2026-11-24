#!/usr/bin/env bash
# Inventory the linked git worktrees under the given roots (default: $HOME): every worktree whose
# own path or whose repo's main worktree sits under a root. Prints a header, then one tab-separated
# line per registered worktree. Read-only: changes nothing.
# Written for the bash 3.2 that ships with macOS, so no associative arrays.
set -uo pipefail

if [ $# -eq 0 ]; then set -- "$HOME"; fi
roots=()
for root in "$@"; do roots+=("$(cd "$root" && pwd -P)") || exit 1; done
now=$(date +%s)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# A .git directory marks a main clone and a .git file marks a linked worktree. Both resolve to
# the repo's common dir, so a repo is found through either one, wherever the other lives.
{
find "${roots[@]}" -maxdepth 8 \
  \( -name node_modules -o -name Library -o -name .Trash -o -name .cache -o -name .npm \
     -o -name .bun -o -name .cargo -o -name .rustup -o -name .nvm -o -name .asdf \) -prune \
  -o -name .git -print -prune 2>/dev/null
# A root inside a repo has no .git below it, so resolve the root itself too.
for root in "${roots[@]}"; do echo "$root/.git"; done
} |
  while IFS= read -r dotgit; do
    git -C "$(dirname "$dotgit")" rev-parse --path-format=absolute --git-common-dir 2>/dev/null
  done | sort -u > "$tmp/repos"

default_base() {
  local base
  base=$(git --git-dir="$1" symbolic-ref -q --short refs/remotes/origin/HEAD) && { echo "$base"; return; }
  for base in origin/main origin/master main master; do
    git --git-dir="$1" rev-parse -q --verify "$base" >/dev/null && { echo "$base"; return; }
  done
}

# Prints OWNER/REPO for a GitHub remote, nothing otherwise.
github_slug() {
  git --git-dir="$1" config --get remote.origin.url 2>/dev/null |
    sed -nE 's#^(https://|ssh://git@|git@)github\.com[:/]([^/]+/[^/]+)$#\2#p' | sed 's/\.git$//'
}

PR_LIMIT=3000
JOBS=8

# When the bulk fetch was truncated, a branch missing from it gets its own lookup, so no-pr is
# always proven. unknown means gh failed; a repo with no GitHub remote has no PRs to find.
pr_status() {
  [ "$prs" = none ] && { echo unknown; return; }
  local states
  states=$(awk -F'\t' -v b="$1" '$1 == b { print $2 }' "$work.prs")
  if [ -z "$states" ] && [ "$prs" = partial ]; then
    states=$(gh pr list -R "$slug" --head "$1" --state all --json state --jq '.[].state' 2>/dev/null) || states=FAILED
  fi
  case "$states" in
    *OPEN*) echo open-pr ;;
    *MERGED*) echo merged ;;
    *CLOSED*) echo closed-pr ;;
    *FAILED*) echo unknown ;;
    *) echo no-pr ;;
  esac
}

in_scope() {
  local root
  for root in "${roots[@]}"; do
    case "$wt/" in "$root"/*) return 0 ;; esac
    case "$main_wt/" in "$root"/*) return 0 ;; esac
  done
  return 1
}

emit() {
  [ -n "$wt" ] || return 0
  if [ "$is_main" = yes ]; then is_main=no main_wt=$wt; return 0; fi
  in_scope || return 0

  local present=no dirty=no pushed=- creator=manual ref tip status
  [ -d "$wt" ] && present=yes
  case "$wt" in
    */.claude/worktrees/*) creator=claude ;;
    */.t3/worktrees/*) creator=t3 ;;
    */.codex/worktrees/*) creator=codex ;;
    */.cursor/worktrees/*) creator=cursor ;;
  esac

  ref=${branch:-$head}
  tip=$(git --git-dir="$common" log -1 --format=%ct "$ref" 2>/dev/null) || tip=$now

  if [ "$present" = yes ] && [ -n "$(git -C "$wt" status --porcelain 2>/dev/null | head -1)" ]; then
    dirty=yes
  fi

  if [ -n "$branch" ]; then
    pushed=no
    git --git-dir="$common" show-ref -q --verify "refs/remotes/origin/$branch" && pushed=yes
    status=$(pr_status "$branch")
    if [ "$status" != open-pr ] && grep -qxF "$branch" "$work.merged"; then status=merged; fi
  elif [ -n "$base" ] && git --git-dir="$common" merge-base --is-ancestor "$head" "$base" 2>/dev/null; then
    status=merged
  else
    status=no-pr
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$name" "$creator" "$present" "$wt" "${branch:-(detached)}" "$(( (now - tip) / 86400 ))" \
    "$dirty" "$pushed" "$locked" "$status" "$common"
}

inventory_repo() {
  common=$1 work=$2
  name=$(basename "${common%/.git}")
  name=${name%.git}
  base=$(default_base "$common")

  : > "$work.merged"
  [ -n "$base" ] && git --git-dir="$common" branch --format='%(refname:short)' --merged "$base" > "$work.merged" 2>/dev/null

  : > "$work.prs"
  prs=none
  slug=$(github_slug "$common")
  if [ -z "$slug" ]; then
    prs=local
  elif gh pr list -R "$slug" --state all --limit "$PR_LIMIT" --json headRefName,state \
      --jq '.[] | "\(.headRefName)\t\(.state)"' > "$work.prs" 2>/dev/null; then
    prs=full
    [ "$(wc -l < "$work.prs")" -ge "$PR_LIMIT" ] && prs=partial
  fi

  # The first block of `worktree list` is the main worktree (or the bare repo itself): never listed.
  is_main=yes wt= head= branch= locked=no
  while IFS= read -r line; do
    case "$line" in
      "worktree "*) wt=${line#worktree } ;;
      "HEAD "*) head=${line#HEAD } ;;
      "branch "*) branch=${line#branch refs/heads/} ;;
      locked*) locked=yes ;;
      "") emit; wt= head= branch= locked=no ;;
    esac
  done < <(git --git-dir="$common" worktree list --porcelain 2>/dev/null; echo)
}

# Repos run in parallel (the gh fetch dominates); each writes its own file so output never interleaves.
i=0
while IFS= read -r common; do
  i=$((i + 1))
  while [ "$(jobs -rp | wc -l)" -ge "$JOBS" ]; do sleep 0.2; done
  inventory_repo "$common" "$tmp/$i" > "$tmp/$i.out" &
done < "$tmp/repos"
wait

printf 'repo\tcreator\tpresent\tpath\tbranch\tage_days\tdirty\tpushed\tlocked\tstatus\tgitdir\n'
n=1
while [ "$n" -le "$i" ]; do cat "$tmp/$n.out"; n=$((n + 1)); done
