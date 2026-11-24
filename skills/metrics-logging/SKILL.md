---
name: metrics-logging
description: Use when the user asks to "add a metric", "track X", "instrument Y", "count Z", "measure latency", "add logging", "log this", "observe", "set up Prometheus", "set up metrics", or mentions Prometheus/Grafana/counters/gauges/histograms — even if they don't explicitly name the files. Also trigger when reviewing new features that lack observability.
---

# Metrics & Logging

This skill covers two modes:

1. **Extending existing infra** (the common case) — the project already has a metrics module, a logger module, and a Prometheus scrape route. Read them first, then add to them.
2. **Bootstrapping a new project** — none of these exist yet. Switch to `references/bootstrap.md` for the full from-scratch setup (dependency install, complete logger source, registry module, Next.js route, scrape config, smoke test), then come back here for every subsequent metric or logger.

### The three roles (not specific paths)

Every project instrumented with this skill has three logical pieces. The **file paths vary** — they're wherever the project happens to put them, which depends on its conventions. Don't assume any particular layout; discover it.

- **Metrics module** — holds a single shared `metricsRegistry` from `prom-client` and every metric exported as a named `const`. Might live at `src/metrics/metrics.ts`, `lib/metrics.ts`, `server/observability/metrics.ts`, etc.
- **Logger module** — exports a `createLogger(ctx)` factory producing structured, context-aware loggers with automatic secret redaction. Might live at `src/bot/logger.ts`, `lib/logger.ts`, `utils/log.ts`, etc.
- **Metrics scrape route** — a Next.js GET handler that returns `metricsRegistry.metrics()` in Prometheus text format. Usually at `app/api/metrics/route.ts` (App Router) or `pages/api/metrics.ts` (Pages Router).

### Finding them in an unfamiliar project

Before assuming anything, search:

```bash
# metrics module
rg -l "new Registry\(\)|from 'prom-client'" --type ts
# logger module
rg -l "createLogger|SENSITIVE_KEYS" --type ts
# scrape route
rg -l "metricsRegistry\.metrics\(\)" --type ts
```

If all three turn up results, you're in **extend** mode — use whatever paths you found and import from them. If any are missing, you're in **bootstrap** mode — go to `references/bootstrap.md`.

Once the infra exists: **never create a second registry, a second logger module, or a parallel metrics file** — everything lives in whatever locations the project picked. One registry, one logger factory, one scrape route.

## Adding a metric

All metrics are declared as top-level `export const` in the project's metrics module (wherever it lives) and registered against the shared `metricsRegistry`. Pick the right instrument first:

| Instrument | Use when | Example |
|---|---|---|
| `Counter` | Monotonically increasing total (events, errors, trades) | `fills_received_total` |
| `Gauge` | Point-in-time value that goes up and down | `wallet_balance_usd`, `bot_runtime_up` |
| `Histogram` | Distribution of durations or sizes (you want p50/p95/p99) | `trade_execution_duration_seconds` |

### Naming — match the existing conventions exactly

- `snake_case`, lowercase
- Counters end in `_total`
- Durations end in `_seconds` (never `_ms` — Prometheus convention is base units)
- Sizes end in `_bytes`
- No app prefix on metric names — the registry already applies `{ app: '<project-slug>' }` as a default label, so prefixing every name with the project slug is redundant. If you see legacy metrics that include one, don't propagate that pattern.

### Structure of a new metric

Every declaration follows this shape — match it verbatim, including `registers: [metricsRegistry]`:

```ts
export const ordersCancelled = new Counter({
    name: 'orders_cancelled_total',
    help: 'Total number of orders cancelled, broken down by reason',
    labelNames: ['symbol', 'reason'],
    registers: [metricsRegistry],
});
```

The `help` text is required and should be a full sentence describing **what is counted** and **how labels differentiate it** — this is what shows up in Grafana tooltips, so write it for the person staring at a dashboard at 2am.

### Labels — think before you add them

Labels create cardinality. Every unique combination of label values becomes a separate time series in Prometheus, and high-cardinality labels (user IDs, order IDs, wallet addresses, free-text error messages) will blow up memory on the scraper. Rules of thumb:

- **Good labels**: bounded enumerations — `symbol`, `action` (`buy`/`sell`), `reason` (a fixed set of strings you control), `dry_run`, `type`
- **Bad labels**: anything unbounded — order IDs, txn hashes, raw error messages, timestamps, user-supplied text
- If you're tempted to label by error message, label by a classified `reason` instead and log the raw message separately

When in doubt, fewer labels is safer — you can always split a metric later, but you can't easily un-explode cardinality.

### Histograms need buckets

