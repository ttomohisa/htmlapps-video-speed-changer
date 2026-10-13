# FFmpeg core import

Generated binaries are not committed separately. Both distributable HTML editions embed their matching runtime; no runtime CDN or video upload is used.

## Official release / CI

`ffmpeg.release.json` schema 2 selects Builder v1.10.6 and the dedicated `video-speed-changer-single-thread` and `video-speed-changer-multi-thread` assets. `ffmpeg.release.lock.json` records the shared release ID and the exact asset ID, byte count, SHA-256 and official URL for each edition.

`pin-ffmpeg-release.bat` rejects drafts and prereleases, verifies both archives and schema-8 raw/gzip payloads, and updates the lock only after both pass. `build-standalone.bat` validates the committed lock and imports the archive contents under `vendor/ffmpeg/single-thread/` and `vendor/ffmpeg/multi-thread/`.

## Local Builder development

`build-with-local-ffmpeg.bat "C:\path\to\htmlapps-ffmpeg-wasm-builder"` imports both `dist/video-speed-changer/{single-thread,multi-thread}` outputs and the shared `runtime/browser-ffmpeg.js`. The Builder version must match the selected release contract. This writes `local-builder` provenance and builds functional development editions, but release-artifact verification rejects them. Run the normal official build before preparing a release.

The ST edition supports `file://`; MT requires an isolated HTTP(S) host. The same threading restrictions apply to local development artifacts.
