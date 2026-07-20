---
name: app-store-screenshots
description: Capture App Store screenshots from iOS simulators or macOS app windows, then composite them into framed marketing images (device bezel, headline, brand gradient) at exact App Store Connect sizes. Use when the user wants App Store screenshots, marketing images, promo shots, or store listing assets for an iOS or macOS app.
---

# App Store Screenshots

Produces two tiers of output per screen: the **raw capture** (iOS simulator shots are uploadable to App Store Connect as-is; raw macOS window captures are not — they come out at retina 2× of the window size, not an accepted 16:10 size, so upload the composite instead) and a **framed marketing image** (device bezel + headline + brand gradient, rendered from HTML via headless Chrome).

## Workflow

1. **Find or create the manifest.** Look for `screenshots/manifest.json` in the repo root. If missing, create one (schema in [REFERENCE.md](REFERENCE.md)): inspect the app for a screenshot/demo launch mode, deep links, scheme and bundle ID, and brand colors from the asset catalog. If the app has no way to reach each screen with seeded demo data, add a `-uiScreenshots`-style launch argument hook first (in-memory store + deterministic sample data) — never photograph an empty first-launch state.

2. **Build.** iOS: `xcodebuild -scheme <scheme> -destination 'platform=iOS Simulator,name=<device>' -derivedDataPath build build`. The `.app` lands in `build/Build/Products/Debug-iphonesimulator/`. macOS: build for `platform=macOS`.

3. **Capture** each screen in the manifest:
   - iOS: `scripts/capture-ios.sh --device "iPhone 17 Pro Max" --app <path.app> --bundle-id <id> --out raw/<screen>.png -- <launch args>`. Launch args MUST be separate argv words — build a shell array from the manifest, never a joined string (see troubleshooting in REFERENCE.md).
   - macOS: `scripts/capture-macos.sh --app <path.app> --app-name <Name> --size 1600x1000 --out raw/<screen>.png` (needs Screen Recording + Accessibility permission for the terminal; quits and relaunches the app so each screen's launch args take effect)

4. **Composite** each capture into a marketing frame:
   ```
   scripts/composite.sh --shot raw/today.png --frame iphone --size 1290x2796 \
     --headline "Grow your habits" --subheadline "One day at a time" \
     --bg1 "#1C6227" --bg2 "#0F140F" --text "#FFFFFF" --out framed/today.png
   ```
   Frames: `iphone` (bezel + dynamic island), `ipad` (bezel), `mac` (floating window, no bezel).

5. **Review and iterate.** Read every output PNG yourself and check: content fully rendered (not mid-animation — raise `--settle` if so), headline not clipped or overlapping the device, status bar showing 9:41/full battery, correct screen actually captured. Fix and re-run until all pass, then show the user the output directory.

## Output layout

```
screenshots/
├── manifest.json
├── raw/<device-size>/<screen>.png      # upload these to App Store Connect
└── framed/<device-size>/<screen>.png   # marketing / promo images
```

## Required sizes, manifest schema, troubleshooting

See [REFERENCE.md](REFERENCE.md).
