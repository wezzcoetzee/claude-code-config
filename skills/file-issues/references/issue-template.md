# Issue template

Every issue body must use this exact shape. The template is part of the contract — it guarantees that any future reader (human or AI) can pick up an issue cold and know everything needed to act.

## Template

```markdown
## Summary
<What's wrong. 1–2 sentences. State the defect, not the background.>

## Location of code
<file:line — ideally with a short code snippet when it clarifies>

## Why it matters
<The concrete harm. Real USD loss? Data leak? Incorrect behavior in a specific scenario? Name the mechanism, not a vague "this is bad".>

## Suggested Fix
<A specific, implementable action. Name files, functions, or patterns. Include a code example if the fix is subtle.>
```

## Title format

- Prefix with `[Critical]`, `[Warning]`, or `[Low]`
- Imperative or declarative, not phrased as a question
- Under ~80 characters so GitHub doesn't truncate
- Name the problem, not the fix ("No authentication on any API route", not "Add authentication")

## Good examples

### Security finding

```markdown
## Summary
The `discordWebhookUrl` field is user-controlled and passed straight to `fetch()` without validation. Combined with the missing auth (see the auth issue), an attacker can set it to an arbitrary URL to probe internal services or cloud metadata endpoints.

## Location of code
- `src/notifications/notification.service.ts:92`
- `app/api/bots/[id]/notifications/test/route.ts:10`

## Why it matters
A caller creates or updates a bot with `discordWebhookUrl` set to `http://169.254.169.254/latest/meta-data/` (AWS metadata), `http://localhost:5432`, or a reachable internal admin panel. Every trade notification (or a deliberate call to `/notifications/test`) triggers a request to that URL. Response body is returned via `response.text()` in the error path and logged — exfiltration channel.

## Suggested Fix
Validate the URL at input time:
- Must be HTTPS
- Host must be exactly `discord.com` or `discordapp.com`
- Path must start with `/api/webhooks/`

Reject on `POST /api/bots` and `PUT /api/bots/[id]`. Do not log response body from webhook failures.
```

### Bug finding

```markdown
## Summary
`calculateProportionalSize` divides by `context.copyBalance` without guarding against zero. When the copy wallet has no balance, `ratio` becomes `Infinity` and the resulting order size is `Infinity`, which can bypass size checks and reach the exchange.

## Location of code
- `src/copy-trade/trade-sizing.utils.ts:17`

```ts
const ratio = positionValue / context.copyBalance;
const proportionalValue = ratio * context.botBalance;
const proportionalSize = (proportionalValue / context.price) * context.multiplier;
```

## Why it matters
- If `copyBalance === 0` → `ratio = Infinity`, `proportionalSize = Infinity`
- `isValidSize(Infinity)` returns `true`
- `validateMargin` returns `isValid: false` only coincidentally — this is luck, not protection

Price of 0 in `mids` has the same issue.

## Suggested Fix
Guard at the top of `calculateProportionalSize`:

```ts
if (context.copyBalance <= 0) {
  throw new Error("copyBalance must be positive");
}
if (!Number.isFinite(context.price) || context.price <= 0) {
  throw new Error(`Invalid price: ${context.price}`);
}
```

Callers should catch and skip the fill rather than trading.
```

### Cleancode finding

```markdown
## Summary
The `Logger` interface exposes both `log` and `info`, and both call `logAtLevel("info", ...)`. Two names for one behavior creates confusion.

## Location of code
- `src/bot/logger.ts:8-14` (interface)
- `src/bot/logger.ts:146-147` (factory wiring)

## Why it matters
Readers pause to check if `log` is subtly different from `info`. Callsites use both interchangeably, so grep for "info-level logs" misses half.

## Suggested Fix
Keep `info`, remove `log`. Migrate callsites:

```bash
rg -l '\.log\(' src/ app/ | xargs sed -i '' 's/\.log(/\.info(/g'
```

Update the `Logger` interface and `createLogger` to match.
```

## Bad examples (don't file issues like these)

### Too vague

```markdown
## Summary
Error handling could be improved.

## Location of code
Multiple files.

## Why it matters
Better error handling is good practice.

## Suggested Fix
Improve error handling across the codebase.
```

Nothing in this is actionable. No specific file, no concrete harm, no implementable fix.

### Style preference

```markdown
## Summary
Some files use arrow functions, others use function declarations.

## Location of code
Various.

## Why it matters
Consistency is nice.
```

Not a finding. Style preferences belong in lint rules, not issues.

### Effort-based severity

```markdown
## Title: [Critical] Rename `d` to `daysUntilExpiry` in helper
```

Renaming a variable is not critical regardless of how many places it appears. Critical is reserved for blast radius (money, data, security), not for how annoying the fix is.
