---
name: harness-documentation
description: >
  Generate and maintain AI-friendly project architecture documentation, complete with Mermaid diagrams for
  architecture, data flows, sequences, and state. Use this skill whenever the user asks to scaffold project docs,
  create an ARCHITECTURE.md, AGENTS.md, design docs, execution plans, product specs, or any kind of structured
  project documentation meant to give an AI (or human) full context on a codebase. The skill scaffolds docs that
  don't exist yet and updates docs that already do. Also trigger when the user asks to audit, update, regenerate,
  or add diagrams to existing project documentation, or when they mention "project docs", "architecture docs",
  "documentation structure", "document my project", "codebase docs", "AI context docs", "architecture diagram",
  "mermaid diagram", "flow diagram", or similar. Even if they just say "set up docs" or "I need docs for my
  project" — use this skill.
---

# Harness Documentation Skill

Create, update, and audit structured project documentation optimized for AI agent consumption. The documentation
system gives any AI agent (coding, planning, reviewing) full project context with minimal token overhead.

## Why this structure matters

AI agents work best when they can quickly locate the right context without reading the entire codebase. This
documentation system uses a layered approach: top-level files provide orientation, subdirectories provide depth,
and every file cross-references related docs so an agent can navigate efficiently.

## Three modes of operation

Before doing anything, check what already exists. List the docs tree (see below) and compare against
what's present in the project. This decides which mode applies — and the modes mix freely within a single
request. A typical "document my project" run scaffolds the files that are missing and updates the ones that
already exist in the same pass. Never blindly overwrite an existing doc with a fresh template; that destroys
real content the user wrote. If a file exists, you're in update mode for that file; if it doesn't, you're in
scaffold mode for it.

### 1. Scaffold — New project documentation

Generate the full documentation tree for a project. Before writing anything:

1. Examine the codebase — read the directory tree, key config files (package.json, pyproject.toml, Cargo.toml, etc.), and entry points
2. Identify the tech stack, architecture patterns, and domain concepts
3. Generate all documentation files, filling in real details from the codebase — never leave placeholder text like "TBD" or "fill in later"

If there isn't enough information to fill a section meaningfully, note what's missing and ask the user rather than guessing.

### 2. Generate/Update — Individual documents

When updating a single doc or generating one from codebase context:

1. Read the existing doc (if any) and the relevant source code
2. Identify what's changed or missing
3. Rewrite only the sections that need updating, preserving the rest
4. Update cross-references in related docs if needed

### 3. Audit — Check existing docs against the ideal structure

Compare what exists against the full documentation tree defined below. Report:

- Missing files (with priority: critical / recommended / nice-to-have)
- Stale sections (content that contradicts the current codebase)
- Structural issues (wrong location, missing cross-references)
- Quality issues (placeholder text, vague descriptions, missing examples)

Output the audit as a checklist the user can act on.

---

## Documentation tree

```
AGENTS.md                    ← Agent roles, capabilities, and boundaries
ARCHITECTURE.md              ← System-level technical architecture
docs/
├── design-docs/
│   ├── index.md             ← Index of all design docs with status
│   ├── core-beliefs.md      ← Foundational design principles
│   └── {feature}.md         ← One per major design decision
├── exec-plans/
│   ├── active/              ← Currently executing plans
│   │   └── {plan}.md
│   ├── completed/           ← Finished plans (kept for context)
│   │   └── {plan}.md
│   └── tech-debt-tracker.md ← Known technical debt and remediation
├── generated/
│   └── db-schema.md         ← Auto-generated from DB introspection
├── product-specs/
│   ├── index.md             ← Index of all product specs
│   ├── {feature}.md         ← One per user-facing feature/flow
│   └── ...
├── references/
│   ├── {tool}-llms.txt      ← LLM-friendly reference docs for tools/libraries
│   └── ...
├── DESIGN.md                ← Visual/interaction design system
├── FRONTEND.md              ← Frontend architecture and patterns
├── PLANS.md                 ← High-level roadmap and priorities
├── PRODUCT_SENSE.md         ← Product philosophy, user mental models
├── QUALITY_SCORE.md         ← Quality metrics and scoring rubric
├── RELIABILITY.md           ← Error handling, monitoring, recovery
└── SECURITY.md              ← Auth, permissions, threat model
```

For the templates and detailed guidance for each file, read `references/templates.md`.

---

## Diagrams

