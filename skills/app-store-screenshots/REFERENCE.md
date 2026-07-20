# Reference

## App Store Connect screenshot sizes

| Slot | Pixels (portrait) | Capture device |
|---|---|---|
| iPhone 6.9" (required) | 1290×2796 or 1320×2868 | iPhone 17 Pro Max / 16 Pro Max sim |
| iPhone 6.5" (optional, scaled from 6.9" if absent) | 1242×2688 or 1284×2778 | iPhone 11 Pro Max sim (absent from recent Xcode; skip — the slot auto-scales from 6.9") |
| iPad 13" (required if iPad supported) | 2064×2752 or 2048×2732 | iPad Pro 13-inch sim |
| Mac (required for Mac apps) | 2880×1800, 2560×1600, 1440×900, or 1280×800 (16:10 only) | window capture, composite to 16:10 canvas |

Raw simulator captures come out at native device pixels (e.g. 1320×2868 on iPhone 17 Pro Max) and upload as-is. Framed composites can be rendered at any accepted size via `--size`.

Up to 10 screenshots per device slot. First 3 show in search results — put the strongest screens first.

## Manifest schema (`screenshots/manifest.json`)

```json
{
  "app": "Habits",
  "platform": "ios",
  "scheme": "Habits",
  "bundleId": "com.wcoetzee.Habits",
  "bg1": "#1C6227",
  "bg2": "#0F140F",
  "text": "#FFFFFF",
  "devices": [
    { "simulator": "iPhone 17 Pro Max", "frame": "iphone", "compositeSize": "1290x2796" }
  ],
  "screens": [
    {
      "id": "today",
      "launchArgs": ["-uiScreenshots", "-uiScreen", "today"],
      "headline": "Grow your habits",
      "subheadline": "One day at a time",
      "settle": 3
    }
  ]
}
```

For macOS apps: `"platform": "mac"`, replace `devices` with `"window": {"size": "1600x1000", "appName": "Habits"}`, use `"frame": "mac"` and a landscape `compositeSize` like `2880x1800`.

`launchArgs` presumes the app has a screenshot launch mode. The pattern worth adding when absent (DEBUG-only): a `-uiScreenshots` flag that swaps in an in-memory store seeded with rich deterministic demo data, plus `-uiScreen <name>` routing to open a given screen on launch.

## Capture details

- Status bar: `capture-ios.sh` overrides to 9:41, full battery/signal automatically (`simctl status_bar override`).
- Animations/celebrations: raise `--settle` (seconds between launch and screenshot) to catch a mid-celebration or post-animation frame.
- Dark mode variant: `xcrun simctl ui <udid> appearance dark` before launching.
- Locale variants: append `-AppleLanguages (fr) -AppleLocale fr_FR` to launch args.
- macOS: `screencapture -o -l <windowID>` captures one window without its shadow; the window ID is found by owner name via a CGWindowList Swift one-liner inside the script. Terminal needs Screen Recording permission, and Accessibility permission for the `--size` resize via System Events (both in System Settings → Privacy & Security). The capture has alpha corners; the `mac` frame drops it onto the gradient with a CSS shadow.
- Menu-bar apps (`LSUIElement: YES`): the UI usually lives in an NSPopover, which sits at a non-zero window layer — the window finder won't see it and System Events can't resize it. Add a DEBUG launch flag (e.g. `-uiScreenshots`) that presents the same content in a regular resizable NSWindow, and capture that.

## Compositing details

`composite.sh` fills `templates/frame.html` placeholders, then renders with headless Chrome (`--headless=new --screenshot --window-size=WxH --force-device-scale-factor=1`). Chrome path override: `CHROME=/path/to/chrome`.

To restyle frames (bezel proportions, typography, copy position), edit `templates/frame.html` — layout is vw-based so it scales across canvas sizes. Iterate by re-running composite.sh and reading the PNG; don't guess at CSS blind.

## Troubleshooting

- **Blank/white capture**: app still launching — raise `--settle`.
- **`simctl launch` fails with "not found"**: app not installed on that sim; the script installs, but check the `.app` path matches the booted device's architecture (`Debug-iphonesimulator`).
- **Launch args ignored (every screen shows the same first-launch state)**: the args must reach `simctl launch` as separate argv words. Joining them into one string breaks silently — `arguments.contains("-uiScreenshots")` never matches. When looping over the manifest, build a real array: `args=(); while IFS= read -r a; do args+=("$a"); done < <(jq -r '.launchArgs[]' <<<"$screen")` then pass `-- "${args[@]}"`. Unquoted `$args` does not split in zsh, and bash 3.2 collapses `"${arr[@]+"${arr[@]}"}"` (extra outer quotes) into one word. Also: the hook is usually `#if DEBUG` — build Debug config.
- **Chrome renders zero-size fonts or missing shot**: composite.sh copies the shot next to the generated HTML as `shot.png`; check the tmp dir it prints on failure.
- **macOS capture returns nothing**: Screen Recording permission missing, or window matched wrong process — pass the exact `--app-name` shown in the Dock.
