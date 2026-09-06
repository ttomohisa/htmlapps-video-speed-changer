param(
  [switch]$ForceDownload
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ConfigPath = Join-Path $Root "ffmpeg.release.json"
$LockPath = Join-Path $Root "ffmpeg.release.lock.json"
$CacheRoot = Join-Path $Root ".cache\ffmpeg-release"
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

function Assert-ReleasePayload([string]$ExtractRoot, $Config) {
  foreach ($name in @("ffmpeg.js.gz", "ffmpeg.wasm.gz", "browser-ffmpeg.js", "manifest.json")) {
    $path = Join-Path $ExtractRoot $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Pinned FFmpeg release is missing $name." }
  }
  $manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $ExtractRoot "manifest.json") | ConvertFrom-Json
  if ([string]$manifest.profile -ne [string]$Config.profile) { throw "Pinned FFmpeg profile mismatch." }
  if ([string]$manifest.builderVersion -ne [string]$Config.builderVersion) { throw "Pinned FFmpeg Builder version mismatch." }
  if (-not $manifest.runtime.fileProtocolSingleHtml) { throw "Pinned FFmpeg runtime must support file:// single HTML." }
  if ($manifest.runtime.requiresSharedArrayBuffer) { throw "Pinned FFmpeg runtime must not require SharedArrayBuffer." }
  if ($manifest.runtime.requiresCrossOriginIsolation) { throw "Pinned FFmpeg runtime must not require cross-origin isolation." }

  $runtimeText = Get-Content -Raw -Encoding UTF8 (Join-Path $ExtractRoot "browser-ffmpeg.js")
  foreach ($marker in @("options.preservePitch === false", "options.signal", "videoSpeedChangerInspectArgs")) {
    if (-not $runtimeText.Contains($marker)) { throw "Pinned FFmpeg runtime is missing required marker: $marker" }
  }

  $jsBytes = Expand-GzipFileBytes (Join-Path $ExtractRoot "ffmpeg.js.gz")
  if (-not ([System.Text.Encoding]::UTF8.GetString($jsBytes)).Contains("createFFmpegCore")) { throw "Pinned ffmpeg.js.gz payload is invalid." }
  $wasmBytes = Expand-GzipFileBytes (Join-Path $ExtractRoot "ffmpeg.wasm.gz")
  if ($wasmBytes.Length -lt 8 -or $wasmBytes[0] -ne 0x00 -or $wasmBytes[1] -ne 0x61 -or $wasmBytes[2] -ne 0x73 -or $wasmBytes[3] -ne 0x6d) {
    throw "Pinned ffmpeg.wasm.gz does not expand to a valid WebAssembly module."
  }
  return $manifest
}

$config = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
$lock = Get-Content -Raw -Encoding UTF8 $LockPath | ConvertFrom-Json
if ([int]$config.schemaVersion -ne 1 -or [int]$lock.schemaVersion -ne 1) { throw "FFmpeg release config/lock must use schemaVersion 1." }
foreach ($property in @("repository", "tag", "asset", "profile", "builderVersion")) {
  if ([string]$lock.$property -ne [string]$config.$property) { throw "ffmpeg.release.lock.json does not match ffmpeg.release.json for $property. Re-run pin-ffmpeg-release.bat." }
}
$expectedSha = ([string]$lock.sha256).ToLowerInvariant()
if ($expectedSha -notmatch '^[a-f0-9]{64}$') {
  throw "FFmpeg release is not pinned yet. Release Builder $($config.tag), then run pin-ffmpeg-release.bat and commit ffmpeg.release.lock.json."
}
if ([long]$lock.assetBytes -le 0 -or [long]$lock.assetId -le 0 -or [long]$lock.releaseId -le 0) { throw "FFmpeg release lock metadata is incomplete. Re-run pin-ffmpeg-release.bat." }
if ([string]::IsNullOrWhiteSpace([string]$lock.browserDownloadUrl)) { throw "FFmpeg release lock has no download URL." }

New-Item -ItemType Directory -Force -Path $CacheRoot | Out-Null
$archivePath = Join-Path $CacheRoot ("$expectedSha.zip")
if ($ForceDownload -or -not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
  $partPath = "$archivePath.part"
  Remove-Item -Force -ErrorAction SilentlyContinue $partPath
  Write-Host "[FFmpeg Release] Downloading pinned $($lock.tag) asset..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri ([string]$lock.browserDownloadUrl) -OutFile $partPath -UseBasicParsing -Headers @{ "User-Agent" = "htmlapps-video-speed-changer-build" }
  Move-Item -Force $partPath $archivePath
} else {
  Write-Host "[FFmpeg Release] Using cached pinned asset $expectedSha" -ForegroundColor Cyan
}
$actualSha = Get-Sha256FileHex $archivePath
if ($actualSha -ne $expectedSha) { throw "Pinned FFmpeg release SHA-256 mismatch. Expected $expectedSha, got $actualSha." }
if ([long](Get-Item $archivePath).Length -ne [long]$lock.assetBytes) { throw "Pinned FFmpeg release byte count mismatch." }

$extractRoot = Join-Path $CacheRoot "extract-$expectedSha"
if ($ForceDownload -or -not (Test-Path -LiteralPath (Join-Path $extractRoot "manifest.json") -PathType Leaf)) {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractRoot
  New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($archivePath, $extractRoot)
}
$manifest = Assert-ReleasePayload $extractRoot $config

New-Item -ItemType Directory -Force -Path $Vendor | Out-Null
foreach ($name in @("ffmpeg.js.gz", "ffmpeg.wasm.gz", "browser-ffmpeg.js", "manifest.json")) {
  Copy-Item -Force (Join-Path $extractRoot $name) (Join-Path $Vendor $name)
}
$provenance = [ordered]@{
  schemaVersion = 1
  sourceType = "github-release"
  repository = [string]$lock.repository
  tag = [string]$lock.tag
  asset = [string]$lock.asset
  releaseId = [long]$lock.releaseId
  assetId = [long]$lock.assetId
  assetBytes = [long]$lock.assetBytes
  assetSha256 = $expectedSha
  profile = [string]$manifest.profile
  builderVersion = [string]$manifest.builderVersion
}
[System.IO.File]::WriteAllText((Join-Path $Vendor "provenance.json"), ($provenance | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[OK] Imported pinned FFmpeg release $($lock.tag) / $expectedSha" -ForegroundColor Green
