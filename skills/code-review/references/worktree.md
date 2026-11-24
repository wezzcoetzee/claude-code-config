# Worktree (Stage 1 setup; teardown reused by the post stage and the finally block)

## Setup — return WORKTREE_SCHEMA

Given owner/repo/number and a diff base. Resolve the PR head yourself.

**Run this as ONE Bash call, exactly as written.** Variables do not survive between calls.
Substitute `{owner}`, `{repo}`, `{number}`, `{diff_base}` and run the whole block.

```bash
set -u
owner="{owner}"; repo="{repo}"; number="{number}"; diff_base="{diff_base}"

# Reuse a local clone only if its origin points at THIS repo.
main_clone=
for root in ${REVIEW_CLONE_ROOTS:-}; do
  if [ -d "$root/$repo/.git" ] && git -C "$root/$repo" remote get-url origin \
       | grep -qiE "github\.com[:/]$owner/$repo(\.git)?$"; then
    main_clone="$root/$repo"; break
  fi
done
if [ -z "$main_clone" ]; then
  # Key the cache by OWNER/repo, not repo alone. Repo names are only unique within
  # an owner, so `idexx-laboratories/api` and `someone-else/api` collided here and a
  # review could be run against a clone of the wrong organisation's code. The
  # REVIEW_CLONE_ROOTS branch above already verifies owner via the remote URL — this
  # fallback has to hold the same line.
  main_clone="/tmp/pr-review-${owner//\//-}-$repo-$number-clone"
  [ -d "$main_clone/.git" ] || gh repo clone "$owner/$repo" "$main_clone"
fi

cd "$main_clone" || exit 1
git fetch origin
# PR head into a PR-KEYED ref. Never FETCH_HEAD: it is one shared file and concurrent reviews
# of the same repo race on it (Denny's parallel-safety rule, Keith's recipe).
git fetch origin "+refs/pull/$number/head:refs/pr-review/$number"
head_sha=$(git rev-parse "refs/pr-review/$number")

wt="/tmp/pr-review-wt-${owner//\//-}-$repo-$number-${head_sha:0:8}"
git worktree remove --force "$wt" 2>/dev/null || true
git worktree prune
rm -rf "$wt"
git worktree add --detach "$wt" "$head_sha"

# Filtered diff, cached once for every later stage (Brooke's cache, Bailey's noise filter).
# Excludes lockfiles, vendored and generated code, build output, minified bundles, snapshots.
mkdir -p "$wt/.review"
base_resolved="$diff_base"
git -C "$wt" rev-parse --verify --quiet "$base_resolved^{commit}" >/dev/null || base_resolved="origin/$(git -C "$wt" rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's#^origin/##' || echo main)"
git -C "$wt" diff "$base_resolved...$head_sha" > "$wt/.review/pr.raw.diff"
NOISE='(^|/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|Gemfile\.lock|composer\.lock)$|(^|/)(vendor|node_modules|dist|build|out|\.next|target)/|\.min\.(js|css)$|\.(snap|map|pb\.go|generated\.[a-z]+)$|__snapshots__/|(^|/)generated/'
git -C "$wt" diff --name-only "$base_resolved...$head_sha" | grep -E "$NOISE" > "$wt/.review/filtered_out.txt" || true
if [ -s "$wt/.review/filtered_out.txt" ]; then
  git -C "$wt" diff "$base_resolved...$head_sha" -- . $(sed 's#^#:!#' "$wt/.review/filtered_out.txt") > "$wt/.review/pr.diff"
else
  cp "$wt/.review/pr.raw.diff" "$wt/.review/pr.diff"
fi

echo "MAIN_CLONE=$main_clone"
echo "HEAD_SHA=$head_sha"
echo "WT=$wt"
echo "DIFF_PATH=$wt/.review/pr.diff"
echo "RAW_LINES=$(wc -l < "$wt/.review/pr.raw.diff" | tr -d ' ')"
echo "FILTERED_LINES=$(wc -l < "$wt/.review/pr.diff" | tr -d ' ')"
echo "FILTERED_OUT_BEGIN"; cat "$wt/.review/filtered_out.txt"; echo "FILTERED_OUT_END"
```

Take every value from stdout; do not re-derive anything in a second call. If a `git fetch` or
worktree command fails with a lock or ref-contention error, another review of this repo is
running in the same clone: wait ~5 seconds and re-run the whole block once.

Return `{ ok: true, path, head_sha, main_clone, diff_path, raw_lines, filtered_lines,
filtered_out: [paths] }`, or `{ ok: false, error }` on any failure.

## Teardown (idempotent)

The caller passes the main clone path when known; otherwise re-derive it with the same
owner-keyed lookup as setup — deriving it from the repo name alone can land you in a
different owner's clone.
One Bash call:

```bash
cd "$main_clone" 2>/dev/null
git worktree remove --force "$wt" 2>/dev/null || true
git update-ref -d "refs/pr-review/{number}" 2>/dev/null || true
```

Always safe to call, even if already removed.
