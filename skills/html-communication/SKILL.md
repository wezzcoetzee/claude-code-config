---
name: html-communication
description: Write plans, reports, comparisons, and UI mocks as hosted HTML documents instead of markdown. Use when producing a plan, design doc, audit report, research summary, or static mocks for review.
metadata:
  harness: [claude, codex]
  platform: [darwin, linux]
  scope: fleet
---

# HTML Communication

Long markdown in a terminal is hard to read. Anything with structure, comparison, or a diagram in it should be an HTML document with a URL instead.

## When to use it

Use it for plans, implementation proposals, audit and review reports, research summaries, option comparisons, and any UI or copy mock.

Do not use it for a short direct answer, for a single command or code snippet, or for files that belong in the repository. `ARCHITECTURE.md`, `AGENTS.md`, and PR descriptions stay markdown.

## Producing the document

Write a single self-contained HTML file to the scratchpad directory. Inline all CSS. No external stylesheets, fonts, scripts, or images.

Then publish and report only the URL. Do not also paste the document into the terminal.

- **Claude:** publish with the Artifact tool, passing the file path and a favicon. Redeploy the same file path to update in place rather than creating a second link.
- **Codex:** publish with the `file-upload` skill. If no upload target is reachable, report the absolute file path and say it was not published.

## House style

Every document looks the same so they are recognisable at a glance.

- True black `#000` background, white primary text
- Information-dense; content over chrome
- No decorative cards, pills, badges, or gradients
- No light-gray subtitle lines above sections
- Minimal copy; no em dashes
- No looping CSS animation (pulse, shimmer, blur, spinners) — they peg the GPU on high-refresh displays
- Wide content (tables, diagrams, code) scrolls inside its own container; the page body never scrolls horizontally

Prefer real headings, tables, and diagrams over prose. If a section is three sentences of throat-clearing, cut it.

## Diagrams

Include a diagram whenever it explains the change faster than a paragraph does: architecture, data flow, sequence, state.

Artifacts render Mermaid natively from ```mermaid fences or `<pre class="mermaid">` blocks. When publishing anywhere else, Mermaid will not render — use inline SVG instead.

## Mocks

For any non-trivial UI, layout, or copy change, build several distinct static mocks rather than editing real components.

Put them in one document so they can be compared side by side, label each one, and make them genuinely different approaches rather than three shades of the same idea. Publish, report the URL, and stop. Wait for a pick before touching real code.
