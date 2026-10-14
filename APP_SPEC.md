# APP_SPEC.md

## 1. Product identity

- **English name:** Video Speed Changer
- **Japanese name:** 動画速度変更
- **Slug:** `video-speed-changer`
- **Repository:** `ttomohisa/htmlapps-video-speed-changer`
- **Current package version:** `1.1.1`
- **Release artifacts:** ST `dist/index.html` / `dist/index.self-extract.html`; MT `dist/index.mt.html` / `dist/index.mt.self-extract.html`; root aliases `video-speed-changer.html` / `video-speed-changer.mt.html`
- **Builder dependency:** `ttomohisa/htmlapps-ffmpeg-wasm-builder` v1.10.6 / `video-speed-changer`

### One-sentence purpose

Change a video's speed and save the result as MP4 while showing the resulting duration before conversion and allowing a target duration to determine the needed speed.

## 2. Product scope

The app is a focused speed-changing utility, not a general-purpose video editor.

Core user flow:

1. Select or drop one video.
2. Preview the video or inspect it with FFmpeg when browser-native metadata fails.
3. Choose a speed from 0.25x to 4.00x, or enter a target duration.
4. See the resulting duration and time difference immediately.
5. Preview the selected speed before conversion when native preview is available.
6. Choose audio behavior and basic quality.
7. Convert locally in the browser; cancellation must stop the active Worker.
8. Preview the result.
9. Edit the output filename and save an MP4.

## 3. Shared ST / MT behavior

### Speed and duration

- 0.25x through 4.00x.
- Direct numeric input supports values such as 1.33x and 1.67x.
- `result duration = source duration / speed`.
- `speed = source duration / target duration`.
- The selected speed is the canonical internal value.
- Opening/closing target-duration settings never applies its rounded suggestion or changes selected speed, preview playback rate, automatic/edited filename, or result freshness. Only deliberately editing a target field invokes the existing calculation, range validation, and three-decimal speed rounding.
- With finite positive source duration `D`, show a read-only Japanese/English whole-second input range: `max(1, ceil(D / 4))` through `min(3599999, floor(D / 0.25))`. The upper input limit is 999:59:59. Do not round endpoints outward.
- If no whole-second target fits both the speed range and input limits, explain that users can set speed directly. Without valid metadata, hide the range rather than guessing. Refresh guidance after source replacement, native/fallback metadata, and language changes.
- Auto-filled target fields are suggestions rounded to whole seconds and bounded by the existing input limits; opening them must not create zero/out-of-range validation errors. Deliberate zero/out-of-range edits keep the existing messages and do not apply a new speed.
- Browser preview uses `playbackRate` without re-encoding.

### Audio

- Preserve pitch: default ON.
- Preserve pitch OFF: pitch changes with speed.
- Remove audio: output contains no audio stream.
- Audio-less source videos remain valid inputs.

### Output

- MP4 container.
- H.264 video.
- AAC audio when retained.
- Source dimensions/orientation preserved unless FFmpeg must normalize rotation metadata to keep the visual orientation correct.
- Quality presets: High quality / Standard / Smaller file.
- Editable base filename with `.mp4` kept outside user input.
- Converted-video preview before saving.
- Original → converted duration and file-size comparison.

### Conversion lifecycle

- Conversion runs in a Worker.
- `AbortSignal` cancellation terminates the active Worker.
- Cancellation retains the source/settings and does not turn into a user-facing error.
- If an earlier successful result exists, cancelling or failing a reconversion keeps that older result, settings snapshot, preview URL, and automatic filename available.
- The automatic filename changes to match the newly converted speed only when a replacement result succeeds. A user-edited filename is preserved across attempts for the same source.
- Replacing/resetting the source clears the prior result and conversion error/details, aborts and invalidates any old conversion, and immediately restores usable controls. Late progress, results, errors, cancellation notices, and finalizers from an old conversion must not affect the newer source.
- Generation guards prevent stale inspection/conversion results from overwriting a newer source.
- Blob URLs and Workers are released on source replacement, reconversion, cancellation, and page exit.

### Browser-preview fallback

If browser-native metadata/preview loading fails, FFmpeg media inspection may recover:

- duration,
- dimensions,
- rotation,
- audio-stream presence.

When inspection succeeds, the UI explicitly says preview is unavailable but conversion can be attempted. Preview failure must not be presented as proof that conversion will fail.

