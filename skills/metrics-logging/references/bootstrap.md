# Bootstrapping metrics & logging from scratch

Use this when the project does **not** yet have a metrics module, a logger module, or a Prometheus scrape route. After running through this once, switch back to the main SKILL.md flow for all subsequent additions — you should never need to re-run bootstrap in the same project.

## Picking locations

There are no mandatory paths. Pick locations that match the project's existing conventions — look at where other infrastructure-ish modules already live (e.g. if the project uses `lib/`, put them there; if it uses `src/server/`, put them there; if it's flat, use the root). Sensible defaults if the project has no strong convention yet:

- **Metrics module**: `lib/metrics.ts` or `src/metrics.ts`
- **Logger module**: `lib/logger.ts` or `src/logger.ts`
- **Scrape route**: `app/api/metrics/route.ts` for Next.js App Router, `pages/api/metrics.ts` for Pages Router

You'll also need an **app slug** — a short `kebab-case` identifier for the project that becomes the default label on every metric and the tag in every log line. Use the repo name or the package name.

## 1. Install dependencies

```bash
bun add prom-client
```

`prom-client` is the only runtime dependency. The logger has none — it's pure TypeScript on top of `console`.

## 2. Create the logger module

A structured logger with:
- Per-module context via `createLogger({ component })`
- Automatic redaction of known secret keys
- Log level filtering via `LOG_LEVEL` env var
- Test buffer mode for assertions in unit tests

```ts
export interface LogContext {
  component?: string;
  userId?: string;
  symbol?: string;
  [key: string]: unknown;
}

export interface Logger {
  info: (msg: string, ctx?: LogContext) => void;
  log: (msg: string, ctx?: LogContext) => void;
  warn: (msg: string, ctx?: LogContext) => void;
  error: (msg: string, err?: unknown, ctx?: LogContext) => void;
  debug: (msg: string, ctx?: LogContext) => void;
}

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const APP_NAME = "<app-slug>";

const SENSITIVE_KEYS = new Set([
  "privateKey",
  "secret",
  "password",
  "token",
  "apiKey",
  "authorization",
]);

let testBuffer: string[] | null = null;
let enableLogs = true;

export function setTestMode(enabled: boolean): void {
  testBuffer = enabled ? [] : null;
}

export function getTestBuffer(): string[] {
  return testBuffer ?? [];
}

export function setEnableLogs(enabled: boolean): void {
  enableLogs = enabled;
}

function getLogLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVELS) return env as LogLevel;
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getLogLevel()];
}

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string") return new Error(err);
  return new Error(String(err));
}

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      redacted[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      redacted[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function formatLogEntry(
  level: LogLevel,
  msg: string,
  baseCtx: LogContext,
  callCtx?: LogContext,
  err?: unknown
): string {
  const merged = { ...baseCtx, ...callCtx };
  const { component, userId, symbol, ...rest } = merged;

  const timestamp = new Date().toISOString();
  const parts = [
    timestamp,
    `[${APP_NAME}]`,
    `[${level.toUpperCase()}]`,
  ];

  if (component) parts.push(`[${component}]`);
  if (userId) parts.push(`user=${userId}`);
  if (symbol) parts.push(`symbol=${symbol}`);

  parts.push(msg);

  const redactedRest = redactSensitive(rest);
  if (Object.keys(redactedRest).length > 0) {
    parts.push(JSON.stringify(redactedRest));
  }

  if (err) {
    const error = toError(err);
    parts.push(`error=${error.message}`);
    if (error.stack) parts.push(`\n${error.stack}`);
  }

  return parts.join(" ");
}

const CONSOLE_METHODS: Record<LogLevel, "log" | "warn" | "error" | "debug"> = {
  debug: "debug",
  info: "log",
  warn: "warn",
  error: "error",
};

function emit(level: LogLevel, formatted: string): void {
  if (testBuffer) {
    testBuffer.push(formatted);
    return;
  }
  if (!enableLogs) return;
  console[CONSOLE_METHODS[level]](formatted);
}

export function createLogger(ctx: LogContext = {}): Logger {
  function logAtLevel(level: LogLevel, msg: string, callCtx?: LogContext): void {
    if (!shouldLog(level)) return;
    emit(level, formatLogEntry(level, msg, ctx, callCtx));
  }

  function logError(msg: string, err?: unknown, callCtx?: LogContext): void {
    if (!shouldLog("error")) return;
    emit("error", formatLogEntry("error", msg, ctx, callCtx, err));
  }

  return {
    info: (msg, callCtx?) => logAtLevel("info", msg, callCtx),
    log: (msg, callCtx?) => logAtLevel("info", msg, callCtx),
    warn: (msg, callCtx?) => logAtLevel("warn", msg, callCtx),
    error: logError,
    debug: (msg, callCtx?) => logAtLevel("debug", msg, callCtx),
  };
}
```

