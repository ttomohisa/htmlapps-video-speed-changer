# Architecture

## Source and release boundaries

One editable app template produces independent ST and MT distributions. Both share the speed-changing UI, local media handling, source/result lifecycle and output formats.

```text
app.config.json                     Product version (1.1.0)
APP_SPEC.md                         Product and acceptance contract
src/index.template.html             Shared editable application
ffmpeg.release.json                 Builder v1.10.6 profile/variant selection
ffmpeg.release.lock.json            Verified exact ST/MT release identities/hashes
build-standalone.ps1                 Pinned import, variant generation and verification
scripts/check-repository.ps1         Canonical complete build/regression gate
scripts/prepare-pages.ps1            Separate hosted staging
```

Generated raw outputs must never be manually edited:

- ST: `dist/index.html`, `dist/index.self-extract.html`, root `video-speed-changer.html`.
- MT: `dist/index.mt.html`, `dist/index.mt.self-extract.html`, root `video-speed-changer.mt.html`.
- Separate `dependency-manifest[.mt].json`, `self-extract-manifest[.mt].json`, and `build-size-report[.mt].json` in `dist/`.

Normal builds refresh both root downloads; custom output builds leave them unchanged. `pages-dist/` is disposable hosting output, not a raw release.

## Pinned variant build

1. Read app configuration, dependency configuration/lock and the schemaVersion 2 FFmpeg release config/lock.
2. Resolve only the two locked Builder v1.10.6 `video-speed-changer` assets; verify each downloaded/cached ZIP size and SHA-256 before extraction.
3. Validate profile, version, ST/MT capabilities, browser runtime APIs, inflated JS/WASM and MT pthread Worker. Do not allow one variant to substitute for the other.
4. Import reviewed payloads with `github-release` provenance. Development-only `local-builder` provenance is rejected by the stable artifact check.
5. Embed UI, favicon, runtime and all processing bytes into each raw readable HTML. Preserve direct embedded JSON rather than wrapping the complete asset bundle in another Base64 layer.
6. Produce an ASCII-only gzip self-extract loader for each variant, inheriting its readable favicon. Validate byte counts, SHA-256 metadata and exact restored bytes.
7. Write separate dependency/restoration/size manifests, verify release/source/root parity, and run lifecycle tests across variant/release forms.
8. Stage hosted pages only after raw release validation and run staging/isolation-helper regressions.

Configured npm dependencies remain pinned to exact versions and verified tarball SHA-256. Scheduled update discovery may maintain a review Issue but does not automatically upgrade packages, commit changes or open dependency PRs.

## Runtime and state ownership

The build manifest determines ST versus MT; runtime selection is not inferred from a URL. ST uses the compatible single-thread runtime and works directly via `file://`. MT embeds pthread support and requires non-file loading, cross-origin isolation and SharedArrayBuffer before cached/fresh loader use, conversion or fallback inspection. Unsupported MT remains readable with localized guidance and a standard-app link; it does not silently fetch or substitute a different runtime.

MT budgets: pool 8, video decoder 2, H.264 encoder 4, x264 lookahead 1; audio and filtergraphs stay single-threaded. Device/browser memory and actual media determine performance.

Changing source is a generation boundary. Abort old work, clear prior derived metadata/errors/results, revoke obsolete Blob URLs, and reject late progress/result/error/finalization callbacks. Cancelling/failing a reconversion retains any valid previous result with its own settings and automatic filename. Only a successful replacement updates that pair. User-edited filenames survive attempts on the same source.

The selected speed is canonical. Opening target-duration controls shows a bounded whole-second suggestion without changing speed, playback rate, filename or result freshness. Deliberate target edits invoke range validation and speed calculation.

## Hosted staging and isolation

Raw ST is staged at `/`; raw MT is also available as `/mt/index.mt.html`. The `/mt/index.html` wrapper is a separate copy that conditionally loads the pinned, same-origin `./coi-serviceworker.js` only when `window.crossOriginIsolated === false`. The worker registers at its default script-directory scope; project Pages prefixes remain inside that scope. Staging verifies its committed hash and ships its MIT notice. No raw artifact is modified to reference the helper.

Cloudflare `_headers` contains only `/mt/*` with COOP `same-origin`, COEP `require-corp`, CORP `same-origin`. GitHub Pages ignores that file and relies on the helper to inject COOP/COEP and reload. The unmodified helper's CORP value is upstream `cross-origin`, distinct from the server-header configuration. Already-isolated hosts skip the fallback.

Preview-only `-PreviewBootstrapCheck` adds an identical MT directory at `/pages-bootstrap-control-ready/mt/` outside the header rule so real browser QA can exercise first-load service-worker bootstrap/reload. Normal Pages output does not include it. The relative helper URL automatically keeps the fixture scope narrow.

[Multi-thread deployment](MULTI_THREAD_DEPLOYMENT.md) documents host configuration and Browser Kitty integration instructions. Do not infer live integration from those instructions.

## Privacy and security

Selected videos never leave the app for a server. Runtime FFmpeg downloads, CDN/API calls, fonts, analytics and telemetry are forbidden. CSP retains `connect-src 'none'` plus blocked objects/frames/forms/base URLs; required Blob and `'wasm-unsafe-eval'` permissions support embedded processing.

Raw ST and MT have no runtime HTTP requests. Hosted MT allows its documented same-origin helper request and reload only; it is neither a media-upload path nor an offline cache. Build-time dependency/release access is separate. See [SECURITY.md](../SECURITY.md).

## Verification layers

- Artifact validation: exact pins/provenance, embedded payloads, capabilities, CSP, favicon, restoration and separate manifests.
- Lifecycle tests: actual app script with synthetic DOM/media/runtime boundaries, applied to source and release variants.
- Deployment tests: actual PowerShell staging in temporary synthetic fixture roots; helper hash, raw preservation, failure-before-replacement, scope/header separation and workflow/browser-path wiring.
- CDP regressions: exact target/location matching, delayed/blank/wrong URLs, absent capabilities, bounded transport waits and cleanup.
- Preview browser check: real Chromium at the exact server-isolated MT URL.
- Manual/authorized browser QA: real conversion, direct ST files, isolated MT, Pages-helper first load/reload, saving, console/network, responsive and accessible UI. Deterministic tests do not replace this layer.

Build/Pages/preview use the same `scripts/check-repository.ps1` gate with Node 24. Preview cleanup and unrelated dependency discovery retain their separate bounded purposes.

## Reusable source components and assets

`components/` contains source snippets copied/adapted into the one-file app, not runtime downloads. Preserve accessibility, state ownership, cleanup and relevant component contracts. See `COMPONENTS.md` and `LLM_WORKFLOW.md`.

`window.StandaloneAssets` is the documented embedded-asset API. Compressed assets use asynchronous bytes/text/Blob loaders and native `DecompressionStream`; revoke Blob URLs when no longer needed. Module loading does not rewrite relative imports, so third-party modules must be self-contained or bundled before embedding. Never replace the complete embedded asset JSON with a second Base64 wrapper.
