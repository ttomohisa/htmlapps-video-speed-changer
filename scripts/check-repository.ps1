param(
  [switch]$ForceDownload
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$required = @(
  "AGENTS.md",
  "APP_SPEC.md",
  "app.config.json",
  "ffmpeg.release.json",
  "ffmpeg.release.lock.json",
  "pin-ffmpeg-release.bat",
  "build-with-release-ffmpeg.bat",
  "dependencies.json",
  "dependencies.lock.json",
  ".github\workflows\dependency-updates.yml",
  "components\confirm-dialog.html",
  "components\toast.html",
  "components\popover-menu.html",
  "components\setting-field.html",
  "components\async-state.html",
  "components\mobile-bottom-bar.html",
  "components\webrtc-qr-pairing.html",
  "docs\COMPONENTS.md",
  "docs\DEPENDENCIES.md",
  "docs\DEPENDENCIES.ja.md",
  "docs\COMPONENTS.ja.md",
  "docs\WEBRTC_QR_PAIRING.md",
  "docs\WEBRTC_QR_PAIRING.ja.md",
  "examples\dependencies.webrtc-qr.json",
  "src\index.template.html",
  "build-standalone.ps1",
  "scripts\build-self-extract.ps1",
  "scripts\pin-ffmpeg-release.ps1",
  "scripts\import-release-ffmpeg.ps1",
  "scripts\import-local-ffmpeg.ps1",
  "scripts\dependency-tools.ps1",
  "scripts\check-dependency-updates.ps1",
  "scripts\sync-dependency-lock.ps1",
  "scripts\update-dependency.ps1",
  "scripts\verify-standalone.ps1",
  "scripts\verify-self-extract.ps1",
  "scripts\import-local-ffmpeg.ps1",
  "build-with-local-ffmpeg.bat",
  "vendor\ffmpeg\README.md",
  "README.md",
  "README.ja.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "schemas\app-config.schema.json",
  "schemas\dependencies.schema.json",
  "schemas\dependencies-lock.schema.json"
)

foreach ($relative in $required) {
  $path = Join-Path $Root $relative
  if (-not (Test-Path $path)) { throw "Required repository file is missing: $relative" }
}

$mobileBottomBarPath = Join-Path $Root "components\mobile-bottom-bar.html"
$mobileBottomBarText = Get-Content -Raw -Encoding UTF8 $mobileBottomBarPath
$mobileBottomBarRequiredTokens = @(
  'position: fixed',
  'env(safe-area-inset-bottom)',
  'data-mobile-page-target',
  'app-mobile-page',
  'showPage',
  'currentPage',
  'data-mobile-target',
  'data-mobile-action',
  'disabled',
  'window.AppMobileBottomBar'
)
foreach ($token in $mobileBottomBarRequiredTokens) {
  if (-not $mobileBottomBarText.Contains($token)) {
    throw "components\mobile-bottom-bar.html is missing required behavior marker: $token"
  }
}


$componentContracts = @(
  @{ Path = "components\toast.html"; Tokens = @("window.AppToast", "actionLabel", "onAction", "env(safe-area-inset-bottom)") },
  @{ Path = "components\popover-menu.html"; Tokens = @("window.AppPopoverMenu", "data-popover-trigger", "aria-expanded", "Escape") },
  @{ Path = "components\setting-field.html"; Tokens = @("window.AppSettingField", "data-setting-custom", "data-setting-range", "settingchange") },
  @{ Path = "components\async-state.html"; Tokens = @("window.AppAsyncState", "invalidateSource", "captureGeneration", "isCurrent") },
  @{ Path = "components\webrtc-qr-pairing.html"; Tokens = @("window.AppWebRtcQrPairing", "iceServers:[]", "waitForIceComplete", "BarcodeDetector", "answerAutoRetryLimit", "StandaloneAssets", "createJoinAnswer", "payloadPrefix", "qrPrefix") }
)
foreach ($contract in $componentContracts) {
  $componentText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root $contract.Path)
  foreach ($token in @($contract.Tokens)) {
    if (-not $componentText.Contains([string]$token)) {
      throw "$($contract.Path) is missing required behavior marker: $token"
    }
  }
}

