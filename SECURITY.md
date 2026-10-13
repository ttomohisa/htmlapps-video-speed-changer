# Security Policy

## Supported version and reporting

Security fixes target the latest version on the default branch. Do not publish sensitive vulnerability details in a public issue. Use the repository owner's private security reporting channel when available. Include the affected version/commit, reproduction steps, impact, and a minimal non-sensitive test file.

## Local processing boundary

Video Speed Changer has no application backend. Selected video, metadata and converted output remain in the browser until the user saves an MP4. The app does not upload videos, use a runtime CDN/API, collect analytics/telemetry, load remote fonts, or check for updates.

Both ST and MT releases embed the FFmpeg browser runtime and JS/WASM core; MT embeds its pthread Worker too. CSP preserves `connect-src 'none'`, blocks frames/objects/forms/base URLs, and allows only the local Blob/script/media and WASM permissions required for conversion. `'wasm-unsafe-eval'` permits WASM compilation without generic JavaScript `'unsafe-eval'`.

ST supports direct-file/offline operation. MT requires a secure isolated host, `crossOriginIsolated === true` and SharedArrayBuffer. Direct-file or unsupported MT contexts must block runtime loading, conversion and fallback inspection; they must not silently fetch or switch runtimes. Moving to ST does not transfer a selected video.

## Hosted MT helper boundary

Raw ST and MT HTML contain no service-worker helper reference. The separate GitHub Pages MT wrapper may fetch `./coi-serviceworker.js` from the same origin, register it at the script directory (`/mt/`, including any project base path), and reload the page to establish isolation. It loads only when `window.crossOriginIsolated === false`. This is a documented hosting request, not permission to upload videos or fetch runtime processing assets.

The unmodified coi-serviceworker 0.1.7 bytes are pinned by commit and SHA-256 in `coi-serviceworker.lock.json`; staging verifies their hash before writing the site. The helper injects COOP/COEP into responses and, in its pinned require-corp mode, uses its upstream CORP `cross-origin` value. It does not cache the application for offline use. A service worker persists until removed by the browser/user; it must remain restricted to the dedicated MT directory. Do not introduce a root-scope registration or `Service-Worker-Allowed: /`.

Hosts with server isolation skip the helper. Cloudflare `_headers` applies COOP `same-origin`, COEP `require-corp` and CORP `same-origin` only to `/mt/*`; never broaden those headers to unrelated site routes without review. The preview-only `/pages-bootstrap/mt/` fixture deliberately lacks that server header rule, uses identical wrapper/helper bytes with a narrower directory scope, and exists solely for first-load/reload QA. Normal GitHub Pages staging excludes it.

Do not describe loading a hosted MT URL as zero-network or offline operation. Verify both first-load helper behavior and already-isolated hosting separately.

## Supply-chain integrity

- Builder v1.10.6 `video-speed-changer` ST/MT assets are pinned by exact release/asset identity, size and SHA-256.
- Pin/import validates the selected variant, profile/version, threading flags, decompressed JS/WASM, and MT pthread payload; never edit a hash to bypass a mismatch.
- Stable artifacts require `github-release` provenance. Local Builder output is for development and fails the release provenance gate.
- Each variant has separate dependency/restoration manifests and size reports. Self-extract restoration must match its readable source byte-for-byte.
- Any configured npm dependencies remain version-pinned with committed tarball hashes.
- Review upstream source, runtime changes, license notices and corresponding-source requirements before upgrades.

A generated HTML is executable code. Distribute it through trusted channels and verify hashes where needed. Build-time release requests are distinct from browser runtime behavior.

## Untrusted local files and cleanup

Media files can be malformed or exhaust memory. Validate basic type/metadata before expensive operations, avoid unbounded allocation where practical, and show concise errors with optional technical details. Cancel/replace/reset must stop obsolete Workers, revoke Blob URLs and guard all asynchronous callbacks by source/generation. A failed or cancelled reconversion must retain a valid older result without mislabeling it. Never upload a problematic file as a fallback.

## Verification limits

Static checks and deterministic lifecycle/CDP tests are guardrails, not proof of real browser behavior. Before release, exercise real media, direct ST files, isolated MT hosting, first-load Pages helper/reload, cancellation, network logging and output saving. Record unverified cases explicitly in `REGRESSION.md`.