### Customizing for a new project

- Set `APP_NAME` to the app slug you picked — this shows up in every log line and gives grep/Loki queries a clear anchor.
- Add project-specific secret field names to `SENSITIVE_KEYS` up front (e.g. `seedPhrase`, `mnemonic`, `cookie`, `sessionId`) rather than discovering leaks later.
- Add new first-class `LogContext` slots (alongside `component`/`userId`/`symbol`) for fields you'll filter by constantly — they get pulled to the front of the line instead of into the trailing JSON blob. Remove `symbol` if the project isn't trading-related; replace it with whatever makes sense (`requestId`, `tenantId`, `jobId`, etc.).

## 3. Create the metrics module

A single shared `prom-client` registry with default labels and Node.js default metrics enabled. Add your app's metrics as named exports here — **never** instantiate a second `Registry`.

```ts
import { Registry, Gauge, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({ app: '<app-slug>' });
collectDefaultMetrics({ register: metricsRegistry });

// Example metrics — delete and replace with your own.
export const botRunning = new Gauge({
    name: 'bot_runtime_up',
    help: 'Whether the bot runtime is currently active (1=running, 0=stopped)',
    labelNames: ['bot_id'],
    registers: [metricsRegistry],
});

export const eventsProcessed = new Counter({
    name: 'events_processed_total',
    help: 'Total number of events processed, labelled by type',
    labelNames: ['type'],
    registers: [metricsRegistry],
});

export const requestDuration = new Histogram({
    name: 'request_duration_seconds',
    help: 'Duration of incoming requests in seconds',
    labelNames: ['route', 'method'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [metricsRegistry],
});
```

### Customizing for a new project

- Set the `app` default label to your app slug — this is how Prometheus/Grafana will group your series against other apps scraping into the same server.
- Keep `collectDefaultMetrics({ register: metricsRegistry })` — it gives you event loop lag, heap size, GC stats, and process CPU for free, all scoped to the same registry.
- Remove the three example metrics and add your real ones. Follow the naming and labelling rules in the main SKILL.md.

## 4. Create the scrape route

The Prometheus scrape endpoint. For Next.js App Router, put it at `app/api/metrics/route.ts`. For Pages Router, put it at `pages/api/metrics.ts` instead (a default-exported handler that writes the same body). `force-dynamic` prevents Next from caching the response — scrapers need fresh data on every pull.

```ts
import { NextResponse } from 'next/server';
import { metricsRegistry } from '<path-to-metrics-module>';

export const dynamic = 'force-dynamic';

export async function GET() {
    const metrics = await metricsRegistry.metrics();

    return new NextResponse(metrics, {
        status: 200,
        headers: {
            'Content-Type': metricsRegistry.contentType,
        },
    });
}
```

### Customizing for a new project

- Set the import path to wherever you put the metrics module (relative path, or a path alias like `@/lib/metrics` if the project has `tsconfig` `paths` configured).
- Do not add authentication gating unless your scraper supports it — Prometheus usually pulls unauthenticated from inside a private network. If the endpoint is public-facing, put it behind a reverse proxy with IP allowlisting rather than inside the route handler.
- Pages Router variant: `pages/api/metrics.ts` exporting a default handler that writes `await metricsRegistry.metrics()` with the same content type.

## 5. Configure Prometheus to scrape it

Add a scrape job to your Prometheus config pointing at `/api/metrics` on whatever host/port the Next app listens on:

```yaml
scrape_configs:
  - job_name: '<app-slug>'
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['localhost:3000']
```

## 6. Smoke test

With the dev server running:

```bash
curl -s http://localhost:3000/api/metrics | head -40
```

You should see `# HELP` and `# TYPE` lines for both the default Node metrics (`process_cpu_seconds_total`, `nodejs_eventloop_lag_seconds`, etc.) and any metrics you exported. If the output is empty or errors, the most common causes are:

- You created a second `Registry` somewhere and are exporting that instead of `metricsRegistry`
- The route's import path to `metrics.ts` is wrong (Next will 500 or return an empty body)
- You forgot `registers: [metricsRegistry]` on a metric declaration, so it's registered nowhere

Once the smoke test passes, bootstrap is done. From here on, follow the main SKILL.md for every new metric or logger — don't come back to this file.
