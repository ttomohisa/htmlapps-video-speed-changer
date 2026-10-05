# APP_SPEC.md

## 1. Product identity

- **English name:** Video Speed Changer
- **Japanese name:** 動画速度変更
- **Slug:** `video-speed-changer`
- **Repository:** `ttomohisa/htmlapps-video-speed-changer`
- **Current stable version:** `1.0.0`
- **Target first stable release:** `1.0.0`
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`
- **Builder dependency:** `ttomohisa/htmlapps-ffmpeg-wasm-builder` v1.8.1 / `video-speed-changer`

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

## 3. Implemented v1.0.0 behavior

### Speed and duration

- 0.25x through 4.00x.
- Direct numeric input supports values such as 1.33x and 1.67x.
- `result duration = source duration / speed`.
- `speed = source duration / target duration`.
- The selected speed is the canonical internal value.
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

## 4. v1.0.0 stable dependency contract

v1.0.0 keeps the pinned-release dependency contract introduced in v0.9.0 and does not treat a developer's local Builder output as the normal release source.

### Pinned release source

`ffmpeg.release.json` selects exactly:

- repository: `ttomohisa/htmlapps-ffmpeg-wasm-builder`
- tag: `v1.8.1`
- asset: `ffmpeg-wasm-video-speed-changer-v1.8.1.zip`
- profile: `video-speed-changer`
- Builder version: `1.8.1`

After that Builder release exists, `pin-ffmpeg-release.bat` must:

1. fetch the GitHub Release metadata for v1.8.1,
2. find the exact profile ZIP,
3. require GitHub's `sha256:` asset digest,
4. download the ZIP,
5. compare the downloaded SHA-256 and byte count with GitHub metadata,
6. validate the archive's profile / Builder version / runtime capability flags,
7. decompress `ffmpeg.js.gz` and verify `createFFmpegCore`,
8. decompress `ffmpeg.wasm.gz` and verify the WebAssembly magic,
9. validate cancellation / inspection runtime API markers,
10. write exact release / asset IDs, byte count, URL, SHA-256, and pin timestamp into `ffmpeg.release.lock.json`.

The updated lock must be committed.

### Normal release build

`build-standalone.bat` must:

1. read `ffmpeg.release.json` and the committed lock,
2. reject an unpinned or mismatched lock,
3. download the exact locked release asset when the SHA-keyed cache is absent,
4. verify the ZIP SHA-256 and byte count before extracting it,
5. validate the archive contents again,
6. import only the required FFmpeg files into `vendor/ffmpeg`,
7. write `github-release` provenance,
8. embed the JS/WASM/runtime into the final HTML.

CI and GitHub Pages use this same path.

### Local Builder development path

`build-with-local-ffmpeg.bat <builder-root>` remains available only for Builder development.

It writes `local-builder` provenance and may generate functional standalone HTML, but release-artifact verification must not accept that provenance as a stable release artifact.

## 5. Single-HTML and privacy contract

### Readable standalone

`dist/index.html` contains:

- UI/CSS/JavaScript,
- FFmpeg browser runtime,
- gzip-compressed FFmpeg JS core,
- gzip-compressed FFmpeg WASM,
- embedded favicon.

No runtime FFmpeg download is permitted.

### Self-extract variant

`dist/index.self-extract.html` stores the readable HTML in an embedded gzip payload and restores it locally. Verification must confirm byte-for-byte equality with `dist/index.html`.

### Runtime network policy

User video data must never be uploaded.

Runtime CSP keeps at least:

- `connect-src 'none'`
- `object-src 'none'`
- `frame-src 'none'`
- `base-uri 'none'`
- `form-action 'none'`

Blob Worker / media / WASM permissions may be enabled only as required. `wasm-unsafe-eval` is permitted for embedded WebAssembly compilation; generic `unsafe-eval` is not required.

Build-time access to the pinned GitHub Release is allowed and is separate from runtime privacy behavior.

## 6. Build provenance

`dist/dependency-manifest.json` records:

- app name / slug / version,
- FFmpeg profile,
- Builder version,
- file-protocol single-HTML support,
- SharedArrayBuffer / cross-origin-isolation requirements,
- source type (`github-release` for stable release),
- Builder repository,
- release tag,
- release asset name,
- release ID / asset ID,
- release asset byte count,
- release asset SHA-256,
- byte count and SHA-256 of each embedded FFmpeg file.

Release verification rejects local-builder provenance.

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

- Light-only UI matching htmlapps-template tokens.
- Browser Kitty accent `#16624F`.
- SVG icons, no emoji UI icons.
- Header icon and embedded favicon use the same video-file + speed-meter motif.
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

Direct `file://` opening is a release requirement.

## 11. Non-goals for v1.0.0

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
- no SharedArrayBuffer requirement,
- no arbitrary command-string interface.

The profile runtime contract is frozen at Builder v1.8.1 for v1.0.0.

## 13. v1.0.0 acceptance criteria

### Dependency pin / build

- `app.config.json` version is `1.0.0`.
- `ffmpeg.release.json` selects Builder v1.8.1 and the video-speed-changer asset.
- `ffmpeg.release.lock.json` contains a real 64-hex SHA-256, positive release/asset IDs and byte count, and matching config fields.
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

- `dist/index.html` and `dist/index.self-extract.html` both open via `file://`.
- Self-extract restores the readable HTML byte-for-byte.
- No runtime HTTP/HTTPS/XHR/fetch/WebSocket/EventSource request occurs.
- CSP retains `connect-src 'none'` and required local Blob/WASM permissions only.
- Embedded FFmpeg gzip payloads are validated before build completion.
- Embedded favicon is present and matches the header icon motif.

### UI / stable release

- Desktop and 320/360/390px layouts have no unintended horizontal scroll.
- Japanese and English are checked.
- Empty/loading/ready/processing/cancel/result/error states are checked.
- Help/dialogs fit smartphone viewport.
- README, APP_SPEC, CHANGELOG, REGRESSION, screenshots, favicon, and version are internally consistent.
- GitHub Pages builds from the same pinned-release path as local release builds.

## 14. v1.0.0 stable release

v1.0.0 promotes the validated v0.9.0 Release Candidate without adding new product features. The stable release keeps the pinned FFmpeg WASM Builder v1.8.1 runtime, full 0.25×–4.00× conversion range, audio modes, cancellation, fallback media inspection, single-HTML distribution, and fully local runtime behavior.

Stable-release acceptance requires the full functional regression, desktop/mobile Japanese/English checks, pinned-release provenance, standalone/self-extract verification, embedded favicon consistency, and no unexpected runtime network access.
