---
name: principle-html-communication
description: Use when a plan, design doc, audit report, research summary, comparison, or UI mock should go out as a hosted HTML page instead of long terminal markdown.
model: sonnet
---

# HTML communication

Long markdown in a terminal is hard to read. Anything with structure, comparison, or a diagram in it goes out as an HTML page with a URL.

## When

Plans, implementation proposals, audit and review reports, research summaries, option comparisons, and any UI or copy mock.

A short direct answer, a single command, or a code snippet stays in the terminal. Files that belong in the repository (`ARCHITECTURE.md`, `AGENTS.md`, PR descriptions) stay markdown.

## Producing the page

Write one self-contained HTML file to the scratchpad directory, with all CSS inline and no external stylesheets, fonts, scripts, or images.

Publish it with the Artifact tool and report only the URL; the page is the answer, so leave its content out of the terminal. Redeploy the same file path to update it in place. In a harness without the Artifact tool, give the file path instead.

## Style

- A document (plan, report, summary, comparison) follows the `principle-reports` skill.
- A mock follows the `principle-ui` skill.

Every page, either way:
- Wide content (tables, diagrams, code) scrolls inside its own container; the page body never scrolls horizontally.
- Motion is one-shot transitions; looping CSS animation (pulse, shimmer, blur, spinners) pegs the GPU on high-refresh displays.
- Minimal copy, and no em dashes.

## Diagrams

Include a diagram whenever it explains faster than a paragraph: architecture, data flow, sequence, state.

Artifacts render Mermaid natively from ```` ```mermaid ```` fences or `<pre class="mermaid">` blocks. Anywhere else Mermaid will not render, so use inline SVG.

## Mocks

For any non-trivial UI, layout, or copy change, build several distinct static mocks rather than editing real components.

Put them in one page so they compare side by side, label each one, and make them genuinely different approaches rather than three shades of one idea. Publish, report the URL, and stop. Wait for a pick before touching real code.
