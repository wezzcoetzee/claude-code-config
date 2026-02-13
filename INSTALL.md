Install Claude Code configuration from <https://github.com/wezzcoetzee/claude-code-config>

Fetch and install these files to ~/.claude/:

**Rules** (path-scoped instructions):

- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/rules/typescript.md> → ~/.claude/rules/typescript.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/rules/testing.md> → ~/.claude/rules/testing.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/rules/comments.md> → ~/.claude/rules/comments.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/rules/forge.md> → ~/.claude/rules/forge.md

**Skills** (model-invoked capabilities):

- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/planning-with-files/SKILL.md> → ~/.claude/skills/planning-with-files/SKILL.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/planning-with-files/examples.md> → ~/.claude/skills/planning-with-files/examples.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/planning-with-files/reference.md> → ~/.claude/skills/planning-with-files/reference.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/react-useeffect/SKILL.md> → ~/.claude/skills/react-useeffect/SKILL.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/react-useeffect/alternatives.md> → ~/.claude/skills/react-useeffect/alternatives.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/react-useeffect/anti-patterns.md> → ~/.claude/skills/react-useeffect/anti-patterns.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/seo-optimizer/SKILL.md> → ~/.claude/skills/seo-optimizer/SKILL.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/seo-optimizer/index.js> → ~/.claude/skills/seo-optimizer/index.js
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/seo-optimizer/package.json> → ~/.claude/skills/seo-optimizer/package.json
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/seo-optimizer/assets/robots.txt> → ~/.claude/skills/seo-optimizer/assets/robots.txt
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/seo-optimizer/scripts/seo_analyzer.py> → ~/.claude/skills/seo-optimizer/scripts/seo_analyzer.py
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/seo-optimizer/scripts/generate_sitemap.py> → ~/.claude/skills/seo-optimizer/scripts/generate_sitemap.py
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/seo-optimizer/references/schema_markup_guide.md> → ~/.claude/skills/seo-optimizer/references/schema_markup_guide.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/seo-optimizer/references/seo_checklist.md> → ~/.claude/skills/seo-optimizer/references/seo_checklist.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/xlsx/SKILL.md> → ~/.claude/skills/xlsx/SKILL.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/xlsx/LICENSE.txt> → ~/.claude/skills/xlsx/LICENSE.txt
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/skills/xlsx/recalc.py> → ~/.claude/skills/xlsx/recalc.py

**Agents** (custom subagents):

- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/clean-code-engineer.md> → ~/.claude/agents/clean-code-engineer.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/codebase-search.md> → ~/.claude/agents/codebase-search.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/crypto-trading-engineer.md> → ~/.claude/agents/crypto-trading-engineer.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/media-interpreter.md> → ~/.claude/agents/media-interpreter.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/open-source-librarian.md> → ~/.claude/agents/open-source-librarian.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/tech-docs-writer.md> → ~/.claude/agents/tech-docs-writer.md
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/agents/test-architect.md> → ~/.claude/agents/test-architect.md

**Commands** (slash commands):

- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/commands/interview.md> → ~/.claude/commands/interview.md

**Hooks** (event-triggered scripts):

- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/hooks/keyword-detector.py> → ~/.claude/hooks/keyword-detector.py
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/hooks/check-comments.py> → ~/.claude/hooks/check-comments.py
- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/hooks/todo-enforcer.sh> → ~/.claude/hooks/todo-enforcer.sh

**Global Instructions**:

- <https://raw.githubusercontent.com/wezzcoetzee/claude-code-config/master/CLAUDE.md> → ~/.claude/CLAUDE.md

**Third-Party Skills** (installed via npx):

After installing the config files above, run these commands to install third-party skills:

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add https://github.com/vercel-labs/skills --skill find-skills
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser
npx skills add https://github.com/coreyhaines31/marketingskills --skill seo-audit
npx skills add https://github.com/softaworks/agent-toolkit --skill agent-md-refactor
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

Create directories as needed, fetch files with curl, and make hook scripts executable.
