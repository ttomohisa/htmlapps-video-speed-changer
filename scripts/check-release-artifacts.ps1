param(
  [string]$DistRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if ([string]::IsNullOrWhiteSpace($DistRoot)) { $DistRoot = Join-Path $Root "dist" }
if (-not [System.IO.Path]::IsPathRooted($DistRoot)) { $DistRoot = [System.IO.Path]::GetFullPath((Join-Path $Root $DistRoot)) }

$app = Get-Content -Raw -Encoding UTF8 (Join-Path $Root "app.config.json") | ConvertFrom-Json
$readable = Join-Path $DistRoot "index.html"
$selfExtract = Join-Path $DistRoot "index.self-extract.html"
$dependencyManifest = Join-Path $DistRoot "dependency-manifest.json"
$selfExtractManifest = Join-Path $DistRoot "self-extract-manifest.json"
$sizeReport = Join-Path $DistRoot "build-size-report.json"
$noJekyll = Join-Path $DistRoot ".nojekyll"

foreach ($path in @($readable, $selfExtract, $dependencyManifest, $selfExtractManifest, $sizeReport, $noJekyll)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required release artifact is missing: $path" }
}

& (Join-Path $Root "scripts\verify-standalone.ps1") -Path $readable -RequireNetworkBlock ([bool]$app.build.blockRuntimeNetwork)
& (Join-Path $Root "scripts\verify-self-extract.ps1") -Path $selfExtract -ExpectedSourcePath $readable

$manifest = Get-Content -Raw -Encoding UTF8 $dependencyManifest | ConvertFrom-Json
if ([string]$manifest.app.slug -ne [string]$app.slug) { throw "dependency-manifest.json app slug does not match app.config.json." }
if ([string]$manifest.app.version -ne [string]$app.version) { throw "dependency-manifest.json app version does not match app.config.json." }
if (-not $manifest.embeddedRuntime -or -not $manifest.embeddedRuntime.ffmpeg) { throw "dependency-manifest.json is missing embedded FFmpeg provenance." }
if ([string]$manifest.embeddedRuntime.ffmpeg.profile -ne "video-speed-changer") { throw "dependency-manifest.json has the wrong FFmpeg profile." }
if (-not $manifest.embeddedRuntime.ffmpeg.fileProtocolSingleHtml) { throw "FFmpeg provenance must declare fileProtocolSingleHtml=true." }
if ($manifest.embeddedRuntime.ffmpeg.requiresSharedArrayBuffer) { throw "Release artifact must not require SharedArrayBuffer." }
if ($manifest.embeddedRuntime.ffmpeg.requiresCrossOriginIsolation) { throw "Release artifact must not require cross-origin isolation." }
if (-not $manifest.embeddedRuntime.ffmpeg.source) { throw "Release artifact is missing FFmpeg source provenance." }
if ([string]$manifest.embeddedRuntime.ffmpeg.source.type -ne "github-release") { throw "Release artifact must embed FFmpeg from the pinned GitHub Release, not a local Builder checkout." }
$releaseLockPath = Join-Path $Root "ffmpeg.release.lock.json"
$releaseLock = Get-Content -Raw -Encoding UTF8 $releaseLockPath | ConvertFrom-Json
if ([string]$releaseLock.sha256 -notmatch '^[a-f0-9]{64}$') { throw "Committed FFmpeg release lock is not pinned." }
if ([string]$manifest.embeddedRuntime.ffmpeg.source.tag -ne [string]$releaseLock.tag) { throw "Release artifact FFmpeg tag does not match ffmpeg.release.lock.json." }
if ([string]$manifest.embeddedRuntime.ffmpeg.source.asset -ne [string]$releaseLock.asset) { throw "Release artifact FFmpeg asset does not match ffmpeg.release.lock.json." }
if ([string]$manifest.embeddedRuntime.ffmpeg.source.assetSha256 -ne [string]$releaseLock.sha256) { throw "Release artifact FFmpeg asset SHA-256 does not match ffmpeg.release.lock.json." }
foreach ($name in @("ffmpeg.js.gz", "ffmpeg.wasm.gz", "browser-ffmpeg.js")) {
  $fileEntry = $manifest.embeddedRuntime.ffmpeg.files.$name
  if (-not $fileEntry) { throw "FFmpeg provenance is missing $name." }
  if ([long]$fileEntry.bytes -le 0) { throw "FFmpeg provenance has an invalid byte count for $name." }
  if ([string]$fileEntry.sha256 -notmatch '^[a-f0-9]{64}$') { throw "FFmpeg provenance has an invalid SHA-256 for $name." }
}

$size = Get-Content -Raw -Encoding UTF8 $sizeReport | ConvertFrom-Json
if ([long]$size.readableHtmlBytes -ne (Get-Item $readable).Length) { throw "build-size-report.json readableHtmlBytes does not match index.html." }
if ([long]$size.selfExtractHtmlBytes -ne (Get-Item $selfExtract).Length) { throw "build-size-report.json selfExtractHtmlBytes does not match index.self-extract.html." }

Write-Host "[OK] Release artifacts verified: $DistRoot" -ForegroundColor Green
Write-Host "[OK] Version: $($app.version) / profile: $($manifest.embeddedRuntime.ffmpeg.profile) / Builder: $($manifest.embeddedRuntime.ffmpeg.builderVersion)"
