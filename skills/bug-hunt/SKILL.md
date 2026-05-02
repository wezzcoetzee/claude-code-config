---
name: bug-hunt
description: Hunt for bugs and defects in a codebase — logic flaws, race conditions, memory leaks, security vulnerabilities, error-handling gaps, anti-patterns, and bad practices. Use when the user says "find bugs", "hunt bugs", "look for defects", "check for vulnerabilities", "review for bugs", "what could break", "scan for issues", or wants a defect-focused review (distinct from a general code-quality audit).
---

# Bug Hunt

Hunt for real defects in a codebase. Produce a severity-ranked report with `file:line` references and concrete fixes. Focus on things that could actually break, corrupt data, leak resources, or get exploited — not style or general quality (use `clean-code-audit` for that).

## Scope

If the user specifies files or directories, hunt those. Otherwise, hunt the changed files (`git diff --name-only HEAD`). If no changes exist, ask what to hunt.

## Bug Categories

### 1. Logic Flaws
- Off-by-one errors, wrong comparison operators (`<` vs `<=`, `==` vs `===`)
- Inverted conditionals, unreachable branches, dead code paths
- Incorrect boolean logic (`&&` vs `||`, missing parentheses with mixed operators)
- Incorrect loop bounds, missing base cases in recursion
- Wrong default values, fallthrough switch cases
- State machines that allow invalid transitions
- Math errors: integer division/truncation, overflow, floating-point equality, unit mix-ups

### 2. Concurrency & Race Conditions
- Shared mutable state accessed without synchronization
- TOCTOU (time-of-check / time-of-use) bugs
- Missing `await`, dangling promises, unhandled promise rejections
- Deadlocks, lock ordering issues, lock held across `await`/IO
- Non-atomic read-modify-write on shared data
- Event listeners or callbacks that can fire concurrently with stale closures

### 3. Memory & Resource Leaks
- Unclosed file handles, sockets, database connections, streams
- Event listeners / subscriptions / observers added without cleanup
- Timers / intervals never cleared (especially in component unmount paths)
- Unbounded caches, queues, or arrays that grow forever
- Circular references holding large object graphs
- React: stale closures in effects, missing cleanup functions, refs holding DOM after unmount

### 4. Security Vulnerabilities
- Injection: SQL, NoSQL, command, LDAP, XSS, template injection
- Path traversal, unrestricted file upload, SSRF
- Hardcoded secrets, credentials, tokens, or keys
- Broken auth: missing authorization checks, IDOR, session fixation
- Unsafe deserialization, prototype pollution, ReDoS
- Insecure crypto: weak algorithms, hardcoded IVs, `Math.random()` for security
- Missing input validation at trust boundaries
- CSRF on state-changing endpoints, missing rate limits on auth/expensive endpoints
- Sensitive data in logs, error messages, or client-exposed responses

### 5. Error Handling Gaps
- Empty `catch` blocks, swallowed errors, errors logged but not handled
- Generic `catch (e)` that hides specific failure modes the caller needs
- Missing error paths: assumed-success on network/IO/parse calls
- Throwing in places callers can't recover (constructors, destructors, event handlers)
- Errors that lose stack/context when re-thrown
- Promises without `.catch` or `try`/`await` wrapping
- Resources not released on the error path (no `finally` / `using` / `defer`)

### 6. Data Integrity & API Contract
- Missing null/undefined checks before dereferencing
- Unvalidated external data treated as trusted (API responses, env vars, user input)
- Type coercion bugs (`"0" == false`, `parseInt` without radix, `JSON.parse` without try)
- Mutating shared/frozen/props data
- Missing transactions across multi-step DB writes
- Pagination/limit assumptions that break at scale or with empty sets
- Time/timezone bugs: naive `Date`, DST, locale-dependent parsing
- Encoding bugs: mixing UTF-8/UTF-16, missing escaping at boundaries

### 7. Anti-Patterns & Bad Practices Likely to Cause Bugs
- `as any`, `@ts-ignore`, `// eslint-disable` hiding real issues
- Catching and re-throwing without context (loses debug info)
- God functions / classes where bugs hide in complexity
- Copy-pasted logic that's drifted (one branch fixed, others not)
- Magic numbers / strings used inconsistently across the codebase
- Conditional hooks, hooks in loops, mutating state during render (React)
- Mutable default arguments (Python), shared `[]`/`{}` defaults

## Workflow

1. Determine files in scope
2. Read all files in scope thoroughly — bugs hide in details, skim and you'll miss them
3. For each file, walk through every category. Trace data flow from inputs to outputs. Ask: "what input would break this?"
4. For each suspected bug, verify it's a real defect (not a false positive) by tracing how it could be triggered. If you can't construct a triggering case, demote or drop it.
5. Rank findings by severity:
   - **Critical**: exploitable, causes data loss/corruption, or crashes in production
   - **Warning**: real bug under realistic conditions, but bounded blast radius
   - **Suggestion**: latent issue, edge case, or hardening opportunity
6. Produce the report below

## Output Format

```markdown
# Bug Hunt Report

## Summary
[1-2 sentence overview. Risk level: 🟢 Low | 🟡 Medium | 🔴 High]
[Total findings: N critical, M warnings, K suggestions]

## Findings

### 🔴 Critical
- **[Category]** `file:line` — description of the bug and how it triggers. Fix: concrete suggestion.

### 🟡 Warning
- **[Category]** `file:line` — description of the bug and how it triggers. Fix: concrete suggestion.

### 🟢 Suggestion
- **[Category]** `file:line` — description and conditions. Fix: concrete suggestion.

## Recommended Next Steps
1. [Highest-impact fix]
2. [Second priority]
3. [Third priority]
```

## Rules

- Every finding MUST include `file:line` and a concrete fix
- Every finding MUST describe **how the bug triggers** — what input or sequence of events causes it. If you can't say, it's not a real finding.
- Skip categories with no findings — don't pad
- Prefer fewer high-confidence findings over many speculative ones. False positives erode trust.
- Don't flag style, naming, or general "could be cleaner" — that's `clean-code-audit`'s job
- Prioritize defects with user-visible, security, or data-integrity impact
