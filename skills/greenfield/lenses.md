# Greenfield lenses

The lenses the `greenfield` skill applies. Each asks the same question from a different side: if you built this part again today, knowing what the system has become, what would you choose? Every finding is a record in the format `SKILL.md` defines.

Leave line-level defects to `bug-hunt` and line-level quality to `clean-code`. A greenfield record is about a decision: a boundary, a tool, a pipeline, a pattern repeated across the codebase.

## Architecture

- Module boundaries: do they follow the domain, or the order things were built in? Where do changes ripple across many modules (check the churn hotspots)?
- Dependency direction: does core logic import framework, transport, or storage code?
- Deployable units: too many services for the team size, or one unit that should be two because their load, release cadence, or owners differ?
- Patterns repeated by hand in several places that a single abstraction or a platform feature now does.
- Layers that only pass calls through.

## Data and state

- Source of truth: is any fact stored in two places, or generated and also committed by hand?
- Storage choice against access pattern: relational data in a document store, a queue used as a database, files used as a cache.
- Schema shape: nullable columns that encode a state machine, JSON blobs hiding structure the code depends on.
- Migrations: reversible, ordered, and run the same way in every environment?
- Caches: what invalidates them, and what happens when they are wrong?

## Stack and dependencies

- Language, runtime, and framework: would you choose them again for this job today, and what would the switch actually buy?
- Dependencies the platform or standard library now covers.
- Abandoned, duplicated (two libraries for one job), or pinned far behind with no recorded reason.
- Toolchain sprawl: several package managers, formatters, or test runners doing one job.

## Performance

- Hot paths: the requests, jobs, or commands that run most or cost most. Is the work proportional to the input?
- Startup, build, and bundle size where users or developers wait on them.
- Work done on every run that could be done once: recomputation, refetching, rebuilding unchanged parts.
- I/O shape: chatty calls, N+1 access, missing batching or pagination.

## Reliability and observability

- When this breaks in production, how does anyone find out? Name the signal, or record its absence as an `add`.
- Logs: structured, with request or job correlation, free of secrets?
- Metrics and traces on the hot paths; alerts tied to user impact rather than to causes.
- Failure handling as a strategy: retries with backoff, timeouts, idempotency, dead-letter handling, graceful degradation.
- Health checks and what they actually check.

## CI/CD and release

- Pipeline duration and failure rate from the measurements in the map. What dominates the wall time?
- Caching, parallelism, and work skipped for unaffected paths.
- Flaky jobs: reruns in the run history, retries baked into config.
- Gates: does every check that blocks a merge catch real problems? Which real problems reach main uncaught?
- Release: versioning, changelogs, promotion between environments, rollback. Manual steps a script should own.
- Action and image pinning, token scopes, secrets exposure in workflows.

## Testing

- Shape: where the tests sit (unit, integration, end to end) against where the bugs and the churn are.
- Speed of the inner loop: how long from save to a trustworthy result?
- Fixtures and mocks: shared, realistic, and cheap, or hand-rolled per test and drifting?
- Tests that guard nothing: mocks asserting on mocks, snapshots of implementation, dead features kept alive.

## Developer experience

- Setup: steps from clone to a passing local run. Each manual step is a candidate for a script.
- One command per job (`dev`, `test`, `build`, `lint`), discoverable from the manifest.
- Conventions written down once and enforced by tools rather than by review.
- Agent-readiness: does `CLAUDE.md` or `AGENTS.md` give an agent the unwritten rules, and are its claims still true?
- Docs that restate the environment and have gone stale.

## Security and configuration

- Secrets: where they live, how they rotate, whether any sit in the repo or its history.
- Configuration: one validated source per environment, or env vars read ad hoc across the codebase?
- Trust boundaries: is input validated where it enters?
- Least privilege for services, tokens, and CI jobs.
- Supply chain: lockfiles committed, dependency updates automated, third-party actions pinned to a SHA.