Prose describes a system; a diagram lets a reader hold the whole shape in their head at once. Embed
[Mermaid](https://mermaid.js.org) diagrams directly in the relevant docs — they render natively in GitHub,
VS Code, and most Markdown viewers, and because they're plain text in a fenced ```` ```mermaid ```` block,
they diff cleanly and an AI agent can read and update them without a rendering step.

Diagrams must be derived from the actual codebase, not invented. Trace real entry points, real service
boundaries, real state transitions. A diagram that disagrees with the code is worse than no diagram — it
actively misleads. When you update a doc and the underlying structure changed, update its diagrams too;
treat them as part of the prose, not decoration.

Choose the diagram type that fits what you're explaining:

| What you're documenting | Mermaid type | Lives in |
|-------------------------|--------------|----------|
| System topology — services, data stores, external deps and how they connect | `flowchart` / `graph` | `ARCHITECTURE.md` → High-level diagram |
| A request or data path step-by-step across components over time | `sequenceDiagram` | `ARCHITECTURE.md` → Data flow; `docs/product-specs/{feature}.md` → User flow |
| Lifecycle of a stateful entity (order, job, session) — states and transitions | `stateDiagram-v2` | the design doc or product spec that owns that entity |
| Database tables and their relationships | `erDiagram` | `docs/generated/db-schema.md` → Relationships diagram |
| Branching logic in a user or agent workflow | `flowchart` | `docs/product-specs/{feature}.md`; `AGENTS.md` → Inter-agent communication |

Keep each diagram focused on one question. A single mega-diagram of the entire system is unreadable —
prefer a high-level topology diagram plus targeted per-flow diagrams. Label edges (what flows, what
triggers the transition) so the diagram stands on its own.

`references/templates.md` contains a ready-to-adapt Mermaid example for each type. Read it before writing
diagrams.

---

## Writing principles

These apply to every document in the tree:

**Audience is an AI agent first, human second.** Write for an LLM that needs to quickly understand scope, make decisions, and write code. This means: be explicit, avoid ambiguity, state constraints directly, and always include concrete examples alongside abstract descriptions.

**Lead with the "what and why", follow with "how".** Every document should open with a 2-3 sentence summary an agent can use to decide whether to read further. Don't bury the key insight at the bottom.

**Cross-reference, don't duplicate.** If something is covered in another doc, link to it with a relative path. Duplication drifts and confuses agents. Example: `See [SECURITY.md](docs/SECURITY.md) for auth details.`

**Use consistent heading structure.** H1 = document title. H2 = major sections. H3 = subsections. Don't skip levels. Agents parse heading hierarchy to understand document structure.

**Prefer concrete over abstract.** Instead of "we use a microservices architecture", write "the system has 4 services: api-gateway (FastAPI), auth-service (Express), worker (Celery), and notifications (Go). They communicate via Redis pub/sub and REST."

**Include decision context.** When documenting a technical choice, briefly state what alternatives were considered and why this approach was chosen. This prevents agents from suggesting changes that were already evaluated.

**Date-stamp volatile content.** Execution plans, tech debt items, and roadmap entries should include dates so agents know what's current.

---

## Generated docs

Some documentation can be auto-generated from the codebase. When scaffolding, check for these and generate them:

- `docs/generated/db-schema.md` — Generate from database migrations, ORM models, or SQL schema files
- API docs — Generate from OpenAPI specs, route definitions, or docstrings

Mark generated docs clearly at the top: `<!-- GENERATED — Do not edit manually. Regenerate with [command/instructions]. -->`

---

## CLAUDE.md migration

If the project has an existing `CLAUDE.md`, clear its contents and replace them with a single reference to the newly created `AGENTS.md`:

```md
See [AGENTS.md](AGENTS.md)
```

This consolidates all agent instructions into one canonical location and prevents drift between competing instruction files.

---

## Audit checklist

When auditing, evaluate each file against these criteria:

| Criterion | Question |
|-----------|----------|
| Exists | Is the file present at the expected path? |
| Current | Does the content match the current codebase? |
| Complete | Are all required sections filled in (not "TBD")? |
| Accurate | Do code examples and paths actually exist? |
| Linked | Are cross-references to related docs present and valid? |
| Actionable | Could an AI agent use this doc to make correct decisions? |
| Diagrammed | Do docs that describe topology, flows, state, or the data model include a Mermaid diagram, and does it still match the code? |

---

## Reference files

- `references/templates.md` — Full templates with section-by-section guidance for every file in the documentation tree. **Read this before generating any documentation.**