## 4. v1.1.1 pinned ST / MT dependency contract

`ffmpeg.release.json` and `ffmpeg.release.lock.json` use schemaVersion 2 and select exactly:

- repository: `ttomohisa/htmlapps-ffmpeg-wasm-builder`
- tag / Builder version: `v1.10.6` / `1.10.6`
- profile: `video-speed-changer`
- ST asset: `ffmpeg-wasm-video-speed-changer-single-thread-v1.10.6.zip`
- MT asset: `ffmpeg-wasm-video-speed-changer-multi-thread-v1.10.6.zip`

Pinning verifies each GitHub Release asset digest, actual SHA-256 and byte count, matching profile/version/threading capabilities, inflated JS/WASM bytes, browser runtime cancellation/inspection APIs, and MT pthread Worker payload. The lock records exact release/asset identities, sizes and hashes. It must be reviewed and committed; never invent a hash or resolve `latest` during a normal build.

`build-standalone.bat` imports both locked assets via SHA-keyed caches, validates their contents and `github-release` provenance, embeds all required processing bytes, writes separate manifests and size reports, and refreshes both root readable downloads. Custom output builds must not change those checked-in root downloads. CI, Pages and Cloudflare preview builds use the same canonical `scripts/check-repository.ps1` gate with Node.js 24.

`build-with-local-ffmpeg.bat <builder-root>` is a Builder-development path. Its `local-builder` provenance is not accepted as a stable release. Local output must satisfy the same applicable variant/runtime capability checks.

## 5. Single-HTML, isolation and privacy contract

### Raw artifacts

Each ST or MT readable HTML embeds UI/CSS/JavaScript, browser runtime, gzip-compressed FFmpeg JS/WASM and favicon. MT also embeds its pthread Worker payload. No runtime FFmpeg download is permitted. Each self-extract artifact restores its corresponding readable HTML byte-for-byte from an embedded gzip payload.

ST supports direct `file://` opening and offline processing after the file is obtained. MT is a one-file processing artifact, but requires isolated hosting: a secure HTTP(S) context, `crossOriginIsolated === true`, and a `SharedArrayBuffer` function. MT must refuse direct-file, unisolated or missing-SharedArrayBuffer execution before cached/fresh loader use, conversion or FFmpeg fallback inspection. It must not silently switch to ST.

The runtime variant is derived from build metadata and retained in the local-processing badge tooltip. The visible badge says only “完全ローカル処理” / “Fully local processing” for both editions. The bilingual blocked-state explanation distinguishes direct-file opening from browser/host capability and links to the standard ST app. The selected video and result do not automatically transfer to another page.

MT budgets are pthread pool 8, video decoder 2, H.264 encoder 4, x264 lookahead 1. Audio codecs and filtergraphs remain single-threaded. No universal speedup is promised.

### Hosted staging

`prepare-pages.ps1` creates a separate `pages-dist/`:

- `/index.html`: unmodified raw ST.
- `/mt/index.mt.html`: unmodified raw MT.
- `/mt/index.html`: MT wrapper, conditionally loading same-origin `./coi-serviceworker.js` only when `window.crossOriginIsolated === false`.
- `/mt/coi-serviceworker.js`: pinned coi-serviceworker 0.1.7, registered with its default script-directory scope `/mt/` (under the repository base path on project Pages).
- `/_headers`: COOP `same-origin`, COEP `require-corp`, CORP `same-origin`, only for `/mt/*` on Cloudflare.

The helper is not embedded in raw release artifacts. Its reviewed commit/hash and MIT notice are committed. It may register a service worker and reload the MT page once, after service-worker control is established, to establish isolation on GitHub Pages; it is not an offline app cache. Already-isolated hosts skip this script. No root-scope worker or global isolation headers may be introduced. Browser Kitty integration is a deployment instruction, not a claim that integration is already live.

### Runtime network policy

Selected video data must never be uploaded. Raw artifacts must not make runtime HTTP(S), XHR, fetch, WebSocket, EventSource, CDN, telemetry or external-font requests. Hosted MT has only the documented same-origin isolation-helper request/reload exception; this is not permission to send video data or load external processing assets.

