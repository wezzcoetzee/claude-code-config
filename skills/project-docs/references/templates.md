# Documentation Templates Reference

This file contains templates and guidance for every file in the project documentation tree.
Read the relevant section before generating or updating any document.

## Table of Contents

1. [AGENTS.md](#agentsmd)
2. [ARCHITECTURE.md](#architecturemd)
3. [docs/DESIGN.md](#docsdesignmd)
4. [docs/FRONTEND.md](#docsfrontendmd)
5. [docs/PLANS.md](#docsplansmd)
6. [docs/PRODUCT_SENSE.md](#docsproduct_sensemd)
7. [docs/QUALITY_SCORE.md](#docsquality_scoremd)
8. [docs/RELIABILITY.md](#docsreliabilitymd)
9. [docs/SECURITY.md](#docssecuritymd)
10. [docs/design-docs/](#docsdesign-docs)
11. [docs/exec-plans/](#docsexec-plans)
12. [docs/product-specs/](#docsproduct-specs)
13. [docs/generated/db-schema.md](#docsgenerateddb-schemamd)
14. [docs/references/](#docsreferences)

---

## AGENTS.md

Purpose: Define every AI agent that operates on this codebase — their roles, what they can and cannot do,
which docs they should read, and how they hand off work to each other.

```markdown
# Agents

## Overview

Brief description of how AI agents are used in this project and the general philosophy
(e.g., "Agents are specialized by concern. Each agent reads only the docs relevant to its
role to minimize context usage.").

## Agent: {Name}

### Role
One sentence: what this agent does.

### Responsibilities
- Specific task 1
- Specific task 2

### Boundaries
What this agent should NOT do. Be explicit — agents will attempt things outside their
scope unless told not to.

### Context docs
Which documentation files this agent should read before starting work:
- `ARCHITECTURE.md` — for system context
- `docs/SECURITY.md` — for auth constraints
- (list only what's relevant, not everything)

### Handoff protocol
When and how this agent hands off to other agents:
- "After generating a migration, hand off to the Review Agent with the migration file path"
- "If a security concern is found, flag it and stop — do not attempt to fix it"

## Agent: {Name 2}
(repeat structure)

## Inter-agent communication
How agents coordinate when multiple are involved in a workflow. Include sequence or flow
if helpful:
1. Planning Agent creates exec plan → saved to `docs/exec-plans/active/`
2. Coding Agent reads plan and implements
3. Review Agent audits the implementation against the plan
4. Planning Agent moves plan to `completed/`
```

Key guidance:
- Be very explicit about boundaries. The most common agent failure mode is scope creep.
- List context docs precisely. An agent reading everything wastes tokens; an agent reading nothing makes bad decisions.
- Include concrete handoff examples, not abstract protocols.

---

## ARCHITECTURE.md

Purpose: Give any reader (human or AI) a complete mental model of the system in under 5 minutes.
This is the single most important document — it's the first thing any agent should read.

```markdown
# Architecture

## System overview
2-3 sentences: what the system does, who it serves, and the core architectural style.

## Tech stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | e.g., Next.js 14 | SSR React app |
| API | e.g., FastAPI | REST + WebSocket API |
| Database | e.g., PostgreSQL 16 | Primary data store |
| Cache | e.g., Redis 7 | Session store + pub/sub |
| Queue | e.g., Celery + RabbitMQ | Async task processing |
| Hosting | e.g., Railway | Container deployment |

## High-level diagram
Describe the system topology in text or ASCII. Show services, data stores, and communication paths.

Example:
```
Client → CDN → Next.js (SSR) → API Gateway → Auth Service
                                            → Core Service → PostgreSQL
                                            → Worker Service → Redis (queue)
```

## Directory structure
Show the top-level project layout with brief annotations:

```
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # FastAPI backend
├── packages/
│   └── shared/       # Shared types and utilities
├── infra/            # IaC and deployment configs
└── docs/             # This documentation
```

## Key architectural decisions

### {Decision title}
- **Context**: What problem we were solving
- **Decision**: What we chose
- **Alternatives considered**: What else we looked at and why we didn't choose it
- **Consequences**: Tradeoffs accepted

(Repeat for each major decision. For detailed design docs, link to `docs/design-docs/`.)

## Data flow
Describe how data moves through the system for the primary use case(s). Be specific:
"User submits form → POST /api/orders → validated by Pydantic model → written to orders
table → event emitted to Redis → worker picks up event → sends confirmation email via SendGrid"

## Environment and deployment
- How environments are structured (dev, staging, prod)
- How deployments happen (CI/CD pipeline, manual steps)
- Key environment variables (names only, not values)
- Link to more detail: `See [RELIABILITY.md](docs/RELIABILITY.md)`

## Cross-references
- Detailed design decisions: `docs/design-docs/`
- Frontend specifics: `docs/FRONTEND.md`
- Security model: `docs/SECURITY.md`
- Database schema: `docs/generated/db-schema.md`
```

Key guidance:
- The tech stack table is critical. Agents use this to know which libraries/patterns are in play.
- The directory structure section prevents agents from creating files in wrong locations.
- Architectural decisions with context prevent agents from "improving" things that were intentionally chosen.

---

## docs/DESIGN.md

Purpose: Document the visual and interaction design system so agents producing UI code
make consistent choices.

```markdown
# Design System

## Design philosophy
What visual/interaction principles guide the product. E.g., "Minimal, content-first UI
with progressive disclosure. No modals — use inline expansion instead."

## Color palette
| Token | Value | Usage |
|-------|-------|-------|
| --color-primary | #2563EB | CTAs, active states |
| --color-surface | #FFFFFF | Card backgrounds |
| ... | | |

## Typography
| Role | Font | Size | Weight |
|------|------|------|--------|
| Heading 1 | Inter | 2rem | 700 |
| Body | Inter | 1rem | 400 |
| Code | JetBrains Mono | 0.875rem | 400 |

## Spacing system
Base unit and scale (e.g., 4px base: 4, 8, 12, 16, 24, 32, 48, 64).

## Component patterns
For each key component pattern, describe:
- When to use it
- Anatomy (what elements it contains)
- States (default, hover, active, disabled, error, loading)
- Do's and don'ts

## Responsive breakpoints
| Name | Min width | Behavior |
|------|-----------|----------|
| mobile | 0 | Single column, stacked nav |
| tablet | 768px | Side nav appears |
| desktop | 1024px | Full layout |

## Accessibility requirements
Minimum standards the project adheres to (e.g., WCAG 2.1 AA).
Specific patterns: focus management, aria labels, color contrast ratios.

## Cross-references
- Frontend implementation: `docs/FRONTEND.md`
- External design system reference: `docs/references/design-system-reference-llms.txt`
```

---

## docs/FRONTEND.md

Purpose: Frontend-specific architecture, patterns, and conventions that an AI coding agent
needs to write correct frontend code.

```markdown
# Frontend Architecture

## Framework and rendering
Framework, version, rendering strategy (SSR, CSR, SSG, ISR), and why.

## Project structure
```
src/
├── app/              # Route segments (App Router)
│   ├── (auth)/       # Auth-required layout group
│   ├── (public)/     # Public layout group
│   └── api/          # API routes
├── components/
│   ├── ui/           # Primitives (Button, Input, Card)
│   └── features/     # Domain components (InvoiceTable, UserAvatar)
├── hooks/            # Custom hooks
├── lib/              # Utilities, API client, constants
├── stores/           # State management
└── styles/           # Global styles, theme config
```

## State management
What's used (e.g., Zustand, React Query, Context) and when to use each.
Include concrete rules: "Server state → React Query. UI state → Zustand. Form state → react-hook-form."

## Data fetching patterns
How data is fetched (server components, client hooks, API routes) with examples.

## Routing conventions
Route naming, dynamic segments, layout nesting, middleware.

## Component conventions
- Naming: PascalCase files, named exports
- Props: TypeScript interfaces, destructured in signature
- Styling: how styles are applied (Tailwind, CSS modules, styled-components)

## Testing approach
What's tested, testing library, file naming, where tests live.

## Performance budgets
Any bundle size limits, loading time targets, Core Web Vitals goals.

## Cross-references
- Design system: `docs/DESIGN.md`
- Component library reference: `docs/references/design-system-reference-llms.txt`
```

---

## docs/PLANS.md

Purpose: High-level roadmap and current priorities. Agents read this to understand what's
being built next and what's deferred.

```markdown
# Plans & Roadmap

## Current priorities
What's being worked on right now, ordered by priority. Keep this short and current.

1. **{Feature/initiative}** — One-line description. Status: {in progress / blocked / planned}
2. ...

## Upcoming
What's next after current priorities are done. Less detail is fine here.

## Deferred
Things explicitly decided NOT to do right now, and why. This is important — it prevents
agents from building features that were intentionally postponed.

## Cross-references
- Active execution plans: `docs/exec-plans/active/`
- Product specs for planned features: `docs/product-specs/`
- Tech debt to address: `docs/exec-plans/tech-debt-tracker.md`

Last updated: {YYYY-MM-DD}
```

---

## docs/PRODUCT_SENSE.md

Purpose: Capture the product intuition that isn't in specs — the "why" behind product decisions,
user mental models, and the taste/judgment an agent needs to make good product calls.

```markdown
# Product Sense

## What this product is
One paragraph: what problem it solves, for whom, and why it matters.

## User mental models
How users think about the product. What concepts do they use? What metaphors apply?
E.g., "Users think of this as a 'digital notebook' — they expect autosave, freeform
organization, and instant search. They do NOT think of it as a database."

## Core user flows
The 3-5 most important things a user does, in priority order. For each:
- What triggers it
- What success looks like
- Common failure modes

## Product principles
Ordered list of principles that resolve ambiguity. When two valid approaches exist,
these principles decide. E.g.:
1. Speed over completeness — ship a fast partial result, not a slow perfect one
2. Explicit over magic — users should understand why something happened
3. Mobile-first — every feature must work on mobile before desktop

## What this product is NOT
Explicit anti-goals. "We are not a project management tool. We do not support Gantt charts,
resource allocation, or time tracking."

## Cross-references
- Product specs: `docs/product-specs/`
- Design philosophy: `docs/DESIGN.md`
```

---

## docs/QUALITY_SCORE.md

Purpose: Define how code and product quality is measured so agents can self-evaluate their work.

```markdown
# Quality Score

## Quality dimensions
Define what "quality" means for this project across relevant dimensions:

### Code quality
- Type safety: {strict TypeScript, no `any`}
- Test coverage: {target percentage, what must be tested}
- Lint rules: {enforced rules, link to config}
- Code review standards

### Product quality
- Performance targets (load times, interaction latency)
- Accessibility standards
- Error rate thresholds

### Documentation quality
- Every public API has docstrings
- Architecture docs updated with each major change
- Decision records for non-obvious choices

## Scoring rubric (optional)
If the team uses a scoring system, document it here. Otherwise, the quality dimensions
above serve as the checklist.

## Cross-references
- Reliability targets: `docs/RELIABILITY.md`
- Security requirements: `docs/SECURITY.md`
```

---

## docs/RELIABILITY.md

Purpose: How the system stays up, how it recovers from failure, and how it's monitored.

```markdown
# Reliability

## Error handling strategy
How errors are handled at each layer:
- Frontend: error boundaries, toast notifications, retry logic
- API: error response format, status code conventions, global exception handlers
- Background jobs: retry policies, dead letter queues, alerting

## Monitoring and observability
- What's monitored (uptime, latency, error rates, business metrics)
- Tools used (e.g., Sentry, Datadog, custom dashboards)
- Alert thresholds and escalation

## Logging conventions
- Log format and levels
- What to log (request IDs, user IDs, action context) and what NOT to log (PII, secrets)
- Where logs go (stdout → log aggregator)

## Recovery procedures
For each critical failure mode:
- How to detect it
- Immediate mitigation steps
- Root cause investigation approach
- Who to notify

## Backup and data recovery
- What's backed up, frequency, retention
- Recovery procedure and tested recovery time

## Deployment safety
- Rollback procedure
- Feature flags
- Canary/gradual rollout strategy

## Cross-references
- Security incidents: `docs/SECURITY.md`
- Infrastructure: `ARCHITECTURE.md` → Environment and deployment
```

---

## docs/SECURITY.md

Purpose: Auth model, permissions, threat model, and security practices.

```markdown
# Security

## Authentication
- Auth provider/method (e.g., Clerk, Auth0, custom JWT)
- Session management (token storage, expiry, refresh)
- Login flows (email/password, OAuth, magic link)

## Authorization
- Permission model (RBAC, ABAC, row-level)
- Role definitions and what each can access
- How permissions are enforced (middleware, decorators, DB policies)

## Data protection
- Encryption at rest and in transit
- PII handling (what's collected, where stored, retention)
- Secrets management (env vars, vault, key rotation)

## API security
- Rate limiting
- Input validation approach
- CORS policy
- CSRF protection

## Threat model (if applicable)
Key threats considered and mitigations in place.

## Security checklist for new features
When building a new feature, verify:
- [ ] Auth required on all new endpoints
- [ ] Input validated and sanitized
- [ ] No secrets in client-side code
- [ ] PII access logged
- [ ] Permissions tested for each role

## Cross-references
- Auth implementation: `ARCHITECTURE.md`
- Error handling for auth failures: `docs/RELIABILITY.md`
```

---

## docs/design-docs/

Purpose: Record significant design decisions with full context. Each design doc captures a
decision that an agent might otherwise re-evaluate or contradict.

### docs/design-docs/index.md

```markdown
# Design Documents

| Doc | Status | Date | Summary |
|-----|--------|------|---------|
| [core-beliefs](core-beliefs.md) | Active | YYYY-MM-DD | Foundational principles |
| [{feature}]({feature}.md) | Active/Superseded | YYYY-MM-DD | One-line summary |
```

### docs/design-docs/core-beliefs.md

```markdown
# Core Beliefs

Foundational technical and product beliefs that guide all decisions. These rarely change.

## 1. {Belief title}
**Belief**: One sentence statement.
**Rationale**: Why this is true for this project.
**Implications**: What this means in practice — specific patterns, tools, or constraints it drives.

## 2. {Belief title}
(repeat)
```

### docs/design-docs/{feature}.md

```markdown
# Design Doc: {Feature/Decision Title}

**Status**: Proposed / Accepted / Superseded by {link}
**Date**: YYYY-MM-DD
**Author**: {name}

## Context
What problem or need prompted this decision?

## Decision
What was decided, stated directly.

## Alternatives considered
| Option | Pros | Cons | Why not chosen |
|--------|------|------|----------------|
| Option A | ... | ... | ... |
| Option B | ... | ... | ... |

## Consequences
What tradeoffs were accepted. What becomes easier and what becomes harder.

## Implementation notes
Key implementation details an agent needs to know to work with this decision correctly.
```

---

## docs/exec-plans/

Purpose: Concrete implementation plans with steps, owners, and status tracking.

### docs/exec-plans/active/{plan}.md

```markdown
# Exec Plan: {Title}

**Goal**: One sentence — what will be true when this is done.
**Created**: YYYY-MM-DD
**Target completion**: YYYY-MM-DD
**Status**: In Progress / Blocked

## Context
Why this work is happening now. Link to relevant product spec or design doc.

## Steps

- [ ] Step 1: {Description} — {estimated effort}
- [ ] Step 2: {Description} — {estimated effort}
  - [ ] Sub-step 2a
  - [ ] Sub-step 2b
- [ ] Step 3: {Description}

## Dependencies
What must be true before this plan can execute (external APIs, other plans, decisions).

## Risks
Known risks and mitigations.

## Definition of done
How we know this is complete. Be specific enough that an agent could verify.

## Cross-references
- Product spec: `docs/product-specs/{feature}.md`
- Design doc: `docs/design-docs/{feature}.md`
```

### docs/exec-plans/tech-debt-tracker.md

```markdown
# Tech Debt Tracker

## Active debt

| ID | Description | Impact | Effort | Priority | Added |
|----|-------------|--------|--------|----------|-------|
| TD-001 | {description} | {what it affects} | {S/M/L} | {P0-P3} | YYYY-MM-DD |

## Resolved debt

| ID | Description | Resolved | Resolution |
|----|-------------|----------|------------|
| TD-000 | {description} | YYYY-MM-DD | {how it was fixed} |
```

---

## docs/product-specs/

Purpose: Define user-facing features with enough detail for an AI agent to implement them correctly.

### docs/product-specs/index.md

```markdown
# Product Specs

| Spec | Status | Priority | Summary |
|------|--------|----------|---------|
| [new-user-onboarding](new-user-onboarding.md) | Approved | P0 | First-run experience |
| [{feature}]({feature}.md) | Draft/Approved | P0-P3 | One-line summary |
```

### docs/product-specs/{feature}.md

```markdown
# Product Spec: {Feature Name}

**Status**: Draft / In Review / Approved / Shipped
**Priority**: P0-P3
**Last updated**: YYYY-MM-DD

## Problem statement
What user problem does this solve? Include evidence (user feedback, metrics, observations).

## User stories
- As a {user type}, I want to {action} so that {outcome}
- ...

## Requirements

### Must have
- Requirement 1
- Requirement 2

### Should have
- Requirement 3

### Won't have (this version)
- Explicitly excluded requirement — and why

## User flow
Step-by-step user interaction:
1. User navigates to {page}
2. User clicks {element}
3. System responds with {behavior}
4. ...

## Edge cases
| Scenario | Expected behavior |
|----------|-------------------|
| User has no data | Show empty state with CTA |
| Network error during save | Retry 3x, then show error toast with retry button |

## Success metrics
How we measure if this feature is working:
- Metric 1: {what} — target: {value}
- Metric 2: {what} — target: {value}

## Cross-references
- Design doc: `docs/design-docs/{feature}.md`
- Exec plan: `docs/exec-plans/active/{plan}.md`
- Design mockups: {link if applicable}
```

---

## docs/generated/db-schema.md

Purpose: Auto-generated database schema documentation. Generate this from ORM models,
migration files, or by introspecting the database directly.

```markdown
<!-- GENERATED — Do not edit manually. Regenerate with: {command or instructions} -->

# Database Schema

## Tables

### {table_name}
{Brief description of what this table stores}

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | no | gen_random_uuid() | Primary key |
| ... | | | | |

**Indexes**: {list indexes}
**Foreign keys**: {list FK relationships}

### {table_name_2}
(repeat)

## Relationships diagram
Text description or ASCII diagram of table relationships.

## Enums / custom types
| Type name | Values | Used by |
|-----------|--------|---------|
| {enum} | val1, val2, val3 | {table.column} |
```

---

## docs/references/

Purpose: Store LLM-friendly reference documentation for external tools, libraries, and
frameworks used by the project. These are typically condensed versions of official docs
optimized for context window efficiency.

Naming convention: `{tool-name}-llms.txt`

These files are NOT generated by this skill — they're typically sourced from the tool's
official LLM-friendly docs or manually curated. The skill should note which references
are missing and suggest where to find them.

Common references to check for:
- Framework docs (Next.js, Django, Rails, etc.)
- UI library docs (Tailwind, shadcn, etc.)
- Deployment platform docs (Railway, Vercel, Fly.io, etc.)
- Package manager docs (uv, pnpm, etc.)
- Database docs (Prisma, Drizzle, SQLAlchemy, etc.)
