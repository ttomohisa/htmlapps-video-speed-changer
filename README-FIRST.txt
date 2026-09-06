Video Speed Changer
===================

1. Read README.ja.md.
2. Read AGENTS.md and APP_SPEC.md before changing the application.
3. Edit src\index.template.html; do not edit generated dist HTML by hand.
4. Keep selected video data local and preserve connect-src 'none'.
5. Release builds use the SHA-256-pinned FFmpeg WASM Builder v1.8.1 GitHub Release asset.
6. The v1.8.1 Release Asset is pinned in ffmpeg.release.lock.json; use pin-ffmpeg-release.bat only when intentionally moving to a future Builder release.
7. Run build-standalone.bat for the normal pinned-release build.
8. Use build-with-local-ffmpeg.bat only when developing the Builder/runtime itself.
9. Open both generated HTML variants directly and test with the network disabled.
