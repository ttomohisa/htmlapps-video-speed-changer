param(
  [switch]$PreviewBootstrapCheck
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Dist = Join-Path $Root "dist"
$Pages = Join-Path $Root "pages-dist"
$MtPages = Join-Path $Pages "mt"
$WorkerSource = Join-Path $Root "vendor\coi-serviceworker\coi-serviceworker.js"
$WorkerLicense = Join-Path $Root "licenses\coi-serviceworker-MIT.txt"
$WorkerLockPath = Join-Path $Root "coi-serviceworker.lock.json"

function Get-Sha256FileHex([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return (($algorithm.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $algorithm.Dispose()
  }
}

$stSource = Join-Path $Dist "index.html"
$mtSource = Join-Path $Dist "index.mt.html"
foreach ($path in @($stSource, $mtSource, $WorkerSource, $WorkerLockPath, $WorkerLicense)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Required Pages input is missing: $path" }
}

$lock = Get-Content -Raw -Encoding UTF8 $WorkerLockPath | ConvertFrom-Json
$actualWorkerHash = Get-Sha256FileHex $WorkerSource
if ($actualWorkerHash -ne ([string]$lock.sha256).ToLowerInvariant()) {
  throw "coi-serviceworker.js SHA-256 does not match coi-serviceworker.lock.json."
}

$mtHtml = Get-Content -Raw -Encoding UTF8 $mtSource
$loader = @'
  <!-- GitHub Pages MT bootstrap. Hosts with server-side COOP/COEP do not load the fallback worker. -->
  <script>
    if (window.crossOriginIsolated === false) {
      let reloadRequested = false;
      const reloadWhenControlled = () => {
        const serviceWorker = navigator.serviceWorker;
        if (!serviceWorker || reloadRequested) return;
        // updatefound can precede activation/clients.claim. Reload only once
        // the navigation will actually pass through the isolation helper.
        serviceWorker.addEventListener("controllerchange", reloadWhenControlled);
        if (!serviceWorker.controller) return;
        reloadRequested = true;
        serviceWorker.removeEventListener("controllerchange", reloadWhenControlled);
        window.location.reload();
      };
      window.coi = {
        coepCredentialless: () => false,
        coepDegrade: () => false,
        doReload: reloadWhenControlled,
        quiet: true
      };
      const coiScript = document.createElement("script");
      coiScript.src = "./coi-serviceworker.js";
      document.head.appendChild(coiScript);
    }
  </script>
'@
if (-not $mtHtml.Contains("</head>")) { throw "dist/index.mt.html does not contain </head>." }
if ($mtHtml.Contains("coi-serviceworker.js")) { throw "dist/index.mt.html must remain standalone and must not reference coi-serviceworker.js." }
$mtPagesHtml = $mtHtml.Replace("</head>", $loader + "`r`n</head>")
# Validate all input before replacing a previously staged site.
if (Test-Path -LiteralPath $Pages) {
  Remove-Item -LiteralPath $Pages -Recurse -Force
}
New-Item -ItemType Directory -Path $MtPages -Force | Out-Null
Copy-Item -LiteralPath $stSource -Destination (Join-Path $Pages "index.html")
Copy-Item -LiteralPath $mtSource -Destination (Join-Path $MtPages "index.mt.html")
Copy-Item -LiteralPath $WorkerSource -Destination (Join-Path $MtPages "coi-serviceworker.js")
Copy-Item -LiteralPath $WorkerLicense -Destination (Join-Path $MtPages "coi-serviceworker-MIT.txt")
[System.IO.File]::WriteAllText((Join-Path $Pages ".nojekyll"), "", (New-Object System.Text.UTF8Encoding($false)))
# Cloudflare consumes this file; GitHub Pages ignores it. Never isolate the ST root.
$headers = @'
/mt/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Resource-Policy: same-origin
'@
[System.IO.File]::WriteAllText((Join-Path $Pages "_headers"), $headers.Replace("`r`n", "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $MtPages "index.html"), $mtPagesHtml, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "[OK] ST/MT site prepared: $Pages"
Write-Host "  /       -> single-thread standalone"
Write-Host "  /mt/    -> multi-thread + same-origin COI service worker fallback"
Write-Host "  /mt/index.mt.html -> unmodified MT standalone for isolated hosts"

# Preview-only copy without /mt/* server headers, for real Pages bootstrap QA.
# The relative script URL preserves the narrower /pages-bootstrap-control-ready/mt/ scope.
if ($PreviewBootstrapCheck) {
  $bootstrapPages = Join-Path $Pages "pages-bootstrap-control-ready"
  New-Item -ItemType Directory -Path $bootstrapPages -Force | Out-Null
  Copy-Item -LiteralPath $MtPages -Destination (Join-Path $bootstrapPages "mt") -Recurse
  Write-Host "  /pages-bootstrap-control-ready/mt/ -> preview-only Pages bootstrap verification"
}
