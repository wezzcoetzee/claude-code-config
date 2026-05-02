# Audit rubric

Evaluate each in-scope file against these five categories. Every finding needs a concrete harm story — if you can't explain what breaks, it's not a finding.

## 1. Security (prioritize this)

This is usually where critical findings live. Look for:

- **Missing authentication / authorization** — public API routes, absent session checks, no middleware gating protected endpoints
- **Secrets in source / config** — hardcoded keys, default credentials in `.env.example`, committed `.env` files
- **SSRF** — user-controlled URL, hostname, or path passed to `fetch` / `http.get` / `requests.get` without validation
- **Injection** — SQL, command, XSS, URL (template literals into URLs), LDAP, header injection
- **Broken crypto** — weak algorithms, keys validated lazily instead of at startup, reused IVs, missing auth tags
- **Input validation gaps** — request bodies accepted with only truthy checks, no schema validation at system boundaries (HTTP, queue consumers, file uploads)
- **Information disclosure** — stack traces / Prisma errors / internal hints returned in API responses
- **Missing rate limiting** on state-changing endpoints or expensive operations
- **CSRF** on state-changing endpoints in cookie-auth contexts
- **Unsafe deserialization** — `eval`, `Function()`, `pickle.load`, `unserialize`
- **Dependency confusion / supply chain** — suspicious deps, unpinned versions on critical packages

## 2. Bugs / correctness

Look for:

- **Division by zero** / `Infinity` / `NaN` leaking into business logic (especially financial code)
- **Race conditions** — shared state mutated from concurrent paths without serialization, read-check-write patterns
- **Error swallowing** — empty catch blocks, catch-and-continue where the state is now inconsistent
- **Off-by-one and boundary errors** — `<` vs `<=`, inclusive/exclusive date ranges
- **Unhandled promise rejections / floating promises**
- **Resource leaks** — unclosed connections, event listeners not removed, timers not cleared on cleanup
- **Incorrect state management** — half-initialized objects cached, broken cleanup paths, wedged singletons
- **Float precision on money / currency** — use `Decimal` / `BigNumber` for financial math

## 3. Clean code

Look for:

- **Naming** — vague or misleading identifiers, inconsistent conventions across modules
- **Function size** — functions doing too many things; unclear atomicity in multi-step operations
- **Duplicated logic** — same 3–5 step pattern copy-pasted across services
- **SOLID / DRY violations**, unnecessary abstractions, premature generality
- **Dead code** — commented-out blocks, unused imports, unreachable branches
- **Mixed abstraction levels** in a single function
- **Scattered tuning constants** — magic numbers spread across files when they belong together
- **Inconsistent conventions** — parameter naming (`_request` vs `request`), file naming, export style
- **`readonly` / `const` contracts silently violated** (e.g. `Object.assign` on a `readonly` field)

## 4. Performance

Look for:

- **N+1 queries** — loops that call a data source per iteration
- **Missing indexes** — queries filtering on unindexed columns, missing composite indexes for multi-column filters
- **Unbounded queries** — pagination without max date ranges, no limits on full-table scans
- **Sequential work that should be parallel** — `for-of` with `await` where `Promise.all` / `Promise.allSettled` applies
- **Unnecessary re-renders (React)** — missing `memo`, unstable references, derived state in `useState`
- **Large bundle imports** — importing entire libraries for one helper
- **Repeated expensive work** in a single request — calling `getAllMidPrices` or similar twice per handler

## 5. Accessibility (UI code)

Look for:

- Missing `alt` text on images and `aria-label` on icon-only buttons
- Keyboard navigation gaps — custom controls not reachable via Tab, missing `role`
- Color contrast below WCAG AA
- Missing semantic HTML (div soup where `nav`, `main`, `button` would work)
- Focus management gaps in modals, dialogs, and route transitions

## 6. Testing gaps

Look for:

- **Critical paths without tests** — emergency functions (close-all, rollback), money paths, auth flows
- **Missing error-path coverage** — happy-path tests only
- **Unit-only coverage where integration matters** — pure-logic utils covered, orchestration uncovered
- **Flaky patterns** — timing dependencies, shared mutable state, real network calls
- **Missing coverage for recently changed code** (check `git log --since="1 month ago"` for hot files)

## Scope exclusions

Skip generated / vendored content unless the user explicitly asks otherwise:

- `node_modules/`, `vendor/`, `.venv/`
- `dist/`, `build/`, `.next/`, `out/`, `target/`
- `generated/` (Prisma client, protobuf, codegen output)
- `coverage/`, `__snapshots__/`
- Lockfiles (`package-lock.json`, `bun.lock`, `yarn.lock`, `Cargo.lock`)
- Binary assets

## Severity calibration

Pitch severity by blast radius, not effort to fix:

- **Critical** — exploitable today, or can cause data / money / availability loss without unusual circumstances. Auth bypass, SSRF, injection, races in financial code, broken shutdown, `Infinity` in trading math.
- **Warning** — real defect or risk, but requires a specific trigger or doesn't directly cause loss. Weak validation, missing indexes that don't hurt yet, leaky error messages, missing tests on critical paths.
- **Low** — quality or maintainability issue. Duplicate aliases, scattered constants, inconsistent conventions, dead code.

If you're torn between two severities, pick the higher one. The user can downgrade during triage; they rarely go looking for upgrades.