$dependencyConfig = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "dependencies.json") | ConvertFrom-Json
$dependencyLock = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "dependencies.lock.json") | ConvertFrom-Json
if ([int]$dependencyLock.schemaVersion -ne 1) { throw "dependencies.lock.json must use schemaVersion 1." }
$configIds = @($dependencyConfig.dependencies | ForEach-Object { [string]$_.id })
$lockIds = @($dependencyLock.dependencies | ForEach-Object { [string]$_.id })
if ($configIds.Count -ne $lockIds.Count) { throw "dependencies.lock.json must contain exactly one entry for every dependency." }
foreach ($dependency in @($dependencyConfig.dependencies)) {
  $matches = @($dependencyLock.dependencies | Where-Object { [string]$_.id -eq [string]$dependency.id })
  if ($matches.Count -ne 1) { throw "dependencies.lock.json must contain exactly one lock entry for '$([string]$dependency.id)'." }
  if ([string]$matches[0].package -ne [string]$dependency.package -or [string]$matches[0].version -ne [string]$dependency.version) {
    throw "dependencies.lock.json does not match dependencies.json for '$([string]$dependency.id)'."
  }
}

$webrtcDependencyExample = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "examples\dependencies.webrtc-qr.json") | ConvertFrom-Json
$webrtcDependencyIds = @($webrtcDependencyExample.dependencies | ForEach-Object { [string]$_.id })
foreach ($requiredDependencyId in @("qrcode-generator", "jsqr")) {
  if ($webrtcDependencyIds -notcontains $requiredDependencyId) {
    throw "examples\dependencies.webrtc-qr.json is missing required dependency: $requiredDependencyId"
  }
}

$sourceText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "src\index.template.html")
if (-not $sourceText.Contains("__EMBEDDED_ASSET_BUNDLE_JSON__")) { throw "src\index.template.html must embed the asset bundle JSON directly." }
if ($sourceText.Contains("__EMBEDDED_ASSET_BUNDLE_BASE64__")) { throw "Legacy double-Base64 asset bundle placeholder must not return." }
foreach ($token in @("bytesAsync", "blobUrlAsync", "videoInput", "window.AppAsyncState", "window.AppToast", "__FFMPEG_JS_GZIP_BASE64__", "__FFMPEG_WASM_GZIP_BASE64__", "__FFMPEG_BROWSER_RUNTIME__", "videoSpeedChangerArgs", "loadEmbedded", "convertButton")) {
  if (-not $sourceText.Contains($token)) { throw "src\index.template.html is missing required template behavior marker: $token" }
}

$builderText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "build-standalone.ps1")
foreach ($token in @("compressionSetting", "Compress-GzipBytes", "build-size-report.json", "sizeBudget", "DependencyLockPath", "tarballSha256", "__EMBEDDED_ASSET_BUNDLE_JSON__", "__FFMPEG_JS_GZIP_BASE64__", "__FFMPEG_WASM_GZIP_BASE64__", "__FFMPEG_BROWSER_RUNTIME__", "vendor\ffmpeg")) {
  if (-not $builderText.Contains($token)) { throw "build-standalone.ps1 is missing required asset pipeline marker: $token" }
}
if ($builderText.Contains("__EMBEDDED_ASSET_BUNDLE_BASE64__")) { throw "build-standalone.ps1 must not wrap the full asset bundle in Base64." }

$selfExtractBuilderPath = Join-Path $Root "scripts\build-self-extract.ps1"
$selfExtractBuilderBytes = [System.IO.File]::ReadAllBytes($selfExtractBuilderPath)
$selfExtractBuilderStart = 0
if (
  $selfExtractBuilderBytes.Length -ge 3 -and
  $selfExtractBuilderBytes[0] -eq 0xef -and
  $selfExtractBuilderBytes[1] -eq 0xbb -and
  $selfExtractBuilderBytes[2] -eq 0xbf
) {
  $selfExtractBuilderStart = 3
}
for ($index = $selfExtractBuilderStart; $index -lt $selfExtractBuilderBytes.Length; $index += 1) {
  if ($selfExtractBuilderBytes[$index] -gt 0x7f) {
    throw "scripts\build-self-extract.ps1 must contain ASCII text only so Windows PowerShell 5.1 cannot corrupt loader text."
  }
}

$buildCompatibilityFiles = @(
  "build-standalone.ps1",
  "scripts\build-self-extract.ps1",
  "scripts\verify-standalone.ps1",
  "scripts\verify-self-extract.ps1",
  "scripts\pin-ffmpeg-release.ps1",
  "scripts\import-release-ffmpeg.ps1",
  "scripts\import-local-ffmpeg.ps1",
  "scripts\dependency-tools.ps1",
  "scripts\check-dependency-updates.ps1",
  "scripts\sync-dependency-lock.ps1",
  "scripts\update-dependency.ps1"
)
foreach ($relative in $buildCompatibilityFiles) {
  $compatibilityPath = Join-Path $Root $relative
  $compatibilityText = Get-Content -Raw -Encoding UTF8 $compatibilityPath
  if ($compatibilityText -match '(?i)\bGet-FileHash\b') {
    throw "$relative must not depend on Get-FileHash; use the .NET SHA-256 helper for broader Windows PowerShell compatibility."
  }
  if ($compatibilityText -match '::new\s*\(') {
    throw "$relative must not use ::new(); use New-Object or older-compatible .NET construction syntax."
  }
}

