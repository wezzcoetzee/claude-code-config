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

| Skill | Description |
|-------|-------------|
| `frontend-design` | Create distinctive, production-grade frontend interfaces |
| `planning-with-files` | Manus-style persistent markdown planning |
| `prd-creator` | Generate Product Requirements Documents |
| `react-useeffect` | React useEffect best practices from official docs |
| `seo-optimizer` | SEO optimization for HTML/CSS websites |
| `xlsx` | Spreadsheet creation, editing, and analysis |

```bash
npx skills add https://github.com/coreyhaines31/marketingskills --skill seo-audit
npx skills add https://github.com/softaworks/agent-toolkit --skill agent-md-refactor
```

On my list to try a bunch of these

```bash
npx add-skill coreyhaines31/marketingskills
```

#### Great website for finding new skills

```bash
https://skills.sh
```

### Agents (`.claude/agents/`)

Custom subagents for specialized tasks.

| Agent | Description |
|-------|-------------|
| `clean-code-engineer` | Implement code following clean code principles |
| `codebase-search` | Find files and implementations |
| `media-interpreter` | Extract info from PDFs/images |
| `open-source-librarian` | Research OSS with citations |
| `tech-docs-writer` | Create technical documentation |
| `test-architect` | Comprehensive test coverage |

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

### Skills with Installations

```base
npx add-skill vercel-labs/agent-skills
```

## Recommended Plugins

Plugins I use alongside this config. Install via CLI:

### Official Plugins

```bash
claude plugin install frontend-design
claude plugin install code-review
claude plugin install typescript-lsp
claude plugin install plugin-dev
claude plugin install ralph-loop
```

### claude-hud (status line)

Add the marketplace first, then install:

```bash
claude plugin marketplace add jarrodwatts/claude-hud
claude plugin install claude-hud@claude-hud

claude plugin marketplace add expo/skills
claude plugin install expo-app-design
claude plugin install upgrading-expo
claude plugin install expo-deployment

/plugin marketplace add supabase/agent-skills
/plugin install postgres-best-practices@supabase-agent-skills
```
