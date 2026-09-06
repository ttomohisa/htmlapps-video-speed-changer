# FFmpeg core import

Generated FFmpeg WASM binaries are intentionally not committed to the repository.

## Release / CI path

1. `ffmpeg.release.json` selects the Builder release/tag/asset.
2. `ffmpeg.release.lock.json` pins the exact GitHub Release asset SHA-256 and release metadata.
3. `build-standalone.bat` downloads that exact asset at build time, verifies the SHA-256, verifies the Builder manifest/runtime/WASM payload, and copies only the required files here.
4. The final single HTML embeds those files and needs no runtime network access.

The committed lock must be produced with `pin-ffmpeg-release.bat` after the selected Builder release exists.

## Local Builder development path

Use:

```bat
build-with-local-ffmpeg.bat "C:\path\to\htmlapps-ffmpeg-wasm-builder"
```

This writes local provenance and intentionally does not qualify as a release-candidate build.
