# Claude Code Config

My personal Claude Code configuration - mostly not created by me, but sourced from many talented people in the community.

## Installation

### Option 1: Copy-Paste into Claude Code (No Git Required)

Copy the prompt from [INSTALL.md](INSTALL.md) and paste it into Claude Code. Claude will fetch and install all config files automatically.

### Option 2: Git Clone

```bash
git clone https://github.com/wezzcoetzee/claude-code-config.git ~/.claude
```

### Option 3: Selective Install

```bash
# Clone elsewhere first
git clone https://github.com/wezzcoetzee/claude-code-config.git /tmp/claude-config

# Copy what you need
cp -r /tmp/claude-config/rules/* ~/.claude/rules/
cp -r /tmp/claude-config/skills/* ~/.claude/skills/
cp -r /tmp/claude-config/agents/* ~/.claude/agents/
```

## Contents

### Rules (`.claude/rules/`)

Path-scoped instructions loaded automatically when working with matching files.

| File | Scope | Description |
|------|-------|-------------|
| `typescript.md` | `**/*.{ts,tsx}` | TypeScript conventions |
| `testing.md` | `**/*.{test,spec}.ts` | Testing patterns |
| `comments.md` | All files | Comment policy |
| `forge.md` | `**/*.sol` | Foundry/ZKsync rules |

### Skills (`.claude/skills/`)

Model-invoked capabilities Claude applies automatically.

#### Bundled Skills

| Skill | Description |
|-------|-------------|
| `planning-with-files` | Manus-style persistent markdown planning |
| `xlsx` | Spreadsheet creation, editing, and analysis |
| `prisma` | Prisma v7 setup with pg driver adapter for Next.js + Bun |
| `project-docs` | Generate AI-friendly project architecture documentation |
| `clean-code-audit` | Audit code for clean code, security, performance, a11y, testing gaps |
| `audit-and-file-issues` | Audit repo and file findings as categorized GitHub issues |
| `bug-hunt` | Defect-focused review for logic flaws, races, leaks, vulnerabilities |

#### Third-Party Skills

Installed via `npx skills add`. Browse more at [skills.sh](https://skills.sh).

| Skill | Source | Link |
|-------|--------|------|
| `vercel-react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | [skills.sh](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices) |
| `find-skills` | [vercel-labs/skills](https://github.com/vercel-labs/skills) | [skills.sh](https://skills.sh/vercel-labs/skills/find-skills) |
| `agent-browser` | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | [skills.sh](https://skills.sh/vercel-labs/agent-browser/agent-browser) |
| `seo-audit` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | — |

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add https://github.com/vercel-labs/skills --skill find-skills
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser
npx skills add https://github.com/coreyhaines31/marketingskills --skill seo-audit # There are more great skills in this library
```

### Agents (`.claude/agents/`)

Custom subagents for specialized tasks.

| Agent | Description |
|-------|-------------|
| `clean-code-engineer` | Implement code following clean code principles |
| `codebase-search` | Find files and implementations |
| `crypto-trading-engineer` | DEX/perps trading, Hyperliquid, Solana, EVM |
| `media-interpreter` | Extract info from PDFs/images |
| `open-source-librarian` | Research OSS with citations |
| `tech-docs-writer` | Create technical documentation |
| `test-architect` | Comprehensive test coverage |
| `bug-buster` | Test-driven bug fixing with reproduction tests |

### Commands (`.claude/commands/`)

Custom slash commands.

| Command | Description |
|---------|-------------|
| `interview` | Interactive planning/spec fleshing |

### Hooks (`.claude/hooks/`)

Scripts triggered by Claude Code events.

| Hook | Event | Description |
|------|-------|-------------|
| `keyword-detector.py` | UserPromptSubmit | Detects keywords in prompts |
| `check-comments.py` | PostToolUse (Write/Edit) | Validates comment policy |
| `todo-enforcer.sh` | Stop | Ensures todos are tracked |

### CLAUDE.md

Personal global instructions loaded into every session.

## Recommended Plugins

Plugins I use alongside this config. Install via CLI:

### Official Plugins

```bash
claude plugin install code-review
claude plugin install typescript-lsp
claude plugin install plugin-dev
claude plugin install skill-creator
```

### claude-hud (status line)

Add the marketplace first, then install:

```bash
claude plugin marketplace add jarrodwatts/claude-hud
claude plugin install claude-hud@claude-hud
```
