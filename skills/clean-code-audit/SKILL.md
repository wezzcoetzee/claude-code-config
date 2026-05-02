---
name: clean-code-audit
description: Audit code against clean code principles, security, performance, accessibility, and testing gaps. Use when the user says "audit my code", "review code quality", "code audit", "check my code", or wants a comprehensive code quality assessment.
---

# Clean Code Audit

Perform a comprehensive code audit across five categories. Produce a severity-ranked report with inline findings.

## Scope

If the user specifies files or directories, audit those. Otherwise, audit changed files (`git diff --name-only HEAD`). If no changes exist, ask what to audit.

## Audit Categories

### 1. Clean Code
- Naming: vague names, inconsistent conventions, misleading identifiers
- Function size: small, single-purpose, max ~3 params; flag functions doing too much
- File size: flag files past ~200-300 lines or mixing multiple concerns — should be split into smaller, focused, easier-to-test files
- Readability: a reader should be able to open a file and understand it without being overwhelmed
- SOLID violations, DRY violations, unnecessary abstractions (don't over-abstract either)
- KISS violations: over-engineered solutions; YAGNI violations: code built for hypothetical future needs
- Dead code, commented-out code, unused imports/variables
- Abstraction level mixing within functions
- Comments explaining WHAT instead of WHY (refactor for clarity instead)
- Type escape hatches: `as any`, `@ts-ignore`, empty catch blocks
- API endpoints with embedded business logic that should be extracted into testable services
- Simplification opportunities: nested conditionals that can flatten, loops that can become declarative (map/filter/reduce), redundant state, branches that collapse into one path
- Design pattern opportunities: replace sprawling switch/if-else dispatch with Strategy/polymorphism, complex object construction with Builder/Factory, tight coupling with Dependency Injection, repeated traversal with Iterator/Visitor, event fan-out with Observer/Pub-Sub, expensive recomputation with Memoization, conditional behavior toggling with State pattern. Only suggest a pattern when it concretely reduces complexity — never apply patterns for their own sake

### 2. Security
- OWASP top 10: injection (SQL, command, XSS), CSRF, broken auth
- Secrets or credentials hardcoded in source
- Unsafe deserialization, prototype pollution
- Missing input validation at system boundaries
- Insecure dependencies or configurations
- Missing rate limiting on public endpoints

### 3. Performance
- N+1 queries, missing database indexes
- Unnecessary re-renders (React: missing memo, unstable references)
- Large bundle imports (importing entire libraries for one function)
- Missing memoization for expensive computations
- Inefficient algorithms (O(n²) where O(n) is possible)
- Unbounded data fetching (no pagination/limits)

### 4. Accessibility
- Missing alt text on images
- Missing ARIA labels on interactive elements
- Keyboard navigation gaps
- Color contrast issues
- Missing semantic HTML (div soup)
- Missing focus management in modals/dialogs

### 5. Testing Gaps
- Untested edge cases (null, empty, boundary values)
- Missing error path tests
- No integration tests for critical user flows
- Missing test coverage for recently changed code
- Flaky test patterns (timing dependencies, shared state)

## Workflow

1. Determine files in scope
2. Read all files in scope thoroughly
3. Analyze each file against all 5 categories
4. Rank findings by severity: Critical > Warning > Suggestion
5. Produce the report below

## Output Format

```markdown
# Code Audit Report

## Summary
[1-2 sentence overview. Overall health: 🟢 Healthy | 🟡 Needs Attention | 🔴 Critical Issues]

## Findings

### 🔴 Critical
- **[Category]** `file:line` — description. Fix: concrete suggestion.

### 🟡 Warning
- **[Category]** `file:line` — description. Fix: concrete suggestion.

### 🟢 Suggestion
- **[Category]** `file:line` — description. Fix: concrete suggestion.

## Recommendations
1. [Highest priority action]
2. [Second priority action]
3. [Third priority action]
```

## Rules

- Every finding MUST include `file:line` reference and a concrete fix
- Skip categories with no findings — don't pad the report
- Be specific: "rename `d` to `daysUntilExpiry`" not "use better names"
- Don't flag style preferences — focus on real problems
- Prioritize findings that could cause bugs, security issues, or user-facing problems
