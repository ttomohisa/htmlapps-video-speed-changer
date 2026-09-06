# v1.0.0 stable release verification

v1.0.0 treats the pinned Builder release, `dist/index.html`, and `dist/index.self-extract.html` as one release chain.

## 1. Builder release pin

Before running the stable build:

1. Confirm `ttomohisa/htmlapps-ffmpeg-wasm-builder` v1.8.1 is published.
2. Confirm the release contains `ffmpeg-wasm-video-speed-changer-v1.8.1.zip`.
3. Run `pin-ffmpeg-release.bat`.
4. Confirm `ffmpeg.release.lock.json` now has:
   - a 64-character lowercase `sha256`,
   - positive `releaseId`, `assetId`, and `assetBytes`,
   - tag `v1.8.1`,
   - profile `video-speed-changer`,
   - Builder version `1.8.1`.
5. Commit that lock before release builds.

The pin script must verify both GitHub release metadata and the downloaded archive contents before writing the lock.

## 2. Build

Run:

```bat
build-standalone.bat
```

Do **not** use `build-with-local-ffmpeg.bat` for the stable release.

The build must finish with the release-artifact verification success message and must record `github-release` provenance in `dist/dependency-manifest.json`.

Confirm the provenance includes the same release tag / asset / SHA-256 as `ffmpeg.release.lock.json`.

## 3. Readable single HTML via file://

Open `dist/index.html` directly from Explorer.

With DevTools Network open and Preserve log enabled:

1. Reload the local file.
2. Select a test video.
3. Change speed.
4. Convert.
5. Preview the result.
6. Save the MP4.
7. Repeat for pitch preservation, pitch shifting, and audio removal.
8. Cancel an active conversion and confirm controls recover.
9. Reconvert, cancel, and confirm any older result remains available.
10. Test a source that browser-native preview cannot decode when available; confirm FFmpeg inspection fallback is clear.

Expected runtime network behavior:

- no HTTP/HTTPS request,
- no XHR/fetch request,
- no WebSocket/EventSource,
- no CDN/font/image/analytics/telemetry request.

Blob URLs and Worker activity are expected and local.

## 4. Self-extract HTML via file://

Open `dist/index.self-extract.html` directly.

Confirm:

- loader favicon appears,
- Japanese text is not mojibake,
- restored app loads,
- video selection/preview/conversion/save work,
- the same runtime network expectations hold.

`scripts/verify-self-extract.ps1` must report byte-for-byte restoration against `dist/index.html`.

## 5. Smartphone / narrow viewport

Check at least 320px, 360px, and 390px widths:

- no horizontal scrolling,
- video does not overflow,
- buttons do not overlap,
- long filenames wrap,
- target-duration fields remain usable,
- progress/cancel controls fit,
- result preview and save controls remain visible,
- help and confirmation dialogs remain inside the viewport.

## 6. Language and states

Check Japanese and English for:

- empty,
- loading,
- ready,
- preview unavailable,
- processing,
- cancelled,
- completed result,
- stale previous result,
- memory/unsupported/runtime error states.

## 7. Static release checks

`build-standalone.bat` / `scripts/check-release-artifacts.ps1` must verify:

- readable standalone structure and CSP,
- embedded favicon,
- embedded FFmpeg JS/WASM validity,
- Builder v1.8.1 profile/runtime flags,
- `github-release` provenance,
- release-asset SHA-256 matches the committed lock,
- no external runtime resource references,
- self-extract source/gzip SHA-256 metadata,
- exact self-extract restoration,
- app version and required dist files.

A local-builder build may be used for development, but must not pass the release provenance gate.
