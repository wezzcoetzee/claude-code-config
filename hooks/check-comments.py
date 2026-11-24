#!/usr/bin/env python3
"""PostToolUse hook: warns when a file that was just written is mostly comments.

Code should explain itself, so a high comment ratio usually means naming or
structure needs work rather than more prose. Comments that carry information a
reader can't get from the code are exempt: docstrings, JSDoc, tool directives,
shebangs, TODO/FIXME, and BDD step markers.

Always exits 0. This is a nudge in the agent's context, not a gate — blocking a
write over a style signal would be worse than the comments it complains about.
"""

from __future__ import annotations  # `dict | None` on the 3.9 that ships with macOS

import json
import re
import sys
from pathlib import Path

MAX_COMMENT_RATIO = 0.25
MAX_FLAGGED_SHOWN = 5

HASH_LANGUAGES = {".py"}
SLASH_LANGUAGES = {".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".cpp", ".c", ".sol"}
CODE_EXTENSIONS = HASH_LANGUAGES | SLASH_LANGUAGES

INFORMATIVE_COMMENT_PATTERNS = [
    r'^\s*(#|//)\s*#?\s*(given|when|then|and|but)\b',  # BDD step markers
    r'^\s*("""|\'\'\')',                               # Python docstrings
    r'^\s*/\*\*',                                      # JSDoc / JavaDoc
    r'^\s*\*\s*@',                                     # JSDoc annotations
    r'^\s*(///|@dev|@param|@return|@notice)',          # Rust and Solidity doc comments
    r'^\s*#!',                                         # Shebang
    r'^\s*//\s*(@ts-|eslint-)',                        # TypeScript and ESLint directives
    r'^\s*#\s*(type:|noqa|pragma)',                    # Python directives
    r'^\s*(#|//)\s*(TODO|FIXME):',                     # Tracked follow-ups
]


def is_informative(line: str) -> bool:
    return any(re.match(p, line, re.IGNORECASE) for p in INFORMATIVE_COMMENT_PATTERNS)


def is_comment(line: str, ext: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if ext in HASH_LANGUAGES:
        return stripped.startswith("#")
    return stripped.startswith(("//", "/*", "*"))


def analyze(content: str, file_path: str) -> dict | None:
    ext = Path(file_path).suffix.lower()
    if ext not in CODE_EXTENSIONS:
        return None

    lines = content.split("\n")
    code_lines = [line for line in lines if line.strip()]
    if not code_lines:
        return None

    comment_count = 0
    flagged = []
    in_doc_block = False
    for number, line in enumerate(lines, 1):
        # A `/** ... */` block is documentation for its whole length, including
        # the delimiter lines and any prose between the annotations.
        if in_doc_block or re.match(r"^\s*/\*\*", line):
            comment_count += 1
            in_doc_block = "*/" not in line
            continue
        if not is_comment(line, ext):
            continue
        comment_count += 1
        if is_informative(line) or re.match(r"^\s*(/\*|\*/)\s*$", line):
            continue
        flagged.append((number, line.strip()))

    ratio = comment_count / len(code_lines)
    if ratio <= MAX_COMMENT_RATIO or not flagged:
        return None

    return {
        "total": len(code_lines),
        "comments": comment_count,
        "ratio": ratio,
        "flagged": flagged,
    }


def read_written_content(tool_name: str, tool_input: dict, file_path: str) -> str:
    if tool_name == "Write":
        return tool_input.get("content", "")
    if tool_name in ("Edit", "MultiEdit", "NotebookEdit") and Path(file_path).exists():
        try:
            return Path(file_path).read_text()
        except OSError:
            return ""
    return ""


def format_warning(result: dict) -> str:
    lines = [
        "",
        "---",
        f"**Comment check**: {result['ratio']:.0%} of lines are comments "
        f"({result['comments']}/{result['total']})",
        "",
        "These look like they restate the code rather than explain it:",
    ]
    for number, comment in result["flagged"][:MAX_FLAGGED_SHOWN]:
        excerpt = comment[:60] + ("..." if len(comment) > 60 else "")
        lines.append(f"  Line {number}: `{excerpt}`")
    remaining = len(result["flagged"]) - MAX_FLAGGED_SHOWN
    if remaining > 0:
        lines.append(f"  ... and {remaining} more")
    lines.extend([
        "",
        "Prefer descriptive names over narration, drop comments that repeat the code,",
        "and keep the ones that explain *why*.",
        "---",
    ])
    return "\n".join(lines)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_input = payload.get("tool_input", {})
    file_path = tool_input.get("file_path") or tool_input.get("filePath") or tool_input.get("path", "")
    if not file_path:
        sys.exit(0)

    content = read_written_content(payload.get("tool_name", ""), tool_input, file_path)
    if not content:
        sys.exit(0)

    result = analyze(content, file_path)
    if result:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": format_warning(result),
            }
        }))

    sys.exit(0)


if __name__ == "__main__":
    main()
