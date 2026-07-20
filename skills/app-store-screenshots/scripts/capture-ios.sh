#!/bin/bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: capture-ios.sh --device NAME --app PATH.app --bundle-id ID --out OUT.png [--settle SECONDS] [--appearance light|dark] [-- LAUNCH_ARGS...]

Boots the simulator if needed, overrides the status bar (9:41, full battery),
installs the app, launches it with LAUNCH_ARGS, waits, and screenshots.
EOF
  exit 1
}

DEVICE="" APP="" BUNDLE_ID="" OUT="" SETTLE=3 APPEARANCE="light"
LAUNCH_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --app) APP="$2"; shift 2 ;;
    --bundle-id) BUNDLE_ID="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --settle) SETTLE="$2"; shift 2 ;;
    --appearance) APPEARANCE="$2"; shift 2 ;;
    --) shift; LAUNCH_ARGS=("$@"); break ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done
[[ -n "$DEVICE" && -n "$APP" && -n "$BUNDLE_ID" && -n "$OUT" ]] || usage
command -v jq >/dev/null || { echo "jq is required (brew install jq)" >&2; exit 1; }

UDID=$(xcrun simctl list devices available -j \
  | jq -r --arg n "$DEVICE" '[.devices[][] | select(.name == $n)][0].udid // empty')
[[ -n "$UDID" ]] || { echo "No available simulator named '$DEVICE'" >&2; exit 1; }

STATE=$(xcrun simctl list devices -j | jq -r --arg u "$UDID" '[.devices[][] | select(.udid == $u)][0].state')
if [[ "$STATE" != "Booted" ]]; then
  xcrun simctl boot "$UDID"
fi
xcrun simctl bootstatus "$UDID" -b >/dev/null

xcrun simctl ui "$UDID" appearance "$APPEARANCE"
xcrun simctl status_bar "$UDID" override \
  --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiBars 3 --operatorName ""

xcrun simctl install "$UDID" "$APP"
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl launch "$UDID" "$BUNDLE_ID" ${LAUNCH_ARGS[@]+"${LAUNCH_ARGS[@]}"} >/dev/null

sleep "$SETTLE"
mkdir -p "$(dirname "$OUT")"
xcrun simctl io "$UDID" screenshot --type png "$OUT" >/dev/null
echo "$OUT"
