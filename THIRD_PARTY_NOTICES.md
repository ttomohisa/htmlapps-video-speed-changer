# Third-Party Notices

Video Speed Changer v1.1.0 embeds separate single-thread and multi-thread `video-speed-changer` builds from the pinned [FFmpeg WASM Builder v1.10.6 release](https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder/releases/tag/v1.10.6).

## FFmpeg / x264 core

The generated `ffmpeg.wasm` links FFmpeg with x264 and is distributed under **GPL-2.0-or-later**. The application source remains MIT licensed; that license does not relicense either embedded ST/MT binary.

The pinned binary assets are:

- `ffmpeg-wasm-video-speed-changer-single-thread-v1.10.6.zip`
- `ffmpeg-wasm-video-speed-changer-multi-thread-v1.10.6.zip`

The matching Builder release and `ffmpeg-wasm-sources-v1.10.6.tar.gz` source package provide the corresponding distribution source. Preserve access to the exact FFmpeg, x264, Emscripten revisions, build recipes and license texts required to reproduce both variants. Review the [Builder v1.10.6 source tree](https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder/tree/v1.10.6) and release source package when redistributing; the app's MIT license does not replace these obligations.

`ffmpeg.release.lock.json` records each exact binary release asset identity, byte count and SHA-256. Separate ST/MT dependency manifests record provenance and embedded payload hashes. FFmpeg JS/WASM, browser runtime and the MT pthread Worker are imported at build time and embedded; none is downloaded during video conversion.

## coi-serviceworker (hosted MT fallback)

- Project: [gzuidhof/coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker)
- Version: 0.1.7
- Reviewed commit: [`7b1d2a092d0d2dd2b7270b6f12f13605de26f214`](https://github.com/gzuidhof/coi-serviceworker/tree/7b1d2a092d0d2dd2b7270b6f12f13605de26f214)
- SHA-256: `e97bbac6017322d48aa54a5bc7ce473c725a4b7376ff245002e0ba71c3dcdd7e`
- Copyright (c) 2021 Guido Zuidhof
- License: [MIT license text](licenses/coi-serviceworker-MIT.txt)

The vendored bytes are unmodified and verified against `coi-serviceworker.lock.json` during staging. Only the hosted MT wrapper conditionally references the same-origin helper. Its default scope is its MT directory; it is absent from raw standalone artifacts and is skipped when server-side isolation is already active. The MIT notice is included beside the staged helper.

## Build services

Repository GitHub Actions and build/deployment tools remain subject to their respective upstream licenses and terms. They are build-time tools, not application runtime dependencies.
