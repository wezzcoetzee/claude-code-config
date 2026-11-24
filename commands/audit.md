---
name: "audit"
description: "Audit a codebase for quality and defects, then file the findings as GitHub issues"
argument-hint: "[path | glob | diff-range]"
disable-model-invocation: true
---

Run the full audit pipeline over `$ARGUMENTS` (a path, glob, or diff range). If no argument was given, audit the changed files (`git diff --name-only HEAD`), and ask what to audit if there are none.

## 1. Scope

Resolve the argument to a concrete file list. Skip generated and vendored content: `node_modules`, `.next`, `dist`, `build`, `generated/`, `coverage`, `__snapshots__`, lockfiles. Read `CLAUDE.md`, `AGENTS.md`, or `README.md` first if present — they tell you the stack and which directories matter.

## 2. Audit

Apply both rubrics: the `clean-code` skill and the `bug-hunt` skill. They cover different ground and neither subsumes the other.

If the scope is larger than one context can hold well (roughly more than 30 files), split it by directory and fan out `code-auditor` subagents instead, one rubric and one slice per agent. They are read-only, so they can run in parallel safely. State which slice each one owns so they don't duplicate each other's findings.

## 3. Merge

Combine the findings into one list:

- Drop duplicates where both rubrics flagged the same line. Keep the version with the concrete trigger.
- Re-rank across the merged set. A cleancode finding never outranks an exploitable one, no matter which rubric found it first.
- Drop anything without a `file:line` and a triggering case.

## 4. Report

Present the merged findings grouped by severity, criticals first, each with location, impact, and fix.

## 5. File

Ask whether the user wants them tracked. If yes, invoke the `file-issues` skill and hand over the merged findings. That skill owns the labels, the issue template, and the confirmation checkpoint — do not call `gh issue create` from here.

Do not fix anything in this pipeline. An audit that edits as it goes leaves the user unable to review either the findings or the changes.
