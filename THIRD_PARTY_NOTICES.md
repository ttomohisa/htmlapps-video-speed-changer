# Third-Party Notices

Video Speed Changer v1.0.0 can bundle a generated `video-speed-changer` FFmpeg WASM core from the pinned `htmlapps-ffmpeg-wasm-builder` **v1.8.1** `video-speed-changer` GitHub Release asset.

## FFmpeg / x264 core

The generated `ffmpeg.wasm` links FFmpeg with x264 and is distributed under **GPL-2.0-or-later**. The Browser Kitty application source in this repository remains under its stated MIT license; that MIT license does not relicense the generated FFmpeg/x264 binary.

The matching Builder v1.8.1 release/source package is the corresponding distribution source for this pinned binary and must remain available so the exact FFmpeg, x264, Emscripten, build recipe, license texts, and source revisions remain reproducible. The app release lock records the exact binary Release Asset SHA-256 used for the standalone build.

The app does not download this core during a user session. The generated JS/WASM files are imported at app build time and embedded into the standalone HTML.

GitHub Actions used by the repository remain subject to the terms published by their respective projects.