# Regression check: dependency update reporting must handle both zero dependencies and one disabled dependency without network access.
$dependencyUpdateCheckPath = Join-Path $Root "scripts\check-dependency-updates.ps1"
$dependencyUpdateTestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("single-html-template-dependency-check-" + [Guid]::NewGuid().ToString("N"))
$dependencyUpdateCases = @(
  @{
    Name = "empty"
    Json = '{"dependencies":[]}'
    DependencyCount = 0
    CheckedCount = 0
    DisabledCount = 0
  },
  @{
    Name = "single-disabled"
    Json = '{"dependencies":[{"id":"fixture","package":"fixture-package","version":"1.0.0","updates":{"enabled":false,"policy":"manual"}}]}'
    DependencyCount = 1
    CheckedCount = 0
    DisabledCount = 1
  }
)
try {
  New-Item -ItemType Directory -Force -Path $dependencyUpdateTestRoot | Out-Null
  foreach ($case in $dependencyUpdateCases) {
    $caseRoot = Join-Path $dependencyUpdateTestRoot ([string]$case.Name)
    New-Item -ItemType Directory -Force -Path $caseRoot | Out-Null
    $caseDependenciesPath = Join-Path $caseRoot "dependencies.json"
    $caseJsonOutput = Join-Path $caseRoot "report.json"
    $caseMarkdownOutput = Join-Path $caseRoot "report.md"
    [System.IO.File]::WriteAllText($caseDependenciesPath, [string]$case.Json, (New-Object System.Text.UTF8Encoding($false)))
    & $dependencyUpdateCheckPath -DependenciesPath $caseDependenciesPath -JsonOutput $caseJsonOutput -MarkdownOutput $caseMarkdownOutput
    $caseReport = Get-Content -Raw -Encoding UTF8 $caseJsonOutput | ConvertFrom-Json
    if ([int]$caseReport.dependencyCount -ne [int]$case.DependencyCount) { throw "Dependency update regression '$($case.Name)' reported an unexpected dependencyCount." }
    if ([int]$caseReport.checkedCount -ne [int]$case.CheckedCount) { throw "Dependency update regression '$($case.Name)' reported an unexpected checkedCount." }
    if ([int]$caseReport.disabledCount -ne [int]$case.DisabledCount) { throw "Dependency update regression '$($case.Name)' reported an unexpected disabledCount." }
    if ([int]$caseReport.updateCount -ne 0) { throw "Dependency update regression '$($case.Name)' must not report updates." }
  }
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $dependencyUpdateTestRoot
}

# Regression check: runtime identifiers like __APP_INTERNAL_STATE__ are not build placeholders.
$verifyPath = Join-Path $Root "scripts\verify-standalone.ps1"
$tempVerifyPath = Join-Path ([System.IO.Path]::GetTempPath()) ("single-html-template-verify-" + [Guid]::NewGuid().ToString("N") + ".html")
$syntheticHtml = @'
<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E">
</head><body><script>const __APP_INTERNAL_STATE__ = 1;</script></body></html>
'@
try {
  [System.IO.File]::WriteAllText($tempVerifyPath, $syntheticHtml, (New-Object System.Text.UTF8Encoding($false)))
  & $verifyPath -Path $tempVerifyPath -RequireNetworkBlock $true
} finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $tempVerifyPath
}

