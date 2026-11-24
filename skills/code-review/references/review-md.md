# REVIEW.md — repo-level review policy

A repo may ship a `REVIEW.md` at its root. Triage fetches it at the head SHA and the workflow
script parses it; agents never interpret it. Every key is optional. Unknown keys are ignored.

```yaml
# Posting
nit_cap: 5                            # max nit threads per review; the rest are counted in Notes
block_on_missing_description: false   # true → a PR whose title/body fails the description check
                                      #   can only get a comment, never an approve
no_auto_approve: false                # true → never APPROVE in this repo; comment + human flag

# Eligibility
review_drafts: false                  # true → drafts are reviewed (still comment-only)
max_lines: 50000                      # additions + deletions above this are skipped, nothing posted; 0 disables

# Scope
skip_paths:                           # findings in these paths are dropped before verification
  - vendor/
  - "**/*.generated.ts"
  - src/legacy/

# Judgment
must_check:                           # repo invariants the finder verifies as domain rules
  - "MJML serializer and deserializer stay aligned: a toMjml change needs the matching mapping"
  - "undo/redo history stays bounded and immutable"
standards_skills:                     # named skills the post stage may cite for standards findings
  - vsai-vetsoft-typescript
```

Format: flat `key: value`. Lists as indented `- item` lines or inline `[a, b]`. `#` starts a
comment. Booleans accept `true`/`yes`/`on`.

What it cannot do: lower the evidence bar, skip verification, or suppress red findings. It shapes
scope and posting policy, not judgment.