CSP retains `connect-src 'none'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'`, and `form-action 'none'`. Local Blob Worker/media permissions and `'wasm-unsafe-eval'` are allowed as needed; generic `'unsafe-eval'` is not required. The existing same-origin script/worker policy permits the scoped hosted helper without relaxing `connect-src`.

Build-time GitHub Release requests are separate from the runtime privacy boundary.

## 6. Build provenance

Separate ST/MT files are required:

- `dist/dependency-manifest.json` / `dist/dependency-manifest.mt.json`
- `dist/self-extract-manifest.json` / `dist/self-extract-manifest.mt.json`
- `dist/build-size-report.json` / `dist/build-size-report.mt.json`

Each dependency manifest records app/version, Builder/profile/threading variant, direct-file support and SharedArrayBuffer/isolation requirements, `github-release` provenance, repository/tag/asset, release/asset IDs, asset byte count/SHA-256, and embedded payload byte counts/hashes. MT must prove its pthread Worker is embedded. Release verification rejects mismatched variants or local-builder provenance.

## 7. State model

```text
empty
  -> loading
  -> ready
  -> processing
  -> result
  -> error
```

The ready workspace may temporarily enter FFmpeg media inspection when native preview cannot load.

Cancellation returns from `processing` to `ready` while preserving source/settings and, when applicable, the previous result.

## 8. UX and accessibility

- Light-only UI matching htmlapps-template tokens, using flat backgrounds without gradients.
- The source preview is top-aligned and sized to its video rather than stretched to the settings column. Source/result videos keep their intrinsic ratio with contained, uncropped playback and viewport height limits.
- Distinct “元動画” / “Original video” and “変換後の動画” / “Converted video” regions identify the source speed preview and encoded result. On desktop the result, metrics and Save action sit below the source, outside the settings column; source information/replacement stays with the source.
- Narrow layouts retain source → settings → result order so speed controls stay near the source. Successful conversion focuses/reveals the result, respecting reduced motion; late frames after source replacement and open modal dialogs must not steal focus.
- Keep the settings column compact: retain the live-preview explanation once inside the current-speed card, not below the section heading; align fine-tuning label/input in one row and avoid empty error spacing.
- Place one conversion action, progress, cancellation and errors immediately after speed/target-duration controls, before the secondary Audio and Output settings, on desktop and narrow screens. Preserve editable filenames, older-result retention and the separate result/Save region.
- Hide the app-name/license/local-processing footer at the existing smartphone breakpoint (760px and below); desktop retains it.
- Help privacy copy describes browser-local processing without catalog branding.
- Browser Kitty accent `#16624F`.
- SVG icons, no emoji UI icons.
- Header icon and embedded favicon use the same video-player + speed-meter artwork.
- No horizontal scrolling at 320px and above.
- Long filenames wrap safely.
- Dialogs remain inside the viewport and scroll internally when needed.
- Keyboard focus is visible.
- Drag & Drop area is keyboard operable.
- Status changes use `aria-live`.
- Motion respects `prefers-reduced-motion`.
- Japanese and English are supported without reload.

## 9. Error behavior

User-facing failures distinguish at least:

- not a video,
- unsupported/damaged media,
- browser preview unavailable but FFmpeg inspection successful,
- device memory pressure,
- WASM/CSP/runtime failure,
- generic conversion failure.

Technical FFmpeg/runtime detail belongs in a secondary disclosure, not the primary error message.

## 10. Browser target

Primary:

- current Chrome,
- current Edge,
- current Safari.

Best effort:

- current Firefox.

Direct `file://` opening is a release requirement for ST only. MT must show its blocking explanation there and must convert only in an isolated hosted context.

## 11. Non-goals

- per-section speed changes,
- speed-ramp timeline editing,
- trimming,
- cropping,
- rotation editing,
- color correction,
- subtitles,
- batch conversion,
- frame interpolation / AI slow motion,
- cloud storage,
- accounts,
- social sharing,
- arbitrary FFmpeg command execution.

## 12. FFmpeg architecture

Dedicated `video-speed-changer` Builder profile:

- public libav API runner,
- H.264 / x264 output,
- AAC when audio is retained,
- `setpts`,
- chained `atempo`,
- `asetrate` + `aresample`,
- optional audio-stream removal,
- media inspection mode,
- WORKERFS input,
- Worker execution,
- AbortSignal cancellation,
- ST without SharedArrayBuffer; MT with required SharedArrayBuffer and cross-origin isolation,
- no arbitrary command-string interface.