Always define `buckets` explicitly. The defaults are almost never right for the thing you're actually measuring. For latencies in seconds, the existing `[0.1, 0.25, 0.5, 1, 2.5, 5, 10]` is a reasonable starting point; adjust based on what you expect p99 to look like. You want buckets straddling your SLO.

### Using a metric from application code

Import the specific metric (not the registry) and call it at the site of the event. Use whatever import path the project uses for its metrics module:

```ts
import { ordersCancelled, tradeExecutionDuration } from '<path-to-metrics-module>';

ordersCancelled.inc({ symbol, reason: 'insufficient_margin' });

const end = tradeExecutionDuration.startTimer({ action: 'buy' });
await placeOrder(...);
end();
```

Increment counters at the moment the event actually happens, not in a wrapper layer that might double-count or miss error paths. For histograms, prefer `startTimer()` over manual `Date.now()` math — it handles the math and label binding for you.

### Don't touch the scrape route

It already exports everything in the registry. Adding a new metric automatically flows through — no route changes needed. If you find yourself editing the `/api/metrics` route handler, you're probably doing something wrong (the exception is bootstrap mode, where you're creating it for the first time).

## Adding logging

Every module that needs to log creates its own logger with a `component` tag, so log lines are greppable and Grafana/Loki queries can filter by subsystem. Import from wherever the project's logger module lives:

```ts
import { createLogger } from '<path-to-logger-module>';

const logger = createLogger({ component: 'rebalancer' });
```

Create the logger **once at module scope**, not per-call. The `component` goes in the base context and is merged into every log line.

### Choosing a level

- `debug` — verbose detail useful while diagnosing a problem; off in prod by default (`LOG_LEVEL=info`)
- `info` — normal lifecycle events: "started", "connected", "aggregated N fills", "trade executed"
- `warn` — something unexpected but recoverable: retry, fallback path taken, rate limit hit
- `error` — a failure you want someone to see; always pass the underlying error as the second argument so the stack is preserved

### Calling the logger

The signature is `(msg, ctx?)` for `info`/`warn`/`debug` and `(msg, err?, ctx?)` for `error`. Put the human-readable message first, then structured fields in `ctx`:

```ts
logger.info('fill aggregated', { symbol, size, side });
logger.warn('websocket rate limit hit, backing off', { attempt });
logger.error('failed to place order', err, { symbol, orderId });
```

**Don't interpolate variables into the message** — that defeats the purpose of structured logging and makes the message un-aggregatable. Say `logger.info('order placed', { symbol, size })`, not `logger.info(\`order placed for ${symbol} size ${size}\`)`.

### Context fields

`LogContext` has first-class slots for `component`, `userId`, `symbol` — these get pulled to the front of the log line. Any other keys end up in a JSON blob at the end. Prefer adding contextual fields over stuffing them into the message.

### Secret redaction is automatic, but limited

The logger redacts known sensitive keys (`privateKey`, `secret`, `password`, `token`, `apiKey`, `authorization`) recursively. You still need to be careful:

- Don't spread an entire config or request object into `ctx` — only pass the fields you mean to log
- If you introduce a new kind of secret field, add it to `SENSITIVE_KEYS` in the logger module rather than relying on ad-hoc redaction at the call site
- Never log raw private keys, seed phrases, or signed transaction payloads, even redacted — just don't put them in `ctx` at all

### What to log, and what to meter instead

Logs and metrics serve different purposes, and new features usually want **both**:

- **Metric**: "how often / how fast / how many" — cheap to aggregate, bounded cardinality, for dashboards and alerts
- **Log**: "what exactly happened in this one instance" — high-detail, one line per event, for debugging after the fact

Example: when an order fails, increment `order_errors_total{symbol}` **and** log `logger.error('order rejected', err, { symbol, orderId, reason })`. The metric tells you there's a spike; the log tells you which orders and why.

Don't log on the hot path of a high-frequency event at `info` level — use `debug` for per-event detail and a counter for the rate. A tight loop logging at `info` will drown the log backend and slow the process down.

## Checklist when instrumenting a new feature

Before marking work complete, confirm:

1. New counters end in `_total`; durations in `_seconds`; histograms have explicit buckets
2. Label sets are bounded (no IDs, hashes, or free text as labels)
3. Each new metric has a descriptive `help` string
4. Every metric is registered via `registers: [metricsRegistry]` — not a new registry
5. Modules that emit events create a module-scope `createLogger({ component })` and use structured `ctx` fields rather than string interpolation
6. Errors are logged with the error object as the second argument so stack traces are preserved
7. No secrets are passed into `ctx`, and any new secret-shaped field has been added to `SENSITIVE_KEYS`
8. You did **not** edit the scrape route or create a second registry/logger module
