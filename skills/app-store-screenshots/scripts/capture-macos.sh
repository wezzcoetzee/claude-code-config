#!/bin/bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: capture-macos.sh --app PATH.app --app-name NAME --out OUT.png [--size WxH] [--settle SECONDS] [-- LAUNCH_ARGS...]

Quits any running instance, relaunches the app with LAUNCH_ARGS, optionally
resizes its front window, finds the window ID by owner name, and captures
just that window (no shadow, alpha corners preserved). Requires Screen
Recording permission for the terminal running this script, plus
Accessibility permission when --size is used.
EOF
  exit 1
}

APP="" APP_NAME="" OUT="" SIZE="" SETTLE=3
LAUNCH_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    --app-name) APP_NAME="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --size) SIZE="$2"; shift 2 ;;
    --settle) SETTLE="$2"; shift 2 ;;
    --) shift; LAUNCH_ARGS=("$@"); break ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done
[[ -n "$APP" && -n "$APP_NAME" && -n "$OUT" ]] || usage

if pgrep -xq "$APP_NAME"; then
  osascript -e "quit app \"$APP_NAME\"" || true
  for _ in $(seq 1 20); do pgrep -xq "$APP_NAME" || break; sleep 0.5; done
  pgrep -xq "$APP_NAME" && { echo "Could not quit running '$APP_NAME'" >&2; exit 1; }
fi

open -a "$APP" --args ${LAUNCH_ARGS[@]+"${LAUNCH_ARGS[@]}"}
sleep "$SETTLE"

if [[ -n "$SIZE" ]]; then
  W="${SIZE%x*}" H="${SIZE#*x}"
  osascript -e "tell application \"System Events\" to tell process \"$APP_NAME\"
    set position of front window to {80, 60}
    set size of front window to {$W, $H}
  end tell"
  sleep 1
fi

WINDOW_ID=$(swift - "$APP_NAME" <<'EOF'
import CoreGraphics
let name = CommandLine.arguments[1]
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in list
where (w["kCGWindowOwnerName"] as? String) == name && (w["kCGWindowLayer"] as? Int) == 0 {
    print(w["kCGWindowNumber"] as! Int)
    break
}
EOF
)
[[ -n "$WINDOW_ID" ]] || { echo "No on-screen window found for '$APP_NAME'" >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
screencapture -o -l "$WINDOW_ID" "$OUT"
echo "$OUT"
