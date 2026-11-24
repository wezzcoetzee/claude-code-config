---
name: principle-comments
description: Use when writing or editing code, so comments only appear where the code cannot explain itself.
---

# Comments

Agents write this code and agents read it. They read the code itself, so a comment that repeats what the code says is noise: it costs tokens and goes stale.

Default to no comment. Keep one only when the code cannot carry the information:
- a non-obvious invariant or constraint
- a workaround and the reason for it
- a public API contract

## Clean up

When you edit a file, delete every comment in it that fails the test above. Common ones:
- restates the line, the variable, or the function name
- section banners and dividers
- commented-out code
- history: "added for X", "changed from Y", "new"

If your change made a comment wrong and it still passes the test, fix it. Otherwise delete it.

Do not open files only to delete comments.
