---
name: code-review
description: Use when the user pastes one or more GitHub PR URLs and asks for a review, or runs `/code-review <pr-url>`. Launches one background review workflow per PR and posts the review to GitHub.
argument-hint: "<pr-url>... [--dry-run] [--force]"
model: haiku
---

# code-review

Slim dispatcher for the team's review engine. Parses PR URLs, launches one background Workflow
per PR, prints one status row per PR when the batch completes.

## Pre-conditions

- `gh auth status` succeeds.
- Claude Code's Workflow tool is available.

## Hard rules

- Do NOT review PRs in this session yourself. Always delegate to the workflow.
- Do NOT print or summarise review content (diffs, findings) to the conversation. Status lines only.
- Do NOT classify or pre-filter PRs here. The workflow triages.
- Do NOT block on a workflow. Launch all URLs in one message, return control to the user, and
  print the table when the completion notifications arrive.
- Do NOT re-launch a workflow already running for the same URL.
- Do NOT edit, patch or re-escape the staged script, and do NOT pass it inline via `script`.
  If the Workflow tool rejects it (`Script parse error`), report `failed: script-parse` for
  each URL and stop. A parse error is a plugin bug; CI parses the script the same way.

## Step 1: parse

Accept `https://github.com/<owner>/<repo>/pull/<n>` (trailing path or fragment allowed). Reject
anything else with a one-line error. Flags anywhere in the arguments: `--dry-run` (alias
`--preview`), `--force`. If no valid URL remains, print `No valid GitHub PR URLs provided.` and stop.

## Step 2: stage the script (once per batch)

The Workflow tool refuses a `scriptPath` inside the plugin cache, so copy `workflow.js` into the
working directory first. Run this block as ONE Bash call. `${CLAUDE_SKILL_DIR}` is substituted
when Claude Code loads this file; `CLAUDE_PLUGIN_ROOT` is not available here (it is only
substituted in plugin config such as hooks.json, and is never exported to Bash). If the
substitution did not happen, set `SKILL_DIR` to the "Base directory for this skill" path shown at
the top of this skill.

```bash
SKILL_DIR="${CLAUDE_SKILL_DIR}"
[ -d "$SKILL_DIR" ] || { echo "skill dir not resolved ('$SKILL_DIR'); set SKILL_DIR to the skill's base directory"; exit 1; }
PLUGIN_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
SRC="$SKILL_DIR/workflow.js"
[ -f "$SRC" ] || { echo "workflow.js not found at '$SRC'"; exit 1; }
mkdir -p .reviews
cp "$SRC" .reviews/code-review-workflow.js || exit 1
# Keep .reviews/ out of git status without touching the repo's .gitignore.
GIT_COMMON="$(git rev-parse --git-common-dir 2>/dev/null)"
if [ -n "$GIT_COMMON" ]; then
  mkdir -p "$GIT_COMMON/info"; touch "$GIT_COMMON/info/exclude"
  grep -qxF '.reviews/' "$GIT_COMMON/info/exclude" || echo '.reviews/' >> "$GIT_COMMON/info/exclude"
fi
echo "SCRIPT=$PWD/.reviews/code-review-workflow.js"
echo "PLUGIN_ROOT=$PLUGIN_ROOT"
```

Staging is unconditional so the copy always tracks the installed plugin version, and it
overwrites any copy a previous session hand-patched. A non-zero exit means staging failed:
report it and stop.

## Step 3: launch

For each URL, one Workflow call, all in a single message:

```
Workflow(
  scriptPath: "<SCRIPT from step 2>",
  args: { url: "<url>", pluginRoot: "<PLUGIN_ROOT from step 2>", dryRun: <bool>, forceFull: <bool> }
)
```

`pluginRoot` is how the workflow finds its reference files. Agents resolve as bare names
(`review-finder` etc.) from `~/.claude/agents`; pass `pluginName` too if they are installed
from a plugin. Omit `dryRun`/`forceFull` when false.

Each workflow returns `{ line, review? }`. Read `line` — the one status line below. `review`
is present only under `--dry-run` and holds the composed review that was not posted
(`{ event, body, inline_comments }`); ignore it unless you were asked to show the draft.

Status lines:

- `posted: approve` · `posted: approve: N nits` · `posted: comment: N findings`
- `dry-run: ...` (same shapes, nothing posted)
- `skipped: <reason>`: closed-or-merged, prototype, draft, bot-author, already-reviewed,
  base-merge-only, too-large, already-posted-at-head-sha.
- `failed: <reason>`

## Step 4: table

When all workflows in the batch have completed, print one row per PR, four columns, left
aligned, padded to the widest value in the batch. No header, no prose.

```
{repo}  #{number}  {outcome}  {duration}
```

| `line` | outcome cell |
|---|---|
| `posted: approve` | `approved` |
| `posted: approve: N nits` | `approved (N nits)` |
| `posted: comment: N findings` | `commented (N)` |
| `dry-run: <x>` | `dry-run: <x>` |
| `skipped: <reason>` | `skipped (<reason>)` |
| `failed: <reason>` | `failed (<reason>)` |

`duration` comes from the completion notification's `<usage><duration_ms>`: `{m}m{ss}s` when ≥60s,
else `{s}s`.

## Notes

- Stateless. Re-pasting a URL re-launches; the workflow SHA-skips at triage unless `--force`.
- A repo can shape the review with a root `REVIEW.md`; see `references/review-md.md`.
- If a stage fails partway, resume with `Workflow({ scriptPath, resumeFromRunId })` using the
  same staged path.
