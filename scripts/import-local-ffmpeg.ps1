param(
  [Parameter(Mandatory = $true)][string]$BuilderRoot
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BuilderRoot = [System.IO.Path]::GetFullPath($BuilderRoot)
$Source = Join-Path $BuilderRoot "dist\video-speed-changer"
$Runtime = Join-Path $BuilderRoot "runtime\browser-ffmpeg.js"
$Manifest = Join-Path $Source "manifest.json"
$Vendor = Join-Path $Root "vendor\ffmpeg"

function Get-Sha256FileHex([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $algorithm.ComputeHash($stream)
    return (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

function Expand-GzipFileBytes([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Gzip file not found: $Path" }
  $input = [System.IO.File]::OpenRead($Path)
  $output = New-Object System.IO.MemoryStream
  try {
    $gzip = New-Object System.IO.Compression.GZipStream -ArgumentList $input, ([System.IO.Compression.CompressionMode]::Decompress)
    try { $gzip.CopyTo($output) } finally { $gzip.Dispose() }
    return ,$output.ToArray()
  } finally {
    $output.Dispose()
    $input.Dispose()
  }
}

function Assert-EmbeddedCorePayloads([string]$JsGzipPath, [string]$WasmGzipPath) {
  $jsBytes = Expand-GzipFileBytes $JsGzipPath
  $jsText = [System.Text.Encoding]::UTF8.GetString($jsBytes)
  if (-not $jsText.Contains("createFFmpegCore")) { throw "FFmpeg JS gzip payload does not contain createFFmpegCore." }

  $wasmBytes = Expand-GzipFileBytes $WasmGzipPath
  if ($wasmBytes.Length -lt 8 -or $wasmBytes[0] -ne 0x00 -or $wasmBytes[1] -ne 0x61 -or $wasmBytes[2] -ne 0x73 -or $wasmBytes[3] -ne 0x6d) {
    throw "FFmpeg WASM gzip payload does not expand to a valid WebAssembly module."
  }
}

foreach ($path in @(
  (Join-Path $Source "ffmpeg.js.gz"),
  (Join-Path $Source "ffmpeg.wasm.gz"),
  $Runtime,
  $Manifest
)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required builder output is missing: $path"
  }
}

Assert-EmbeddedCorePayloads (Join-Path $Source "ffmpeg.js.gz") (Join-Path $Source "ffmpeg.wasm.gz")

$manifestJson = Get-Content -Raw -Encoding UTF8 $Manifest | ConvertFrom-Json
if ([string]$manifestJson.profile -ne "video-speed-changer") {
  throw "Builder manifest profile must be video-speed-changer."
}
try {
  $builderVersion = [version][string]$manifestJson.builderVersion
} catch {
  throw "Builder manifest has an invalid builderVersion."
}
if ($builderVersion -lt [version]"1.8.1") {
  throw "Video Speed Changer v1.0.0 requires FFmpeg WASM Builder v1.8.1 or newer. Found $builderVersion."
}
if (-not $manifestJson.runtime.fileProtocolSingleHtml) {
  throw "Builder manifest must declare runtime.fileProtocolSingleHtml=true for this app."
}
if ($manifestJson.runtime.requiresSharedArrayBuffer) {
  throw "Video Speed Changer standalone runtime must not require SharedArrayBuffer."
}
if ($manifestJson.runtime.requiresCrossOriginIsolation) {
  throw "Video Speed Changer standalone runtime must not require cross-origin isolation."
}

$runtimeText = Get-Content -Raw -Encoding UTF8 $Runtime
foreach ($requiredRuntimeMarker in @("options.preservePitch === false", "options.signal", "videoSpeedChangerInspectArgs")) {
  if (-not $runtimeText.Contains($requiredRuntimeMarker)) {
    throw "Builder runtime does not expose the v1.0.0 cancellation/inspection contract: $requiredRuntimeMarker"
  }
}

New-Item -ItemType Directory -Force -Path $Vendor | Out-Null
Copy-Item -Force (Join-Path $Source "ffmpeg.js.gz") (Join-Path $Vendor "ffmpeg.js.gz")
Copy-Item -Force (Join-Path $Source "ffmpeg.wasm.gz") (Join-Path $Vendor "ffmpeg.wasm.gz")
Copy-Item -Force $Runtime (Join-Path $Vendor "browser-ffmpeg.js")
Copy-Item -Force $Manifest (Join-Path $Vendor "manifest.json")
$provenance = [ordered]@{
  schemaVersion = 1
  sourceType = "local-builder"
  builderRoot = $BuilderRoot
  profile = [string]$manifestJson.profile
  builderVersion = [string]$manifestJson.builderVersion
  manifestSha256 = (Get-Sha256FileHex $Manifest)
}
[System.IO.File]::WriteAllText((Join-Path $Vendor "provenance.json"), ($provenance | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))

Write-Host "[OK] Verified Builder $builderVersion / profile video-speed-changer" -ForegroundColor Green
Write-Host "[OK] Imported Video Speed Changer FFmpeg core from $Source" -ForegroundColor Green
