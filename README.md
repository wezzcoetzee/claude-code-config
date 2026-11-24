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
cp -r /tmp/claude-config/commands/* ~/.claude/commands/
cp -r /tmp/claude-config/hooks ~/.claude/hooks
```

Some skills lean on each other or on agents: `code-review` needs the three `review-*` agents and Claude Code's Workflow tool, `cleanup` and `/audit` fan out `code-auditor`, `full-send` chains `consult-council`, `create-pull-request` and `babysit-pr`. Copy those together.

## Contents

### Skills (`skills/`)

Model-invoked capabilities Claude applies automatically.

| Skill | Description |
|-------|-------------|
| `address-pr-comments` | Work through PR review threads: fix, explain, or ask |
| `app-store-screenshots` | Capture simulator/app screenshots and composite them into framed App Store marketing images |
| `babysit-pr` | Monitor a PR through review and CI, acting on real findings only |
| `bug-hunt` | Defect-focused review for logic flaws, races, leaks, vulnerabilities |
| `clean-code` | Audit code for clean code, security, performance, a11y, testing gaps |
| `cleanup` | Remove dead code and redundant tests, then open a PR with before/after stats |
| `code-review` | Multi-agent PR review workflow (triage, find, skeptic verify, post) that posts to GitHub |
| `consult-council` | Three reviewers from three labs review a PR until they agree (needs T3 Code's orchestrator with Codex and Grok) |
| `create-adr` | Write or supersede an Architecture Decision Record |
| `create-pull-request` | File a concise pull request from the actual diff |
| `file-issues` | Turn audit findings into labelled, templated GitHub issues |
| `fix-up-pr` | Rebase, resolve conflicts and get CI green without merging |
| `full-send` / `full-stop` | Finish work unattended through to a merged (or merge-ready) PR |
| `harness-documentation` | Generate AI-friendly project architecture documentation with Mermaid diagrams |
| `html-communication` | Publish plans, reports, and UI mocks as hosted HTML instead of markdown |
| `metrics-logging` | Add Prometheus metrics and structured logging |
| `principle-comments` | Only comment where the code cannot explain itself |
| `principle-tests` | Every test guards logic that matters; none keeps dead code alive |
| `worktree-cleanup` | Inventory and prune worktrees left behind by agent runs |

### Agents (`agents/`)

Custom subagents for specialized tasks.

| Agent | Description |
|-------|-------------|
| `bug-buster` | Test-driven bug fixing with reproduction tests |
| `code-auditor` | Read-only auditor that applies a rubric to one slice of a codebase |
| `open-source-librarian` | Research OSS with citations |
| `review-finder` / `review-shell` / `review-post` | Workers for the `code-review` workflow |

### Commands (`commands/`)

| Command | Description |
|---------|-------------|
| `/audit` | Run `clean-code` and `bug-hunt` over a path or diff and file the findings as issues |

### Hooks (`hooks/`)

| Hook | Event | What it does |
|------|-------|--------------|
| `guard-default-branch.sh` | PreToolUse `Bash` | Blocks commits and pushes on the default branch, and force pushes without `--force-with-lease` |
| `check-comments.py` | PostToolUse `Write\|Edit` | Warns when an edit is mostly comments that restate the code |
| `chain-docs-after-pr.sh` | PostToolUse `Skill` | After `create-pull-request`, asks for `harness-documentation` to update the docs |

Hooks need wiring up in `~/.claude/settings.json`. All three fail open if `jq`/`python3` is missing.

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "~/.claude/hooks/guard-default-branch.sh" }] }
    ],
    "PostToolUse": [
      { "matcher": "Write|Edit|MultiEdit", "hooks": [{ "type": "command", "command": "python3 ~/.claude/hooks/check-comments.py" }] },
      { "matcher": "Skill", "hooks": [{ "type": "command", "command": "~/.claude/hooks/chain-docs-after-pr.sh" }] }
    ]
  }
}
```

### Instructions

- `CLAUDE.md` - personal global instructions loaded into every Claude Code session.
- `AGENTS.md` - a symlink to `CLAUDE.md`, for harnesses that read `AGENTS.md` (e.g. Codex).

## Recommended Third-Party Skills

Not checked into this repo. Installed via `npx skills add` - browse more at [skills.sh](https://skills.sh).

```bash
npx skills add https://github.com/vercel-labs/skills --skill find-skills
npx skills add https://github.com/coreyhaines31/marketingskills --skill seo-audit # There are more great skills in this library
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/Bil0000/Hill-Climb --skill hill-climb
npx skills add https://github.com/pbakaus/impeccable # Also installs its companion skills (polish, critique, layout, ...)
npx skills add https://github.com/shadcn/ui --skill shadcn
```

## Recommended Plugins

Plugins I use alongside this config. Install via CLI:

### Official Plugins

```bash
claude plugin install context7     # Up-to-date library docs over MCP
claude plugin install skill-creator
claude plugin install swift-lsp    # Swift language server, for iOS/macOS work
```
