#!/usr/bin/env bash
# PreToolUse guard: refuses commits and pushes on the default branch, and force
# pushes that aren't lease-protected. Exit 2 blocks the tool call and returns the
# message on stderr to the agent.
#
# Fails open: anything it can't determine (no jq, not a repo, no default branch)
# is allowed through rather than wedging legitimate work.
set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

cmd=$(jq -r '.tool_input.command // empty')
[[ "$cmd" == *git* ]] || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

block() {
  printf '%s\n' "$1" >&2
  exit 2
}

is_push=false
is_commit=false
[[ "$cmd" =~ git[[:space:]]+push ]] && is_push=true
[[ "$cmd" =~ git[[:space:]]+commit ]] && is_commit=true
[[ "$is_push" == true || "$is_commit" == true ]] || exit 0
[[ "$cmd" == *--dry-run* ]] && exit 0

# --force-with-lease is deliberately allowed: it fails instead of clobbering.
if [[ "$is_push" == true && "$cmd" =~ (--force([[:space:]]|$)|[[:space:]]-f([[:space:]]|$)) ]]; then
  block "Blocked: unguarded force push. Use --force-with-lease so the push fails instead of overwriting someone else's commits."
fi

target=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0

# An explicit refspec decides the target, not HEAD: `git push origin feature`
# while sitting on main is pushing feature. Destination side of `src:dst` wins.
if [[ "$is_push" == true ]]; then
  read -r -a words <<<"$cmd"
  positional=()
  for word in "${words[@]:1}"; do
    [[ "$word" == git ]] && continue
    [[ "$word" == push ]] && continue
    [[ "$word" == -* ]] && continue
    positional+=("$word")
  done
  # A leading "+" on a refspec (`+main`, `+HEAD:main`) forces the update just like --force.
  for refspec in "${positional[@]:1}"; do
    [[ "$refspec" == +* ]] && block "Blocked: unguarded force push (+refspec). Use --force-with-lease so the push fails instead of overwriting someone else's commits."
  done
  refspec="${positional[1]-}"
  if [[ -n "$refspec" ]]; then
    target="${refspec##*:}"
    target="${target#refs/heads/}"
  fi
fi

default=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
if [[ -z "$default" ]]; then
  for candidate in main master; do
    if git show-ref --verify --quiet "refs/heads/$candidate"; then
      default="$candidate"
      break
    fi
  done
fi
[[ -n "$default" && "$target" == "$default" ]] || exit 0

if [[ "$is_commit" == true ]]; then
  block "Blocked: commit on the default branch ($default). Branch first: git switch -c <name>"
fi
block "Blocked: push to the default branch ($default). Push a feature branch and open a PR."
