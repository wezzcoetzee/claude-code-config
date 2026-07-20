#!/bin/bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: composite.sh --shot SHOT.png --frame iphone|ipad|mac --size WxH \
  --headline TEXT [--subheadline TEXT] [--bg1 HEX] [--bg2 HEX] [--text HEX] \
  [--template PATH] --out OUT.png

Renders the marketing frame template around a raw capture using headless
Chrome. Override the browser with CHROME=/path/to/binary.
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHOT="" FRAME="" SIZE="" HEADLINE="" SUBHEADLINE="" OUT=""
BG1="#1a1a2e" BG2="#0f0f1a" TEXT="#FFFFFF"
TEMPLATE="$SCRIPT_DIR/../templates/frame.html"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --shot) SHOT="$2"; shift 2 ;;
    --frame) FRAME="$2"; shift 2 ;;
    --size) SIZE="$2"; shift 2 ;;
    --headline) HEADLINE="$2"; shift 2 ;;
    --subheadline) SUBHEADLINE="$2"; shift 2 ;;
    --bg1) BG1="$2"; shift 2 ;;
    --bg2) BG2="$2"; shift 2 ;;
    --text) TEXT="$2"; shift 2 ;;
    --template) TEMPLATE="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done
[[ -n "$SHOT" && -n "$FRAME" && -n "$SIZE" && -n "$HEADLINE" && -n "$OUT" ]] || usage
[[ -f "$SHOT" ]] || { echo "Shot not found: $SHOT" >&2; exit 1; }

CHROME="${CHROME:-}"
if [[ -z "$CHROME" ]]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "/Applications/Chromium.app/Contents/MacOS/Chromium" \
           "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
    [[ -x "$c" ]] && CHROME="$c" && break
  done
fi
[[ -n "$CHROME" ]] || { echo "No Chrome/Chromium found; set CHROME=/path/to/binary" >&2; exit 1; }

W="${SIZE%x*}" H="${SIZE#*x}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp "$SHOT" "$TMP/shot.png"

TEMPLATE="$TEMPLATE" FRAME="$FRAME" HEADLINE="$HEADLINE" SUBHEADLINE="$SUBHEADLINE" \
BG1="$BG1" BG2="$BG2" TEXT_COLOR="$TEXT" python3 - > "$TMP/frame.html" <<'EOF'
import html, os
page = open(os.environ["TEMPLATE"]).read()
for key, env in [("FRAME_CLASS", "FRAME"), ("HEADLINE", "HEADLINE"),
                 ("SUBHEADLINE", "SUBHEADLINE"), ("BG1", "BG1"),
                 ("BG2", "BG2"), ("TEXT", "TEXT_COLOR")]:
    page = page.replace("{{%s}}" % key, html.escape(os.environ.get(env, "")))
print(page)
EOF

mkdir -p "$(dirname "$OUT")"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size="$W","$H" \
  --screenshot="$TMP/out.png" "file://$TMP/frame.html" >/dev/null 2>&1
[[ -s "$TMP/out.png" ]] || { trap - EXIT; echo "Chrome produced no output; inspect $TMP" >&2; exit 1; }
mv "$TMP/out.png" "$OUT"
echo "$OUT"