$app = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "app.config.json") | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace([string]$app.name)) { throw "app.config.json: name is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.slug)) { throw "app.config.json: slug is required" }
if ([string]::IsNullOrWhiteSpace([string]$app.version)) { throw "app.config.json: version is required" }
if ([string]$app.slug -ne "video-speed-changer") { throw "app.config.json: slug must be video-speed-changer" }
if ([string]$app.version -ne "1.0.3") { throw "app.config.json: v1.0.3 source package must identify version 1.0.3" }
if ([double]$app.build.sizeBudget.readableWarningMb -gt 8) { throw "Readable single-HTML warning budget must stay at or below 8 MB for v1.0.0." }
if ([double]$app.build.sizeBudget.selfExtractWarningMb -gt 5) { throw "Self-extract single-HTML warning budget must stay at or below 5 MB for v1.0.0." }
if (-not $sourceText.Contains("connect-src 'none'")) { throw "Video Speed Changer must keep connect-src 'none'." }
if (-not $sourceText.Contains("'wasm-unsafe-eval'")) { throw "Video Speed Changer must allow wasm-unsafe-eval for the embedded FFmpeg WASM core." }
# The app-icon regression below verifies the supplied header and favicon artwork.
$ffmpegReleaseConfig = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "ffmpeg.release.json") | ConvertFrom-Json
$ffmpegReleaseLock = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "ffmpeg.release.lock.json") | ConvertFrom-Json
foreach ($obj in @($ffmpegReleaseConfig, $ffmpegReleaseLock)) {
  if ([int]$obj.schemaVersion -ne 1) { throw "FFmpeg release config/lock must use schemaVersion 1." }
}
foreach ($property in @("repository", "tag", "asset", "profile", "builderVersion")) {
  if ([string]$ffmpegReleaseLock.$property -ne [string]$ffmpegReleaseConfig.$property) { throw "FFmpeg release lock mismatch for $property." }
}
if ([string]$ffmpegReleaseConfig.repository -ne "ttomohisa/htmlapps-ffmpeg-wasm-builder") { throw "FFmpeg release repository pin changed unexpectedly." }
if ([string]$ffmpegReleaseConfig.tag -ne "v1.8.1") { throw "FFmpeg release tag must stay pinned to v1.8.1 for v1.0.0." }
if ([string]$ffmpegReleaseConfig.asset -ne "ffmpeg-wasm-video-speed-changer-v1.8.1.zip") { throw "FFmpeg release asset name changed unexpectedly." }
if ([string]$ffmpegReleaseLock.sha256 -notmatch '^[a-f0-9]{64}$') { throw "FFmpeg release is not pinned. Release Builder v1.8.1, run pin-ffmpeg-release.bat, and commit ffmpeg.release.lock.json." }
if ([long]$ffmpegReleaseLock.releaseId -le 0 -or [long]$ffmpegReleaseLock.assetId -le 0 -or [long]$ffmpegReleaseLock.assetBytes -le 0) { throw "FFmpeg release lock metadata is incomplete." }
$pinReleaseText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "scripts\pin-ffmpeg-release.ps1")
foreach ($token in @("releases/tags", "asset.digest", "sha256:", "Assert-ReleasePayload", "pinnedAtUtc")) {
  if (-not $pinReleaseText.Contains($token)) { throw "FFmpeg release pin script is missing required marker: $token" }
}
$importReleaseText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "scripts\import-release-ffmpeg.ps1")
foreach ($token in @("ffmpeg.release.lock.json", "assetSha256", "github-release", "Get-Sha256FileHex", "Assert-ReleasePayload")) {
  if (-not $importReleaseText.Contains($token)) { throw "Pinned FFmpeg import script is missing required marker: $token" }
}
$selfExtractBuilderText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "scripts\build-self-extract.ps1")
if (-not $selfExtractBuilderText.Contains("'wasm-unsafe-eval'")) { throw "Self-extract CSP must allow wasm-unsafe-eval for the restored FFmpeg WASM app." }
$verifyStandaloneText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "scripts\verify-standalone.ps1")
foreach ($token in @("Embedded FFmpeg WASM payload is not a valid WebAssembly module", "Embedded favicon is missing", "object-src 'none'", "frame-src 'none'", "base-uri 'none'", "form-action 'none'")) {
  if (-not $verifyStandaloneText.Contains($token)) { throw "Standalone verification hardening is missing required marker: $token" }
}
$verifySelfExtractText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "scripts\verify-self-extract.ps1")
foreach ($token in @("self-extract-source-sha256", "self-extract-gzip-sha256", "Get-Sha256Hex", "byte-count metadata")) {
  if (-not $verifySelfExtractText.Contains($token)) { throw "Self-extract verification hardening is missing required marker: $token" }
}
$importScriptText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "scripts\import-local-ffmpeg.ps1")
foreach ($token in @("dist\video-speed-changer", "ffmpeg.js.gz", "ffmpeg.wasm.gz", "browser-ffmpeg.js")) {
  if (-not $importScriptText.Contains($token)) { throw "FFmpeg import script is missing required marker: $token" }
}
foreach ($token in @("1.8.1", "builderVersion", "video-speed-changer", "options.preservePitch === false", "options.signal", "videoSpeedChangerInspectArgs", "Assert-EmbeddedCorePayloads", "fileProtocolSingleHtml", "requiresSharedArrayBuffer", "requiresCrossOriginIsolation")) {
  if (-not $importScriptText.Contains($token)) { throw "FFmpeg import compatibility check is missing required marker: $token" }
}
$releaseArtifactCheckText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "scripts\check-release-artifacts.ps1")
foreach ($token in @("verify-standalone.ps1", "verify-self-extract.ps1", "embeddedRuntime", "fileProtocolSingleHtml", "build-size-report.json", "github-release", "ffmpeg.release.lock.json", "assetSha256")) {
  if (-not $releaseArtifactCheckText.Contains($token)) { throw "Release artifact check is missing required marker: $token" }
}
$buildStandaloneText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "build-standalone.ps1")
foreach ($token in @("manifest.json", "ffmpegBuilderVersion", "1.8.1", "options.preservePitch === false", "options.signal", "videoSpeedChangerInspectArgs", "Assert-EmbeddedCorePayloads", "embeddedRuntime", "fileProtocolSingleHtml", "requiresSharedArrayBuffer", "requiresCrossOriginIsolation", "import-release-ffmpeg.ps1", "UseLocalFfmpeg", "github-release", "assetSha256")) {
  if (-not $buildStandaloneText.Contains($token)) { throw "Standalone FFmpeg compatibility check is missing required marker: $token" }
}
foreach ($token in @('id="speedPresetRange"', 'id="speedModeLabel"', 'id="noAudioInput"', 'id="outputNameInput"', 'id="resultPreview"', 'id="cancelConvertButton"', 'id="previewUnavailable"', 'id="convertErrorDetails"', 'name="quality"', "QUALITY_PRESETS", "resultStaleNotice", "preservePitch:", "noAudio:", "AbortController", "inspectSourceWithFfmpeg")) {
  if (-not $sourceText.Contains($token)) { throw "v1.0.0 UI/output UX is missing required marker: $token" }
}
foreach ($token in @('#helpDialog[open]', 'flex-direction: column', 'min-height: 0', 'overflow-y: auto', 'env(safe-area-inset-bottom)')) {
  if (-not $sourceText.Contains($token)) { throw "v1.0.0 help dialog viewport safety is missing required marker: $token" }
}

