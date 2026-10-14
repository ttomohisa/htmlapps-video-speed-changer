# v1.1.0 ST/MT deployment regression (2026-10-13, unreleased)

## 2026-10-14 v1.1.1 conversion-action follow-up

- Restored the Japanese/English live-preview explanation only inside the current-speed card. The marked introduction sentence and duplicate paragraph below the section heading stay removed.
- Following the approved layout, moved the existing single conversion action with progress, cancellation and errors immediately after speed/target-duration controls and before Audio/Output. Source/result regions and conversion state logic are unchanged.
- Test-first: the restored-card-copy and conversion-position assertions failed before their respective fixes. The focused UI/lifecycle suite passed 74/74 afterward.
- Official pinned ST/MT readable/self-extract builds and the complete repository gate passed on PowerShell 7.5.2 / Node 24.19.0: 126/126 tests, zero failures/skips. All seven source/release forms passed the updated UI contracts, with provenance, exact restoration and root-download parity preserved.
- Independent review and rendered preview verification for this follow-up are pending; earlier results below apply to their recorded heads.

## 2026-10-14 v1.1.1 workspace-layout follow-up

- Removed the two screenshot-marked explanatory passages in Japanese and English. Original/converted video now have distinct visible headings; desktop results and Save sit below the source preview rather than extending the settings column. Narrow layouts keep source, adjacent speed settings, then result.
- Test-first: nine new layout/focus assertions failed before the implementation. The focused source UI/lifecycle suite then passed 72/72.
- Official pinned Builder v1.10.6 ST/MT builds and `scripts/check-repository.ps1` passed on PowerShell 7.5.2 / Node 24.19.0: 124/124 tests, zero failures/skips, source/download parity and byte-exact self-extract restoration.
- The canonical gate now tests workspace structure, labels and responsive layout contracts on all seven source/readable/root/self-extract forms. Result reveal tests cover reduced motion, stale completion frames after source replacement, and keeping focus inside an open Help dialog.
- Independent static review found no blocking issue. Head `9530a5236e20446f0a48b3f5162817624e827ead` passed [Windows standalone CI](https://github.com/ttomohisa/htmlapps-video-speed-changer/actions/runs/38518769984) and [Cloudflare preview CI](https://github.com/ttomohisa/htmlapps-video-speed-changer/actions/runs/38518769834), including HTTP and MT isolation checks.
- Windows artifact `11872643086` was independently downloaded and checked (9,925,022 bytes, ZIP SHA-256 `dd0bf8246a7a58c6aea7d12d5aa01eb6dc4bb9a2a7f42bc667f7c457d831df6b`): both aliases match their readable files and both self-extract payloads restore exactly; runtime/app manifests match the local build, and the remaining readable application bytes match after normalizing build timestamps/line endings.
- Cloud Chrome on the new ST preview: landscape 640×360 source and converted preview are both naturally contained; the result is below the source and outside the settings column. At 2×, conversion and saving with an edited name produced H.264/AAC, 640×360, 2.995083 seconds; success focused `resultPreviewTitle`.
- Japanese/English at exact 320/390 CSS px had no horizontal overflow. At 760px the order is source → settings → result and the footer is hidden; 761px switches to desktop two columns and restores the footer. These are ordinary desktop-browser responsive checks, not physical-mobile tests.
- At 320px, real reconversion focused/revealed the result at y=70px below the 59px sticky header. Cancelling another attempt retained the previous result Blob, edited filename and enabled Save. English Help measured 284×433px inside the viewport; Tab/Enter/Escape returned focus to Help.
- Cloud Chrome on the isolated MT preview: a genuine 90° Display Matrix source (encoded 640×360, displayed 360×640) converted at 1.5× and saved as H.264/AAC, 360×640, 4.003083 seconds.
- Replacing the source through the unsaved-result confirmation hid the result, cleared its media URL and updated the source filename.
- ST/MT had no app-origin console errors/warnings; unrelated browser-extension metadata errors were present. Both README screenshots were refreshed from actual JA/EN synthetic-media result sessions. Narrow full-page captures at 200% zoom exhibited a browser capture clipping defect and were excluded; exact viewport measurements and visible viewport checks remain the responsive evidence.
- Filename editing and Save were exercised, and downloaded MP4 contents were independently checked. The browser download API exposes UUID paths rather than a suggested filename, so the browser-level saved basename was not independently observed; deterministic export-name tests remain separate evidence.
- Limits: direct file://, physical phones, Safari/Firefox and a native DevTools network capture were not tested. The browser policy disables DevTools. Earlier evidence below is retained as history, not a substitute for this follow-up.

## 2026-10-14 v1.1.1 preview and UI refinement checks

- Test-first regression: the original layout/labels failed the new assertions before the source fix; the focused source UI/lifecycle suite passed 63/63 afterward.
- Official pinned Builder v1.10.6 ST and MT builds passed with unchanged dependency locks and runtime payloads. Both readable/self-extract pairs restore byte-for-byte and pass provenance checks.
- `scripts/check-repository.ps1` passed on Linux with official PowerShell 7.5.2 and Node 24.19.0: 115/115 tests, zero failures/skips.
- Independent source review found no blocking issue. CSS-contract assertions are not substitutes for rendered geometry checks.
- The exact initial PR head `7f8da5203d05c0372b503497260cd438085916ff` passed Windows standalone CI and Cloudflare preview CI, including ST/MT HTTP probes and actual Chromium MT isolation checks.
- On the [ST preview](https://r1358853866-pr-10-bk-previews.ttomohisa.workers.dev/) in cloud Chrome, a genuine 640×360 landscape video rendered at 671.34×377.63 with `object-fit: contain`. Expanding target-duration and advanced settings did not increase preview height. An edited output name, 2× conversion and Save MP4 worked; the result was 640×360 and 2.995083 seconds, 432,496 bytes and an audio stream.
- On the [MT preview](https://r1358853866-pr-10-bk-previews.ttomohisa.workers.dev/mt/), a genuine 90° display-matrix source was recognized as 360×640. Conversion at 2× and saving with an edited filename worked; the result remained 360×640 and lasted 2.995083 seconds, 433,315 bytes and an audio stream.
- Japanese/English responsive checks at exact 320px and 390px CSS widths showed no horizontal overflow and a hidden footer. These used ordinary desktop Chrome resize/200% zoom, not physical-phone or device-emulation tests. Portrait playback remained fully contained. Source replacement cleared the prior result.
- Japanese/English Help omitted catalog branding. Enter opened Help, Escape closed it, and focus returned to Help. Rendered app backgrounds contained no gradients. No app-origin console errors occurred; the browser extension emitted unrelated metadata messages.
- Updated both README desktop screenshots from actual synthetic-media preview sessions. Narrow full-page captures at 200% zoom had a browser-tool clipping defect and were excluded.
- Layout-contract tests passed against source, both root downloads, both readable artifacts and both self-extract artifacts (10/10 for each form).
- Limits: direct `file://`, Safari/Firefox, physical mobile devices and native DevTools Network inspection were not tested in this run. Chrome policy disables DevTools. Unchanged embedded-runtime/CSP rules and automated checks are separate evidence, not a claim of a manual network capture.

Current deterministic deployment checks were run with Node.js 24.19.0 and PowerShell 7.5.2 on Linux. The tests execute the real Pages staging script in temporary synthetic fixture directories and the real CDP verifier with deterministic transport/time boundaries. They do not launch a browser or decode media.

- `node --test tests/pages-deployment.test.mjs tests/preview-isolation.test.mjs`: 25 tests passed after observed failing tests for missing deployment behavior, the preview-only bootstrap fixture and workflow telemetry opt-out.
- `scripts/check-repository.ps1`: complete pinned ST/MT build, raw/self-extract verification, release parity and final 107-test repository suite passed after the control-wait fix. A separate `node --test tests/*.test.mjs` run passed 100 tests (the canonical gate also includes `.cjs` suites).
- Raw ST root and raw `/mt/index.mt.html` remain byte-identical; only `/mt/index.html` receives the conditional helper bootstrap.
- Helper version/commit/SHA-256 and MIT notice are checked; tampered helper, missing/malformed MT, and already-wrapped MT fail before overwriting a previous stage.
- Executing the wrapper bootstrap proves already-isolated/unsupported contexts do not request the helper; only explicit false isolation triggers the same-origin relative script.
- `_headers` contains only `/mt/*` with COOP/COEP/CORP. Normal Pages excludes the QA copy; preview-only `/pages-bootstrap-control-ready/mt/` copies exact wrapper/helper bytes and remains outside that header rule with a relative directory-scoped helper.
- The actual workflow browser-selection expression was executed with a fixture containing exactly one executable path; the full path is preserved, including spaces.
- CDP regressions cover exact target and execution-context URL matching, delayed navigation, initial `about:blank`, wrong origin/path/query, unavailable isolation/SAB, stalled fetch/socket/evaluation, errors, timer cleanup and socket cleanup.
- Build/Pages/preview workflow contracts require Node 24 and the canonical repository gate. Preview cleanup remains deletion-only; unrelated dependency maintenance is unchanged.

## Actual Windows / browser evidence at PR9 ac6e5dd

- Canonical Windows run [38473645258](https://github.com/ttomohisa/htmlapps-video-speed-changer/actions/runs/38473645258) passed all 105 tests, real ST/MT builds and generated-file checks. Preview run [38473644986](https://github.com/ttomohisa/htmlapps-video-speed-changer/actions/runs/38473644986) passed its HTTP and exact-page browser-isolation checks.
- Canonical artifact 11853451558 (9,924,473 bytes, SHA-256 `1b143cb1c8fadc26a91b8c47dd3944abe9dee9df80da1c78da6f7a35b454349d`) was independently unpacked: both aliases match the readable outputs; both self-extract payloads restore byte-for-byte; all manifest sizes/hashes and official embedded gzip payloads match. Checked-in versus Windows readable output differs only in generated timestamp/line endings.
- The cloud Chromium browser used the actual PR preview ST `/` and server-isolated MT `/mt/`, selected synthetic MP4s, converted them and saved files with edited filenames. Native `ffprobe` and PCM FFT inspected the saved bytes independently.
- Six-second H.264/AAC 440 Hz input at 2x: ST and MT preserve-pitch output are both 2.995563 seconds with H.264/AAC and dominant audio 440.24 Hz. MT pitch-shift output is 3.000000 seconds / 879.98 Hz. MT remove-audio output is 2.979167 seconds with no audio stream. ST silent-input output is also valid video-only 2.979167 seconds.
- MT cancellation during a 20-second 1280x720 input returns to usable settings. Retry saves 9.999167 seconds H.264/AAC. Cancelling a subsequent changed-speed reconversion preserves the prior file byte-for-byte (SHA-256 `9cc06808d749b39261a103823af2de200ee8ee56823a96edb8fa6d79b8a479be`).
- Pages-style bootstrap ultimately converted and saved exactly the same bytes as server-isolated MT, but its first automatic reload raced activation and initially stayed blocked. This is **not** accepted as first-visit success. The supported `doReload` override now waits for control; a regression using the actual upstream helper failed before the fix and passes afterward. Vendor bytes remain unchanged. A fresh, bounded preview-only scope `/pages-bootstrap-control-ready/mt/` is reserved for retesting the corrected first visit.
- A verified 90-degree Display Matrix source converts to 360x640 H.264/AAC output, 2.995563 seconds, with a visibly portrait result preview. The earlier incorrectly named fixture without rotation metadata is excluded from this evidence.
- Japanese/English Help was checked at a narrow desktop-browser viewport (500 px modal / 485 px page content): readable, scrollable, closable and no horizontal overflow. This does not establish 320/360/390 px or physical-device coverage.

Still required: canonical Windows verification of the control-wait patch; fresh automatic Pages bootstrap and real conversion without a manual reload; ST `file://` and both browser self-extract loaders; full narrow/mobile, keyboard, console/network and device matrix. Successful server-isolated MT checks cannot substitute for first-load helper QA. Historical records below are not reruns for v1.1.0.

See `VERIFY_OFFLINE.md` and `docs/MULTI_THREAD_DEPLOYMENT.md` for the complete release matrix. This section records executed automated checks; add browser/media evidence separately from its actual runs.

---

# Result/source lifecycle regression (2026-10-05, unreleased)

The current change was checked with Node tests executing the actual application script, using tiny fictitious media metadata, DOM elements, and FFmpeg runtime doubles. No real media is decoded or converted by this test suite.

- Reproduced the retained 2× result receiving a failed/cancelled 0.5× attempt's automatic filename.
- Reproduced a new source retaining the previous source's conversion error/details.
- Cover pending/success/cancel/failure/retry, custom filenames, source/reset cleanup, stale runtime startup/result/error/progress/finalization, and late inspection success/error.
- Retain checks for supported speeds, target-duration calculations and invalid inputs.
- `scripts/check-repository.ps1` builds and checks the pinned release, runs the lifecycle suite on the source, readable HTML, root download and decompressed self-extract payload, and verifies release parity. Node.js is needed for this repository check, not for the normal PowerShell build.
- The numeric-input observation where typing `1.3` becomes `1.30` is outside this change; browser caret behavior has not been verified.

Not verified in this change: real FFmpeg/WASM video conversion, native metadata/playback, actual browser saving, direct `file://` loading or self-extract loader execution, browser console/network behavior, accessibility, responsive layout and physical devices. Prior browser/media results below are historical records, not reruns for this change.

---

# v0.7.0 Regression and boundary checklist

This checklist records the robustness work for Video Speed Changer v0.7.0.

## Automated / source checks

- Application JavaScript parses after template placeholders are substituted.
- CSP keeps `connect-src 'none'` and `wasm-unsafe-eval`.
- Conversion cancellation uses `AbortController` and passes its signal into the FFmpeg browser runtime.
- Source inspection is generation-guarded and abortable when the selected source changes.
- A previous converted result is not revoked until a replacement conversion succeeds.
- Source and result Blob URLs are revoked explicitly.
- `pagehide` aborts conversion/inspection before disposing the FFmpeg runner.
- User-facing conversion errors separate likely memory, unsupported-media, runtime, and CSP failures; raw details stay collapsed.

## Headless Chromium application regression

The v0.7.0 application shell was exercised in Chromium with a real 1-second H.264/AAC MP4 and a deterministic in-page FFmpeg runtime stub so UI/state behavior can be tested independently of the binary build. Confirmed:

- real MP4 Drag & Drop reaches the ready state
- 4.00x displays a sub-second result (`0:00.3` for the 1-second fixture)
- active conversion shows progress and Cancel conversion
- cancellation re-enables controls with no error state
- cancelling a reconversion preserves the previous result URL/metrics and marks it stale
- native metadata failure can fall back to FFmpeg inspection and reach ready state with “preview unavailable”
- replacing a source while a delayed fallback inspection is in flight does not allow the old result to overwrite the new source
- a simulated out-of-memory conversion shows the memory-specific user message and keeps raw details in the disclosure
- 320 / 360 / 390 px widths have no horizontal overflow with a long filename
- the help dialog remains inside the viewport at 320 / 360 / 390 px
- 1.33x custom speed, >4x validation/revert, target-duration out-of-range handling, and Japanese/English switching behave as expected

## Speed / audio boundary matrix

The equivalent native FFmpeg filter chain was checked with a 2-second H.264/AAC fixture at:

- 0.25x
- 0.5x
- 1.0x
- 1.33x
- 1.67x
- 2.0x
- 4.0x

For each rate, the following paths completed and produced durations close to `sourceDuration / rate`:

- preserve pitch
- shift pitch with speed
- remove audio

The 0.25x and 4.0x boundary cases were also checked with a portrait, no-audio H.264 source. Output remained portrait and silent.

## Builder v1.8.1 browser smoke test

`build-video-speed-changer.bat` must pass before v0.7.0 is considered confirmed on the Windows release machine. The smoke test covers:

- full preset range: 0.25x / 0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x / 3x / 4x
- preserve pitch
- shift pitch
- remove audio
- source with no audio
- media inspection helper
- AbortSignal cancellation of an active FFmpeg Worker

## Manual browser checks before v0.8.0

- Chrome / Edge desktop
- 320 / 360 / 390 px smartphone widths
- Japanese / English
- long filename
- native-preview-supported video
- valid video that cannot be previewed natively, if an available fixture can reproduce the case
- cancel during conversion, then reconvert successfully
- cancel a reconversion while an older result exists and confirm the older result remains saveable
- repeated conversion / save / source replacement
- malformed video error
- larger video memory-pressure behavior

## v0.7.0 confirmation

The Windows release-machine `build-video-speed-changer.bat` smoke test for FFmpeg WASM Builder v1.8.1 was reported as passing on 2026-09-06. v0.7.0 is therefore treated as confirmed and v0.8.0 starts from that runtime contract.

## v0.8.0 single-file / privacy hardening

Source/build checks added for v0.8.0:

- readable standalone verification rejects external script/style/frame/image/media/object/CSS/module dependencies
- CSP release requirements include `connect-src 'none'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'`, and `form-action 'none'`
- FFmpeg standalone builds require `worker-src ... blob:`, `media-src ... blob:`, and `wasm-unsafe-eval`
- imported `ffmpeg.js.gz` is inflated and checked for `createFFmpegCore`
- imported `ffmpeg.wasm.gz` is inflated and checked for the WebAssembly magic bytes
- Builder manifest must declare file-protocol single-HTML support and no SharedArrayBuffer / cross-origin-isolation requirement
- generated build manifest records Builder/profile provenance and SHA-256 values for embedded FFmpeg artifacts
- self-extract verification checks compressed/source byte counts, SHA-256 metadata, favicon inheritance, and byte-for-byte restoration
- release artifact verification checks both HTML files, manifests, size report, `.nojekyll`, app version, and FFmpeg provenance together
- application JavaScript parses after all build placeholders are replaced with synthetic embedded-runtime payloads

Final Windows/browser verification for v0.8.0 should run `build-with-local-ffmpeg.bat` using the already-smoke-tested Builder v1.8.1 output and then follow `VERIFY_OFFLINE.md` for both `file://` variants.

## v0.9.0 Release Candidate / pinned Builder release

v0.9.0 changes the **build dependency source**, not the video-processing behavior.

Required RC checks:

- Builder v1.8.1 GitHub Release exists and includes the video-speed-changer binary ZIP.
- `pin-ffmpeg-release.bat` validates GitHub's asset digest and the downloaded archive before writing the lock.
- `ffmpeg.release.lock.json` is committed with a real SHA-256 and release/asset IDs.
- Normal `build-standalone.bat` downloads only the locked asset when absent from cache.
- A tampered cached ZIP is rejected by SHA-256 before extraction.
- A config/lock tag, asset, profile, or Builder-version mismatch is rejected.
- Release artifact manifest records `github-release` provenance and the lock SHA-256.
- `build-with-local-ffmpeg.bat` still works for development but the result is not accepted as an RC artifact.
- GitHub Pages and PR validation use the normal pinned-release path.

After the pinned-release build succeeds, repeat the v0.7.0 functional regression and v0.8.0 file:// / CSP / no-runtime-network checks without changing the FFmpeg runner/profile/runtime.

## v0.9.0 pinned-release confirmation

FFmpeg WASM Builder v1.8.1 was published on GitHub on 2026-09-06 and the required Release Asset was confirmed in the release metadata:

- release: `v1.8.1`
- release ID: `383478756`
- asset: `ffmpeg-wasm-video-speed-changer-v1.8.1.zip`
- asset ID: `546791853`
- bytes: `3207461`
- SHA-256: `aef55e13bfb9f45cd042b3ec2582e449876a8e28bd612a01e4b7429dfbacac36`

`ffmpeg.release.lock.json` now contains those exact values. Normal RC/release builds therefore use the pinned GitHub Release path rather than local Builder output. The import script rejects a different SHA-256, byte count, tag, asset, profile, or Builder version before embedding the runtime.

The Japanese, English, and mobile README screenshots were regenerated from the v0.9.0 UI after the pin was confirmed.

## v1.0.0 stable release regression

v1.0.0 is a version promotion from the validated v0.9.0 Release Candidate. No new conversion features or FFmpeg runner/profile changes are introduced.

Stable-release checks cover:

- application/config/script version consistency at `1.0.0`
- pinned FFmpeg WASM Builder v1.8.1 Release Asset metadata and SHA-256 lock
- JavaScript syntax after build placeholders are replaced with deterministic local payloads
- HTML parsing and required CSP directives including `connect-src 'none'`
- embedded favicon and header icon motif consistency
- empty/ready/speed/target-duration/audio/quality/result/cancel/error UI state regression in headless Chromium with a real H.264/AAC fixture and deterministic in-page FFmpeg runtime stub
- Japanese and English desktop layouts
- 320 / 360 / 390 px smartphone widths without unintended horizontal overflow
- help and confirmation dialogs remaining inside narrow viewports
- long filename handling
- release screenshots kept from the validated v0.9.0 layout because no functional/UI layout code changed; only the version badge was updated to `v1.0.0`, and the expected 1280×900 / 390×844 dimensions were rechecked
- release documentation rewritten for stable use and GitHub Pages publication

Final checks executed in this environment:

- 67 static/repository checks: PASS
- application JavaScript syntax after placeholder substitution: PASS
- functional JavaScript region compared byte-for-byte against v0.9.0 RC: unchanged
- native FFmpeg-equivalent speed/audio matrix: PASS for 0.25×, 0.5×, 1×, 1.33×, 1.67×, 2×, and 4× across preserve-pitch, pitch-shift, and remove-audio paths
- portrait/no-audio boundary checks at 0.25× and 4×: PASS

The container's Chromium is blocked from local/loopback pages by administrator policy, so the v1.0.0 browser layout check relies on the already-recorded v0.9.0 browser regression plus the verified fact that no functional/layout JavaScript changed for stable promotion. The Windows release build remains authoritative for the actual pinned WASM binary embedding and PowerShell artifact-verification chain. Running `build-standalone.bat` must finish with the release-artifact verification success message before publishing the repository/tag.

### v1.0.0 help dialog viewport regression fix

- Changed `#helpDialog` to a flex-column dialog with a fixed header and a `min-height: 0` scrollable body.
- Removed the independent `.dialog-body` viewport max-height calculation that could exceed the dialog's own max-height once the header was added.
- Added safe-area-aware bottom padding, `overflow-y: auto`, and `overscroll-behavior: contain` so the final help content remains reachable on short desktop and mobile viewports.
- Added repository markers so future UI cleanup cannot silently remove the viewport-safe help-dialog structure.


## Target-duration guidance and suggestion-only panel

Automated checks use synthetic metadata and a runtime double, not browser decoding or real video conversion:

- Open/close repeatedly at 1.33×, 4×, and exact whole-second speeds; selected speed, playback, filenames, result identity, and freshness stay unchanged. Opening does not run conversion or manufacture a target error.
- Verify JA/EN whole-second ranges for 60s, 10s, 10.01s, 0.25s, large durations limited by 999:59:59, and durations with no feasible whole-second target.
- Missing/non-finite/non-positive metadata withholds guidance. Replacing a source clears old guidance until the new metadata is available.
- Deliberate target edits preserve zero/out-of-range validation and three-decimal speed rounding; direct-speed changes return the target display to a suggestion.
- Language changes refresh range and validation text without applying a rounded target.

Manual browser/device, real-media conversion, keyboard, responsive-layout, and offline-network checks remain separate and were not performed for this change.
