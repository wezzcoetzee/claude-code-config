# Triage (Stage 0)

You are triaging a single GitHub PR for review. Do NOT review it. Return only TRIAGE_SCHEMA JSON.
You report facts. The workflow script computes every skip and routing decision from them.

## 1. Fetch everything — ONE Bash call

Parse `{owner}`, `{repo}`, `{number}` from the URL, substitute them, and run the whole block as a
single Bash call. Every Bash call is a fresh shell; splitting this loses `$me`, `$REV` and the
temp files.

```bash
set -u
O="{owner}"; R="{repo}"; N="{number}"

echo "===PR==="
gh pr view "$N" --repo "$O/$R" --json id,number,title,body,isDraft,state,baseRefName,headRefOid,labels,additions,deletions,author

echo "===TOKEN_OWNER==="
me=$(gh api user --jq .login); echo "$me"

# Reviews fetched ONCE to a file (echo "$VAR" would mangle \n in bodies), reused four times.
REV=$(mktemp)
gh api "repos/$O/$R/pulls/$N/reviews?per_page=100" --paginate | jq -s 'add // []' > "$REV"

echo "===TOKEN_OWNER_REVIEW_SHA==="
jq -r --arg me "$me" '[.[] | select(.user.login==$me)
  | select((.body|length)>0 or .state=="APPROVED" or .state=="CHANGES_REQUESTED")][-1].commit_id // ""' < "$REV"

echo "===CTX_REVIEWS==="
jq -c '[.[] | {body: (.body | .[0:400]), state, author: .user.login, commit_id, submitted_at}][-15:]' < "$REV"

echo "===CTX_COMMENTS==="
gh api "repos/$O/$R/pulls/$N/comments?per_page=100" --paginate | jq -s 'add // []' \
  | jq -c '[.[] | {path, line, body: (.body | .[0:250]), author: .user.login}][-15:]'

echo "===FILES==="
gh api "repos/$O/$R/pulls/$N/files?per_page=100" --paginate --jq '.[].filename'

# Base-merge-only detection (Brooke): the PR's own {filename, blob sha} set vs base, at head
# and at the sha we last reviewed. Equal sets mean the author changed nothing since.
BASE=$(gh pr view "$N" --repo "$O/$R" --json baseRefName --jq .baseRefName)
HEAD=$(gh pr view "$N" --repo "$O/$R" --json headRefOid --jq .headRefOid)
PRIOR=$(jq -r --arg me "$me" '[.[] | select(.user.login==$me)
  | select((.body|length)>0 or .state=="APPROVED" or .state=="CHANGES_REQUESTED")][-1].commit_id // ""' < "$REV")
echo "===NET_HEAD==="
gh api "repos/$O/$R/compare/$BASE...$HEAD" --jq '[.files[] | {filename, sha}] | sort_by(.filename) | tojson' 2>/dev/null || echo ""
echo "===NET_PRIOR==="
if [ -n "$PRIOR" ] && [ "$PRIOR" != "$HEAD" ]; then
  gh api "repos/$O/$R/compare/$BASE...$PRIOR" --jq '[.files[] | {filename, sha}] | sort_by(.filename) | tojson' 2>/dev/null || echo ""
else echo ""; fi

# Repo policy file (Denny's REVIEW.md), verbatim. Empty when absent.
echo "===REVIEW_MD==="
gh api "repos/$O/$R/contents/REVIEW.md?ref=$HEAD" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null || echo ""

# Project docs tree (Wesley's docs-drift lens). Root doc files plus one level of docs/.
# When this comes back empty the script omits the lens entirely and no finder spends a
# call looking for a tree that is not there.
echo "===DOCS_TREE==="
gh api "repos/$O/$R/contents?ref=$HEAD" --jq '.[] | select(.type=="file") | .name | select(test("^(AGENTS|ARCHITECTURE)\\.md$"))' 2>/dev/null || true
gh api "repos/$O/$R/contents/docs?ref=$HEAD" --jq '.[] | "docs/" + .name + (if .type == "dir" then "/" else "" end)' 2>/dev/null || true

rm -f "$REV"
```

Everything below reads from that output. Do not re-run any of it. If a command fails, leave the
affected field `""` or omit it. Never invent a value.