# Check the committed download before a build could hide stale application code.
$node = Get-Command node -ErrorAction Stop
& $node.Source (Join-Path $Root "tests/check-release-parity.mjs") --source-only
if ($LASTEXITCODE -ne 0) { throw "Video Speed Changer source/download parity failed." }

$buildArguments = @{}
if ($ForceDownload) { $buildArguments.ForceDownload = $true }
& (Join-Path $Root "build-standalone.ps1") @buildArguments


# WebRTC readiness DataChannel regression
$webrtcReadyText = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "components\webrtc-qr-pairing.html")
if (-not $webrtcReadyText.Contains("readyChannelLabel: null")) {
  throw "WebRTC component is missing readyChannelLabel."
}
if (-not $webrtcReadyText.Contains("requireReadyChannelOpen: true")) {
  throw "WebRTC component is missing requireReadyChannelOpen."
}
if (-not $webrtcReadyText.Contains("readyChannelLabel is required when createDefaultChannel is false")) {
  throw "Custom WebRTC DataChannel layouts must require readyChannelLabel."
}
if (-not $webrtcReadyText.Contains("options.requireReadyChannelOpen!==false&&(!readyChannel||readyChannel.readyState!=='open')")) {
  throw "WebRTC application-ready must wait for the designated DataChannel to open."
}


# Node executes the real app script with synthetic DOM/media/runtime boundaries.
$previousTarget = $env:VIDEO_SPEED_TEST_HTML
try {
  foreach ($target in @("src/index.template.html", "dist/index.html", "video-speed-changer.html", "dist/index.self-extract.html")) {
    $env:VIDEO_SPEED_TEST_HTML = $target
    & $node.Source --test (Join-Path $Root "tests/result-ownership.test.mjs")
    if ($LASTEXITCODE -ne 0) { throw "Video Speed Changer result/source regression failed: $target" }
  }
  & $node.Source (Join-Path $Root "tests/check-release-parity.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Video Speed Changer release parity failed." }
} finally {
  $env:VIDEO_SPEED_TEST_HTML = $previousTarget
}


& node (Join-Path $Root "tests\header-normalization.test.mjs")
if ($LASTEXITCODE -ne 0) { throw "Header normalization regression failed." }
& node (Join-Path $Root "tests\app-icon.test.mjs")
if ($LASTEXITCODE -ne 0) { throw "App icon regression failed." }
Write-Host "[OK] Repository check passed." -ForegroundColor Green
