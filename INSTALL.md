Install Claude Code configuration from <https://github.com/wezzcoetzee/claude-code-config>

Fetch and install these files to ~/.claude/:

**Skills** (model-invoked capabilities):

- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/xlsx/SKILL.md> → ~/.claude/skills/xlsx/SKILL.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/xlsx/LICENSE.txt> → ~/.claude/skills/xlsx/LICENSE.txt
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/xlsx/recalc.py> → ~/.claude/skills/xlsx/recalc.py
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/prisma/SKILL.md> → ~/.claude/skills/prisma/SKILL.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/harness-documentation/SKILL.md> → ~/.claude/skills/harness-documentation/SKILL.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/harness-documentation/references/templates.md> → ~/.claude/skills/harness-documentation/references/templates.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/clean-code-audit/SKILL.md> → ~/.claude/skills/clean-code-audit/SKILL.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/audit-and-file-issues/SKILL.md> → ~/.claude/skills/audit-and-file-issues/SKILL.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/audit-and-file-issues/references/audit-rubric.md> → ~/.claude/skills/audit-and-file-issues/references/audit-rubric.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/audit-and-file-issues/references/issue-template.md> → ~/.claude/skills/audit-and-file-issues/references/issue-template.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/bug-hunt/SKILL.md> → ~/.claude/skills/bug-hunt/SKILL.md

**Agents** (custom subagents):

- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/clean-code-engineer.md> → ~/.claude/agents/clean-code-engineer.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/codebase-search.md> → ~/.claude/agents/codebase-search.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/crypto-trading-engineer.md> → ~/.claude/agents/crypto-trading-engineer.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/open-source-librarian.md> → ~/.claude/agents/open-source-librarian.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/tech-docs-writer.md> → ~/.claude/agents/tech-docs-writer.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/test-architect.md> → ~/.claude/agents/test-architect.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/bug-buster.md> → ~/.claude/agents/bug-buster.md

**Global Instructions**:

- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/CLAUDE.md> → ~/.claude/CLAUDE.md

**Third-Party Skills** (installed via npx):

After installing the config files above, run these commands to install third-party skills:

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add https://github.com/vercel-labs/skills --skill find-skills
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser
npx skills add https://github.com/coreyhaines31/marketingskills --skill seo-audit
```

**Plugins** (installed via CLI):

```bash
claude plugin install code-review
claude plugin install typescript-lsp
claude plugin install plugin-dev
claude plugin install skill-creator
claude plugin marketplace add jarrodwatts/claude-hud
claude plugin install claude-hud@claude-hud
```

**CRITICAL: Do NOT overwrite existing files.**

Before installing each file:

1. Check if the destination file already exists
2. If it does NOT exist → install it
3. If it DOES exist → ask the user what to do:
   - **Skip**: Keep their existing file unchanged
   - **Overwrite**: Replace with the new version
   - **Merge**: Intelligently combine both versions, preserving user customizations while adding new content

This is especially important for ~/.claude/CLAUDE.md which contains personal workflow preferences. Never overwrite without explicit user consent.

Create directories as needed and fetch files with curl.