Both runtime variants are pinned to Builder v1.10.6 for v1.1.1.

## 13. v1.1.1 acceptance criteria

### Dependency pin / build

- `app.config.json` version is `1.1.1`.
- `ffmpeg.release.json` selects Builder v1.10.6 and both explicit video-speed-changer ST/MT assets.
- Each variant in `ffmpeg.release.lock.json` contains a real 64-hex SHA-256, positive release/asset IDs and byte count, and matching config fields.
- Normal `build-standalone.bat` obtains FFmpeg only through the committed release lock.
- Downloaded release ZIP must match the committed SHA-256 before extraction.
- Release artifact provenance must be `github-release`; `local-builder` is rejected by release-artifact checks.
- `build-with-local-ffmpeg.bat` remains usable for development and is clearly non-release.

### Functional regression

- 0.25x, 0.5x, 1x, 1.33x, 1.67x, 2x, and 4x calculations remain correct.
- Pitch-preserving, pitch-shifting, remove-audio, and audio-less cases remain valid.
- Conversion cancellation returns to a usable state.
- Cancelling or failing a reconversion preserves the previous result and its matching automatic export filename; successful retry updates both together.
- User-edited filenames survive successful, cancelled, and failed attempts for the same source.
- New sources/reset clear old diagnostics and results; obsolete conversion completion cannot affect a newer source or its conversion controls.
- Preview-unavailable / FFmpeg-inspection fallback remains usable.
- Source replacement cannot receive stale inspection/conversion results.
- Portrait / rotation-metadata sources retain correct visual orientation.

### Standalone / privacy

- ST readable/self-extract files both work via `file://`; raw MT readable/self-extract files block there and work with required hosting headers.
- Both self-extract artifacts restore their matching readable HTML byte-for-byte.
- Raw artifacts make no runtime HTTP/HTTPS/XHR/fetch/WebSocket/EventSource requests; hosted MT permits only the documented scoped same-origin isolation helper/reload.
- CSP retains `connect-src 'none'` and required local Blob/WASM permissions only.
- Embedded FFmpeg gzip payloads are validated before build completion.
- Embedded favicon is present and matches the header icon motif.

### UI / stable release

- Desktop and 320/360/390px layouts have no unintended horizontal scroll.
- Japanese and English are checked.
- Empty/loading/ready/processing/cancel/result/error states are checked.
- Help/dialogs fit smartphone viewport.
- README, APP_SPEC, CHANGELOG, REGRESSION, screenshots, favicon, and version are internally consistent.
- Build/Pages/preview workflows run the canonical repository gate with Node 24. Pages publishes the staged site, not raw dist.
- Cloudflare /mt/* responses carry COOP/COEP/CORP; Chromium verifies the exact requested MT URL and both isolation capabilities.
- Pages/preview regressions cover helper integrity, raw-file preservation, scoped staging, invalid-input rejection, delayed navigation, wrong URLs, bounded CDP timeouts and singleton browser-path selection.

## 14. Release verification

ST and MT retain the same speed/audio, source/result ownership, cancellation, fallback inspection and export-name behavior. Synthetic lifecycle and deployment tests are distinct from real browser/media verification. Record actual commands, tested URLs/artifacts and limitations in `REGRESSION.md`; do not treat historical v1.0 results as fresh v1.1.1 browser evidence.

## Header normalization (1.0.1)

- The language button shows EN in Japanese and JA in English. Its title and accessible name describe the destination in the current UI language.
- Help retains its localized title and accessible name; the header version matches the current app package.

## Icon refresh (1.0.2)

- The header and embedded favicon use the supplied artwork from `assets/favicon.svg`, preserving its original `0 0 1095 1095` viewBox.
- The header keeps its existing responsive icon slot; readable and self-extract releases inherit the same embedded favicon.

## Responsive dialog audit (1.0.4)

- Lock root/body background scrolling only while a native modal dialog is open; restore ordinary scrolling on close.
- Preserve the existing fixed Help header, inner scrolling body and decorative local-processing shield.
- At widths up to 420 px, allow the title and version to wrap without clipping the version or shrinking the language/Help actions; preserve desktop header layout.

- Change settings focuses and scrolls the existing speed input into view together, without changing its value; reduced-motion preferences disable smooth scrolling.
