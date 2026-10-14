Video Speed Changer v1.1.1
=========================

1. Read README.ja.md or README.md.
2. Read AGENTS.md and APP_SPEC.md before changing the application.
3. Edit src/index.template.html; never edit generated dist HTML by hand.
4. Keep selected video data local and preserve connect-src 'none'.
5. Release builds use both dedicated ST/MT assets from FFmpeg WASM Builder v1.10.6.
6. ffmpeg.release.lock.json pins both official assets. pin-ffmpeg-release.bat verifies both before replacing the lock.
7. Run build-standalone.bat for both editions, or select -Variant single-thread / multi-thread.
8. Use build-with-local-ffmpeg.bat only for Builder development; those artifacts are not releasable.
9. ST readable/self-extract HTML supports file:// and offline use. MT requires an isolated HTTP(S) host, SharedArrayBuffer and the documented COOP/COEP setup.
10. GitHub Pages serves ST at / and the isolated MT wrapper at /mt/. See docs/MULTI_THREAD_DEPLOYMENT.md for the scoped same-origin helper and raw MT artifact.
11. Run scripts/check-repository.ps1, then perform the real browser/media checks in REGRESSION.md before release.
