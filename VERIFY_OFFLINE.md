# v1.1.0 release, offline and isolation verification

ST and MT use separate Builder v1.10.6 assets and separate raw/self-extract artifacts. ST is the direct-file/offline requirement. MT needs isolated hosting; an embedded runtime does not remove that requirement. Record what was actually executed in `REGRESSION.md`.

## 1. Pin and complete build

Confirm schemaVersion 2 `ffmpeg.release.json` / `ffmpeg.release.lock.json` agree on:

- `ttomohisa/htmlapps-ffmpeg-wasm-builder`, tag `v1.10.6`, profile `video-speed-changer`.
- ST: `ffmpeg-wasm-video-speed-changer-single-thread-v1.10.6.zip`.
- MT: `ffmpeg-wasm-video-speed-changer-multi-thread-v1.10.6.zip`.
- Each variant's real SHA-256, positive release/asset identity and byte count.

For an intentional upgrade only, run `pin-ffmpeg-release.bat`, review the downloaded assets and metadata, and commit the verified lock. Never hand-edit hashes or resolve `latest` in a normal build.

With Node.js 24 and PowerShell available, run:

```powershell
./scripts/check-repository.ps1
```

This is the canonical CI/Pages/preview gate. A normal build-only entry is `build-standalone.bat`. `build-with-local-ffmpeg.bat` is not a stable release source. Both generated dependency manifests must record `github-release` provenance with the matching variant, Builder version, asset and hash. MT must include its pthread Worker and the isolation capability flags.

Check the four raw HTML artifacts, both root aliases, both dependency/restoration manifests and both size reports. Self-extract payloads must match their respective readable HTML byte-for-byte. Do not mistake a successful source-only test for a verified generated artifact.

## 2. ST readable HTML through file://

Open `dist/index.html` or `video-speed-changer.html` directly, with network disconnected after obtaining the file. Use DevTools Network with Preserve log enabled:

1. Reload; confirm the ST badge and Japanese/English UI.
2. Select a non-sensitive test video and preview it.
3. Test representative speeds including 0.25×, 1.33×, 2× and 4×, and target-duration range/suggestion behavior.
4. Convert with preserve-pitch, pitch-shift and remove-audio modes; also test an audio-less source.
5. Preview output, edit a filename and save; inspect the saved MP4's duration, orientation, audio and filename.
6. Cancel conversion and confirm source/settings remain usable.
7. With an older successful result, cancel/fail a reconversion and verify the older result and matching filename survive.
8. Replace/reset source during work and verify late callbacks cannot overwrite the new source.
9. Exercise fallback inspection with a suitable native-preview-unavailable fixture, when available.

Expected: no HTTP(S), XHR/fetch, WebSocket/EventSource, CDN/font/analytics/telemetry request. Blob URLs and Worker activity are local and expected.

## 3. ST self-extract through file://

Repeat the main flow with `dist/index.self-extract.html`. Confirm loader favicon, no corrupted Japanese text, restored app, actual conversion/save and the same network boundary. Static decompression verification alone does not exercise the browser loader.

## 4. MT rejection and server-isolated hosting

First open both `dist/index.mt.html` and `dist/index.mt.self-extract.html` directly. Confirm clear bilingual direct-file guidance, blocked conversion/FFmpeg inspection, and no attempted runtime startup/download. Following the ST link must not automatically transmit the selected video.

Then serve the raw MT files from a secure host (or supported loopback origin) with COOP `same-origin`, COEP `require-corp`, CORP `same-origin`. Confirm:

- The exact requested document URL is loaded.
- `crossOriginIsolated === true` and SharedArrayBuffer is available.
- The MT badge, real conversion, cancellation, source replacement, old-result retention, filename editing and output validity work.
- There is no runtime external asset request or video upload.
- Raw MT and self-extract MT behave consistently.
- An unisolated host or unavailable SharedArrayBuffer blocks processing with hosting/browser guidance.

Do not claim MT is universally faster. Record browser/version, fixture, measured timings if measured, and memory limitations. A native FFmpeg test is not an MT WASM browser test.

## 5. Hosted wrapper and service-worker boundary

Inspect `pages-dist/` produced by the canonical gate:

- Root ST is identical to raw ST and has no helper reference.
- `/mt/index.mt.html` is identical to raw MT.
- `/mt/index.html` has only the conditional same-origin helper bootstrap.
- The staged helper matches the committed SHA-256 and ships its MIT notice.
- `_headers` contains only `/mt/*` with the three server isolation headers.

On the server-isolated Cloudflare `/mt/` route, use a fresh browser context to confirm isolation on the exact URL and no fallback script request. CI's real Chromium check verifies the exact URL and both capabilities; it does not verify conversion or first-load service-worker bootstrap.

For Pages behavior, use the actual GitHub Pages `/mt/` deployment or the preview-only `/pages-bootstrap/mt/` QA URL. The preview workflow stages the latter with `prepare-pages.ps1 -PreviewBootstrapCheck` outside the `/mt/*` server-header rule. Normal Pages output excludes it.

In a fresh browser context without an existing registration:

1. Verify the initial response lacks the server isolation headers.
2. Observe the same-origin helper request, its directory-only registration and bootstrap reload.
3. Confirm the final exact URL is isolated, SharedArrayBuffer exists and real MT conversion succeeds.
4. Inspect worker scope: project `/htmlapps-video-speed-changer/mt/` or preview `/pages-bootstrap/mt/`, never site root.
5. Visit ST root and confirm it is not controlled by that worker.
6. Verify no selected video leaves the browser. The helper/reload is a hosting exception, not a runtime CDN or upload.

The helper is not an offline cache. Do not promise hosted MT works disconnected just because it has been opened once. The pinned upstream helper uses CORP `cross-origin` in its require-corp mode; Cloudflare server configuration uses CORP `same-origin`.

## 6. UI, browser and device coverage

Check Japanese/English and desktop/320/360/390px layouts: no overflow, readable variant/blocked notices, usable speed/target fields, visible progress/cancel/result/save, long filenames, keyboard focus and reduced motion, and viewport-safe dialogs. Cover empty/loading/ready/preview-unavailable/processing/cancel/result/stale-result/error states. Verify portrait/rotation input and explicit export filename.

Review console and network logs throughout. Record unavailable browser/device/media cases honestly; deterministic DOM/runtime/CDP doubles are not substitutes for these checks.
