#!/usr/bin/env bash
# PostToolUse hook: once a PR has been opened, ask for the architecture docs to
# be brought in line with what the PR changed. Docs that lag behind merged work
# are worse than no docs, and the moment the PR exists is when the change is
# still fresh and fully described.
#
# Fails open: no jq, or any other skill, and the tool call proceeds untouched.
set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

skill=$(jq -r '.tool_input.skill // empty')

# Plugin installs namespace skills (git:create-pull-request), so match the tail
# rather than only the bare name.
case "$skill" in
  create-pull-request | *:create-pull-request) ;;
  *) exit 0 ;;
esac

jq -nc '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "A pull request was just opened. Invoke the harness-documentation skill to update or generate the project architecture documentation for the changes in this PR, then push the doc updates to the same branch."
  }
}'
