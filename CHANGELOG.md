# Changelog

## 1.0.0 - 2026-09-06

- Promote the validated v0.9.0 Release Candidate to the first stable release without adding new product features.
- Keep the pinned FFmpeg WASM Builder v1.8.1 `video-speed-changer` Release Asset and committed SHA-256 lock as the stable build source.
- Keep 0.25×–4.00× conversion, target-duration calculation, audio modes, cancellation, fallback media inspection, result preview, filename editing, quality presets, and MP4 saving.
- Keep readable and self-extract single-HTML distribution with fully local runtime processing and `connect-src 'none'`.
- Rewrite English and Japanese README files to match the Browser Kitty release-oriented repository format, including live demo, quick start, usage, Pages deployment, build layout, privacy, limitations, and dependency information.
- Update release screenshot version badges to v1.0.0 and complete the final regression records for the stable version.
- Fix the help dialog layout so its header remains visible while the body scrolls within the viewport, preventing the bottom of the notes from being clipped on shorter screens.

## 0.9.0 - 2026-09-06

- Promote the app to Release Candidate after the v0.7.0 regression/robustness and v0.8.0 single-HTML/privacy hardening milestones.
- Pin FFmpeg WASM Builder to the v1.8.1 GitHub Release asset `ffmpeg-wasm-video-speed-changer-v1.8.1.zip`.
- Confirm the published Release Asset at 3,207,461 bytes with SHA-256 `aef55e13bfb9f45cd042b3ec2582e449876a8e28bd612a01e4b7429dfbacac36` and commit the exact release/asset IDs to the lock.
- Add `pin-ffmpeg-release.bat` to verify GitHub's release-asset SHA-256 digest, download and validate the binary archive, and write exact release/asset metadata to `ffmpeg.release.lock.json`.
- Make normal standalone/CI/Page builds import only the committed SHA-256-pinned Builder release asset.
- Record release tag, asset, IDs, byte count, release-asset SHA-256, Builder profile/version, and embedded-file SHA-256 values in build provenance.
- Keep `build-with-local-ffmpeg.bat` as an explicit Builder-development path with `local-builder` provenance.
- Reject local-builder provenance from Release Candidate artifact verification.
- Keep all v0.8.0 runtime functionality and UI behavior unchanged.

## 0.8.0 - 2026-09-06

- Confirm v0.7.0 after the FFmpeg WASM Builder v1.8.1 browser smoke test passed.
- Harden readable and self-extract single-HTML verification for embedded favicon, CSP, Worker/Blob/WASM requirements, and external runtime dependencies.
- Validate imported FFmpeg gzip payloads by actually inflating them and checking the JS factory / WebAssembly magic before a standalone build can proceed.
- Record FFmpeg Builder provenance and SHA-256 hashes in the generated build manifest.
- Tighten single-file size warning budgets to realistic release values for this app.
- Expand offline verification guidance for file://, readable HTML, self-extract HTML, runtime network checks, conversion, cancellation, and saving.
- Keep the conversion runner/profile contract on FFmpeg WASM Builder v1.8.1; no Builder rebuild is required.

## 0.7.0 - 2026-09-06

- Add real conversion cancellation using AbortSignal so the active FFmpeg Worker is terminated instead of merely hiding progress.
- Keep an existing converted result available when a reconversion is cancelled or fails; replace it only after a new conversion succeeds.
- Add FFmpeg media-inspection fallback when the browser cannot read native video metadata, allowing conversion attempts without native preview.
- Add clearer conversion error categories for memory pressure, unsupported media, runtime startup, and CSP failures, with technical details in a disclosure.
- Strengthen source/conversion generation guards and abort stale source inspection when the selected file changes.
- Tighten Blob URL, video element, Worker, and page-hide cleanup for repeated conversions and source replacement.
- Improve sub-second duration display for extreme 4× conversions on very short clips.
- Require FFmpeg WASM Builder v1.8.1 browser runtime; the FFmpeg runner/WASM profile itself remains unchanged from v1.8.0.

## 0.6.4 - 2026-09-06

- Fix the header icon so the speedometer remains visible instead of becoming an all-white badge.
- Keep the favicon design direction and use the same video-file plus speed-meter motif in the header icon.
- Continue the v0.6 UI / UX polish without changing conversion, audio, quality, preview, filename, or save behavior.
- Reuse FFmpeg WASM Builder v1.8.0; no Builder rebuild is required.

## 0.6.3 - 2026-09-06

- Unify the embedded favicon and header brand icon to the same video-file plus speed-meter design.
- Keep the video-file motif from the preferred favicon direction and make the speedometer needle more visible by extending it farther across the gauge.
- Continue using the simplified speed selector without non-interactive preset buttons.
- Keep the v0.6.2 conversion, audio, quality, preview, filename, and save behavior unchanged.
- Reuse FFmpeg WASM Builder v1.8.0; no Builder rebuild is required.

## 0.6.2 - 2026-09-06

- Remove the non-interactive preset chip row below the speed slider; the slider and fine-tune number input are now the only speed controls.
- Redraw the app icon/favicon with the existing video-file/play motif and a much larger, high-contrast speedometer badge at the lower right.
- Keep the v0.6.1 conversion, audio, quality, preview, filename, and save behavior unchanged.
- Reuse FFmpeg WASM Builder v1.8.0; no Builder rebuild is required.

## 0.6.1 - 2026-09-06

