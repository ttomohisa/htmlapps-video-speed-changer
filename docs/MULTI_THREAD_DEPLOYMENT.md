# Multi-thread deployment

Version 1.1.0 supplies separate ST/MT HTML builds using the pinned Builder v1.10.6 `video-speed-changer` profile. ST is the default portable `file://`/offline build. MT embeds its own runtime and pthread Worker but requires an isolated hosted environment; a standalone HTML cannot set its own response headers.

## Raw release files

```text
ST: dist/index.html              dist/index.self-extract.html
MT: dist/index.mt.html           dist/index.mt.self-extract.html
    video-speed-changer.html     video-speed-changer.mt.html (root aliases)
```

The last row contains the respective ST and MT readable download aliases. Each self-extract payload restores its matching raw HTML byte-for-byte. Raw HTML never references `coi-serviceworker.js`.

For MT, serve in a secure context (HTTPS, or a browser-recognized loopback development origin) with:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

The app requires non-`file:` loading, `crossOriginIsolated === true`, and `typeof SharedArrayBuffer === "function"`. An unsupported context blocks runtime loading, conversion and fallback inspection with Japanese/English guidance. There is no silent ST fallback. A link to the standard ST app does not automatically transfer selected video or result.

MT uses pool 8 / video decoder 2 / H.264 encoder 4 / x264 lookahead 1. Audio codecs and filtergraphs stay single-threaded. This is not a guarantee that every file or device runs faster.

## Shared staged site

Run the canonical gate, which builds both variants, validates artifacts and stages the site:

```powershell
./scripts/check-repository.ps1
```

For staging already-validated raw outputs alone:

```powershell
./scripts/prepare-pages.ps1
```

```text
pages-dist/
├─ .nojekyll
├─ _headers                      # Cloudflare: only /mt/*; ignored by GitHub Pages
├─ index.html                    # raw ST, byte-for-byte
└─ mt/
   ├─ index.html                 # hosted MT wrapper
   ├─ index.mt.html              # raw MT, byte-for-byte
   ├─ coi-serviceworker.js       # pinned, same-origin helper
   └─ coi-serviceworker-MIT.txt
```

Staging validates all inputs and the helper hash before replacing the existing output. It never modifies `dist/` or the root downloads.

## GitHub Pages

The workflow deploys `pages-dist/` after the complete Node 24 repository gate:

- ST: `https://ttomohisa.github.io/htmlapps-video-speed-changer/`
- MT: `https://ttomohisa.github.io/htmlapps-video-speed-changer/mt/`

Project Pages does not use the Cloudflare `_headers` file. Its MT wrapper conditionally loads `./coi-serviceworker.js` only when `window.crossOriginIsolated === false`. The helper registers from its own script URL with no expanded scope, so the project deployment is confined to `/htmlapps-video-speed-changer/mt/`. It can reload once to gain control and establish isolation before the app permits MT execution.

The helper is unmodified coi-serviceworker 0.1.7, pinned to commit `7b1d2a092d0d2dd2b7270b6f12f13605de26f214` and SHA-256 in `coi-serviceworker.lock.json`. Its [MIT notice](../licenses/coi-serviceworker-MIT.txt) is shipped beside it. Bootstrap forces `coepCredentialless` and `coepDegrade` false. The pinned worker supplies COOP `same-origin`, COEP `require-corp` and its upstream CORP `cross-origin`; do not confuse that last value with Cloudflare's server-provided CORP `same-origin`.

A first load may reload before file selection. The helper does not upload video and is not an offline application cache. Unsupported service workers/private modes can leave MT unavailable; use ST. The same-origin helper request and reload are the only hosted exception to the raw build's no-runtime-network behavior. CSP keeps `connect-src 'none'`.

## Cloudflare PR previews

`wrangler.preview.jsonc` serves `pages-dist/`. `_headers` applies the three server isolation headers **only** to `/mt/*`. Already-isolated MT pages skip the helper bootstrap. ST remains outside that scope.

The preview workflow:

1. Installs Node 24 and runs the full canonical repository gate.
2. Stages the optional Pages-bootstrap QA fixture described below.
3. Uses the existing Cloudflare preview configuration/secrets.
4. Probes ST and MT HTTP responses and checks all three MT headers.
5. Launches Chromium and runs `scripts/verify-mt-isolation.mjs` against the exact MT URL.
6. Comments the ST, MT and bootstrap-QA URLs on the PR only after the normal MT check passes.

The CDP helper must match both target URL and execution-context `location.href` exactly, then verify `crossOriginIsolated` and SharedArrayBuffer. It waits for delayed navigation, rejects blank/wrong/redirected contexts and bounds all fetch/WebSocket/CDP operations within one 30-second deadline. Executable discovery wraps filtered PowerShell results in `@()` before `[0]`, so a single installed browser yields its entire path.

### Pages-bootstrap QA without server headers

Only Cloudflare preview adds this optional directory:

```powershell
./scripts/prepare-pages.ps1 -PreviewBootstrapCheck
```

`/pages-bootstrap/mt/` contains byte-identical copies of the normal MT wrapper, raw MT, helper and MIT notice. The `/mt/*` header rule does not match this path. Its relative helper URL confines the service worker to `/pages-bootstrap/mt/`. This allows a fresh browser to exercise the actual Pages-style helper request, reload, resulting isolation and real conversion independently of server-header isolation.

Normal Pages staging excludes the fixture. Automated staging/CDP tests do not themselves prove service-worker behavior; record the first-load/reload browser check separately. Do not label the QA route verified solely because `/mt/` passed.

PR-close cleanup remains deletion-only and does not perform a new build or production deployment.

## Browser Kitty or another host

These are integration instructions; they do not assert that Browser Kitty integration is already deployed. Copy the raw `dist/index.mt.html` and configure the actual serving route with the required headers. Prefer a dedicated MT path rather than site-wide isolation. If the wrapped HTML is copied instead, correct server isolation prevents its optional helper request.

For example, an Azure Static Web Apps route can be configured as:

```json
{
  "routes": [{
    "route": "/apps/video-speed-changer/mt/*",
    "headers": {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin"
    }
  }]
}
```

Apply headers to the origin actually serving the MT document. Merely linking to or framing a different origin does not change its headers. Embedding and top-level isolation support must be evaluated separately; prefer opening the app directly. Consult the [Azure Static Web Apps configuration reference](https://learn.microsoft.com/azure/static-web-apps/configuration) when configuring that host.

Before publishing, follow [VERIFY_OFFLINE.md](../VERIFY_OFFLINE.md) and record actual browser/media results in [REGRESSION.md](../REGRESSION.md).