**SUBSTANTIVE-REVIEW FILTER.** Only reviews with a non-empty body OR state `APPROVED` /
`CHANGES_REQUESTED` count as the token-owner's review. GitHub auto-creates empty `COMMENTED`
containers when someone replies to a thread; counting one causes a false already-reviewed skip.

## 2. Observed facts

From `===PR===`: `observed.state`, `observed.head_sha` = `headRefOid`, `observed.is_draft`,
`observed.title`, `observed.author` = `author.login`, `observed.author_is_bot` = true when
`author.is_bot` is true OR the login ends in `[bot]` OR starts with `app/` OR is one of
`dependabot`, `renovate`, `github-actions`. `observed.additions` / `observed.deletions` as
integers (omit if the fetch failed). `observed.labels` = label names.

`observed.token_owner` from `===TOKEN_OWNER===`.
`observed.token_owner_review_sha` from `===TOKEN_OWNER_REVIEW_SHA===`, copied verbatim. **Do not
re-derive it.** The already-reviewed skip rides on this field alone.
`observed.net_files_at_head` / `observed.net_files_at_prior` = the two JSON strings verbatim
(`""` when blank).

## 3. SHA logic (always compute)

- `head_sha` = `headRefOid`; `base_ref` = `baseRefName`.
- No token-owner substantive review → `review_mode: "full"`, `diff_base: origin/<baseRefName>`.
- One exists and differs from `headRefOid` → `review_mode: "incremental"`, `diff_base` = that sha.

## 4. Heavy triggers (always compute)

Report every trigger that fires in `heavy_triggers`, judged by what the code IS. Only three route
anything (`migrations-schema`, `auth-session`, `queue-worker` skip the light pass and bring in the
domain specialist); report the rest anyway.

| trigger | fires when |
|---|---|
| `size` | > 500 additions, OR > 10 files changed |
| `migrations-schema` | touches migrations, `*.sql`, or schema files |
| `auth-session` | touches auth/permission/session/token code |
| `queue-worker` | touches queue/worker/scheduler/job code |
| `new-export` | adds a new exported function with a non-trivial signature |
| `new-env-db-route` | adds a new env var, DB column, or HTTP route |

## 5. Tiny diffs: fetch the diff

If additions + deletions ≤ 15 AND files ≤ 2, run `gh pr diff {number} --repo {owner}/{repo}` and
return its output verbatim as `diff`. The script's express path reviews from it without a
worktree. Do not judge whether it qualifies; the script does.

## 6. Changed files

`files` = every line of `===FILES===`, verbatim.

## 7. Stated intent (Wesley's block)

From the title and body only, write 0 to 6 bullets in `stated_intent`, each a testable assertion
about what the PR claims the code now does ("adds idempotent retry on POST /orders", "captures a
full-page screenshot on test failure"). Phrase as claims to check, not summaries. Skip
motivation, ticket links and process notes. Empty body or pure template → `[]`.

## 8. Description quality (facts, not a verdict)

Set `description`:
- `generic_title`: title is "update", "fix", "WIP", a bare ticket id, or a branch-name dump.
- `body_empty_or_template`: body is empty, one line, or an unfilled template.
- `what_clear`: a reader can tell what changed from title + body without the diff.
- `why_clear`: the motivation is stated.
- `has_test_plan`: there is a test plan / verification section with at least one concrete step.

## 9. Policy file

`review_md` = the `===REVIEW_MD===` block verbatim, `""` when empty.

## 9b. Project docs tree

`docs_tree` = every line of `===DOCS_TREE===`, verbatim, in order (e.g.
`["AGENTS.md", "docs/design-docs/", "docs/generated/", "docs/SECURITY.md"]`). Omit the field or
return `[]` when the block is empty — that is the normal case for a repo with no docs tree, not a
failure. Do not invent paths and do not recurse further; the finder globs one level down if it
needs to.

## 10. PR context (for the post stage)

`pr_context`: `pr_node_id` = `id` from `===PR===` (node id, not the number); `title`, `body`,
`state`, `isDraft`, `labels` (names); `comments` = `===CTX_COMMENTS===`; `reviews` =
`===CTX_REVIEWS===`. If any of these calls failed, omit `pr_context` entirely; the workflow
fetches it with a fallback agent.

## Return

TRIAGE_SCHEMA only. No prose. Go straight to the structured call; do not draft the payload first.