- Replace the motion-line icon concept with a clearer video-file icon that includes a speed meter at the lower right.
- Update the favicon and header icon so both use the same video-file plus speed-meter motif.
- Simplify the speed selector header so the current speed no longer collides with an extra helper card on narrow widths.
- Keep the v0.6.0 conversion, audio, quality, preview, filename, and save behavior unchanged.
- Reuse FFmpeg WASM Builder v1.8.0; no Builder rebuild is required.

## 0.6.0 - 2026-09-06

- Refine the speed control UI into a clearer slider-first layout with stronger current-speed emphasis and compact preset chips.
- Group the speed settings visually so the current speed, quick selection, and fine tune controls read as one block.
- Redesign the app icon and favicon to use a play symbol with a speed meter at the lower right, matching the requested motion-focused concept.
- Polish copy for the updated speed workflow in Japanese and English help text.
- Keep the v0.5.0 conversion, audio, preview, filename, quality, and save flow unchanged.
- Reuse FFmpeg WASM Builder v1.8.0; no Builder rebuild is required.

## 0.5.1 - 2026-09-06

- Replace the 3×3 speed preset button grid with a compact discrete speed slider that keeps all nine preset steps from 0.25× to 4×.
- Emphasize the current speed and show a clear Slower / Normal / Faster state while keeping fine numeric adjustment available.
- Redesign the app/header icon and favicon around a play symbol, motion lines, and a speed gauge so the purpose is recognizable at a glance.
- Keep the v0.5.0 conversion, audio, quality, preview, filename, and save behavior unchanged.
- Reuse FFmpeg WASM Builder v1.8.0; no Builder rebuild is required.

## 0.5.0 - 2026-09-06

- Add a dedicated converted-video preview before saving.
- Add editable MP4 base filename with a separate `.mp4` extension and safe filename sanitization.
- Add High quality / Standard / Smaller file presets mapped to H.264 CRF 20 / 23 / 28.
- Show original → converted duration and original → converted file size in the completion state.
- Improve processing feedback with percentage and approximate media position while conversion is running.
- Keep an existing result available when settings change, clearly mark it as created with older settings, and only replace it when a new conversion starts.
- Add explicit Change settings and Choose another video flows after conversion.
- Warn before replacing the source when a converted result has not yet been saved.
- Show a toast when MP4 download is initiated and release old result Blob URLs on reconversion/source replacement.
- Reuse FFmpeg WASM Builder v1.8.0; no Builder rebuild is required when a compatible v1.8.0 core is already available.

## 0.4.0 - 2026-09-06

- Complete real conversion coverage for the 0.25× to 4.00× speed range.
- Export with pitch-preserving audio, pitch-shifting audio, or no audio.
- Mute the browser preview when Remove audio is enabled and disable the irrelevant pitch toggle.
- Show the selected audio mode in the conversion result summary.
- Require a matching FFmpeg WASM Builder v1.8.0+ core so older pitch-preserving-only cores cannot be imported accidentally.
- Expand help, Japanese/English copy, and repository regression checks for the v0.4.0 audio workflow.

## 0.3.1

- Fix the Content Security Policy so the embedded FFmpeg WebAssembly module can compile under Chrome/Edge by allowing `wasm-unsafe-eval` while keeping `connect-src 'none'`.
- Apply the same WASM CSP permission to the self-extract wrapper so restored standalone builds behave the same as readable builds.
- Add repository and standalone verification checks to prevent the WASM CSP permission from being removed accidentally.
- Show a specific conversion error when WebAssembly execution is blocked by CSP.

## 0.3.0

- Add dedicated FFmpeg WASM speed-change integration.
- Add local Builder import/build flow with no runtime network dependency.
- Add conversion progress and MP4 save controls.
- Keep v0.3 export pitch-preserving; pitch-shifting and audio removal remain v0.4 work.


All notable changes to Video Speed Changer are documented here.

## [0.2.0] - 2026-09-05

### Added

- Speed presets from 0.25× to 4× and direct numeric speed entry.
- Instant browser-native speed preview without re-encoding.
- Original duration, resulting duration, and shorter/longer difference display.
- Target-duration input that calculates the required playback speed.
- Pitch-preservation toggle for browser preview when supported.
- Responsive speed controls optimized for desktop and smartphone layouts.

### Changed

- Header metadata now describes the app's purpose instead of implementation details.
- The ready view now prioritizes speed controls while source metadata is available in a compact disclosure.
- Help and Japanese / English copy updated for the v0.2.0 workflow.

### Not yet included

- FFmpeg conversion, quality settings, audio removal, progress/cancel flow, and MP4 export.

## [0.1.0] - 2026-09-05

### Added

- Initial template-compliant Video Speed Changer repository.
- Local single-video file selection and Drag & Drop.
- Browser-native video preview.
- Filename, file size, duration, resolution, and format display.
- Explicit empty/loading/ready/error source states.
- Stale async metadata protection when replacing the selected source.
- Blob URL cleanup for source changes and page exit.
- Japanese / English UI and help.
- Responsive desktop and smartphone layout.
- Video-oriented SVG app icon and favicon.

### Security / Privacy

- Runtime CSP keeps `connect-src 'none'`.
- No runtime CDN, API, analytics, telemetry, remote font, or bundled third-party library.

### Not yet included

- Playback-speed settings, target-duration calculation, FFmpeg conversion, audio options, and MP4 export.
