---
name: cleanup
description: Audit a repo's test suite and code for waste, then remove it and open a PR with before/after stats. Deletes redundant and overlapping tests, dead code, and tests that exist only to exercise dead code; moves tests to the right layer; brings docs up to date. Use when the user says "cleanup", "clean up the tests", "trim the test suite", "remove dead code", or "prune the codebase".
disable-model-invocation: true
---

# Cleanup

Make the repo smaller without making it less safe. Every removal must be justified, and coverage must not drop.

## 1. Baseline

Start from a clean tree on a fresh branch off the latest default branch (`git fetch && git switch -c chore/cleanup origin/<default>`). Stop if the tree is dirty.

Find the repo's own commands for tests and coverage (Makefile, package.json scripts, CI workflows, CONTRIBUTING). Use those, not ad hoc ones, so the numbers match what CI reports. Record into `/tmp/cleanup-baseline.md`:

| Metric | How |
|---|---|
| Test lines | `wc -l` over test files (e.g. `*_test.go`, `*.test.ts`, `*.spec.*`, `test_*.py`) |
| Test files | count of the same set |
| Test cases | the runner's reported case count (`go test -json`, `vitest --reporter=json`, `pytest --collect-only -q`) so table cases and subtests count; if the runner can't report it, grep declarations and label the row "test functions" |
| Production lines | `wc -l` over non-test source, excluding generated and vendored code |
| Coverage | the repo's coverage command; note which scope it measures |
| Coverage floor | the enforced threshold in config or CI, if any |
| Test time | wall time of the full test run, or summed per-package time |

If the suite is failing before you touch anything, stop and report. Cleanup on a red baseline proves nothing.

## 2. Audit

Read the tests alongside the code they cover. For large repos, fan out `code-auditor` subagents with the `cleanup` rubric, one per directory with disjoint ownership. They return findings only; you make the edits.

Look for:

- **Dead code.** Unexported or unreferenced functions, types, constants, files, flags, and endpoints. Confirm with a repo-wide search (including reflection, string lookups, config, codegen inputs, and public API surface) before calling anything dead. Exported symbols in a library are live unless you can prove no consumer exists.
- **Tests of dead code.** A symbol whose only caller is a test is a candidate. If it passes the same liveness checks as other dead code, remove the symbol and its tests together.
- **Overlapping tests.** Several tests asserting the same behavior through the same path; table cases that differ only in irrelevant inputs; the same rule tested at unit, integration, and e2e level. Keep the one at the right layer and fold distinct cases into a table.
- **Worthless tests.** Tests that assert on mocks rather than behavior, snapshot the implementation, test the language or framework, only check "does not throw", or are skipped/commented out with no plan.
- **Wrong layer.**
  - Unit tests cover one unit of logic in isolation. No network, database, or filesystem. Business rules and edge cases live here.
  - Integration tests prove wiring: queries run against a real database, handlers decode and route, adapters talk to real dependencies. They should not re-test business rules case by case.
  - E2E tests cover a few critical user journeys, not permutations.
  Move a test to its correct layer, or delete it if that layer already covers it.
- **Stale docs.** READMEs, CLAUDE.md/AGENTS.md, ADRs, API docs, and code comments that describe removed code, old commands, renamed files, or behavior that no longer holds.

## 3. Remove

Work in small commits grouped by theme (dead code, duplicate tests, layer moves, docs) so a reviewer can revert one without the rest.

After each group:

1. Build and run the full suite. Fix or revert anything that breaks.
2. Rerun coverage. If it dropped, find the lines that lost coverage and either restore a test at the right layer or confirm the lines were deleted as dead code.

Do not rewrite production logic beyond deleting dead code. Refactors belong in a different PR.

If coverage now sits comfortably above the enforced floor, raise the floor to just under the new figure so the gain is locked in. Only do this when the floor lives in the repo.

## 4. Verify

Rerun every baseline metric with the same commands. Coverage must be equal or higher. If it is lower, keep working or revert until it is not; never open the PR with a drop.

Re-read every doc touched by the diff and grep docs for names you removed.

## 5. Open the PR

Rebase onto the latest default branch, push, and open a ready (not draft) PR following the repo's title conventions, e.g. `chore(tests): remove redundant tests and dead code`. Use the `create-pull-request` skill from the `git` plugin when it is installed.

Body: one or two sentences on what changed, then the stats table, then a short list of what was removed and why, grouped by theme.

```markdown
|  | Before | After |
|---|---|---|
| Test lines | 51,504 | 44,519 |
| Test files | 124 | 122 |
| Test cases (runner) | 1,231 | 1,001 |
| Production lines (non-test) |  | -33 |
| Coverage (`make coverage`) | 76.1% | 76.5% |
| Coverage floor (`COVERAGE_MIN`) | 68% | 75% |
| Test time | ~92s | ~58s |
```

Name the language and the exact coverage command in the row labels. Show the production row as a delta. Leave out rows that do not apply (e.g. no enforced floor) rather than filling them with placeholders.

Report the PR URL to the user with the headline numbers.
