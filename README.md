# Claude Code Config

My personal Claude Code configuration - mostly not created by me, but sourced from many talented people in the community.

## Installation

### Option 1: Git Clone

```bash
git clone https://github.com/wezzcoetzee/claude-code-config.git ~/.claude
```

### Option 2: Selective Install

```bash
# Clone elsewhere first
git clone https://github.com/wezzcoetzee/claude-code-config.git /tmp/claude-config

# Copy what you need
cp -r /tmp/claude-config/skills/* ~/.claude/skills/
cp -r /tmp/claude-config/agents/* ~/.claude/agents/
```

## Contents

### Skills (`.claude/skills/`)

Model-invoked capabilities Claude applies automatically.

| Skill | Description |
|-------|-------------|
| `app-store-screenshots` | Capture simulator/app screenshots and composite them into framed App Store marketing images |
| `audit-and-file-issues` | Audit a repo and file each finding as a categorized GitHub issue |
| `babysit-pr` | Monitor a PR through review and CI, acting on real findings only |
| `bug-hunt` | Defect-focused review for logic flaws, races, leaks, vulnerabilities |
| `clean-code-audit` | Audit code for clean code, security, performance, a11y, testing gaps |
| `create-pull-request` | File a concise pull request from the actual diff |
| `file-upload` | Upload a file to a file server and return a shareable URL |
| `harness-documentation` | Generate AI-friendly project architecture documentation with Mermaid diagrams |
| `html-communication` | Publish plans, reports, and UI mocks as hosted HTML instead of markdown |

### Agents (`.claude/agents/`)

Custom subagents for specialized tasks.

| Agent | Description |
|-------|-------------|
| `bug-buster` | Test-driven bug fixing with reproduction tests |
| `clean-code-engineer` | Implement code following clean code principles |
| `codebase-search` | Find files and implementations |
| `crypto-trading-engineer` | DEX/perps trading, Hyperliquid, Solana, EVM |
| `open-source-librarian` | Research OSS with citations |
| `tech-docs-writer` | Create technical documentation |
| `test-architect` | Comprehensive test coverage |

### Instructions

- `CLAUDE.md` - personal global instructions loaded into every Claude Code session.
- `AGENTS.md` - a symlink to `CLAUDE.md`, for harnesses that read `AGENTS.md` (e.g. Codex).

## Recommended Third-Party Skills

Not checked into this repo. Installed via `npx skills add` - browse more at [skills.sh](https://skills.sh).

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add https://github.com/vercel-labs/skills --skill find-skills
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser
npx skills add https://github.com/coreyhaines31/marketingskills --skill seo-audit # There are more great skills in this library
```

## Recommended Plugins

Plugins I use alongside this config. Install via CLI:

### Official Plugins

```bash
claude plugin install plugin-dev
claude plugin install skill-creator
```

### claude-hud (status line)

Add the marketplace first, then install:

```bash
claude plugin marketplace add jarrodwatts/claude-hud
claude plugin install claude-hud@claude-hud
```
