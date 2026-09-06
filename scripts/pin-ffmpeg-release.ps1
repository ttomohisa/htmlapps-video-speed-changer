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
$CacheRoot = Join-Path $Root ".cache\ffmpeg-release-pin"

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
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Release asset is missing $name." }
  }

  $manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $ExtractRoot "manifest.json") | ConvertFrom-Json
  if ([string]$manifest.profile -ne [string]$Config.profile) { throw "Release manifest profile mismatch." }
  if ([string]$manifest.builderVersion -ne [string]$Config.builderVersion) { throw "Release manifest Builder version mismatch." }
  if (-not $manifest.runtime.fileProtocolSingleHtml) { throw "Release runtime must support file:// single HTML." }
  if ($manifest.runtime.requiresSharedArrayBuffer) { throw "Release runtime must not require SharedArrayBuffer." }
  if ($manifest.runtime.requiresCrossOriginIsolation) { throw "Release runtime must not require cross-origin isolation." }

  $runtimeText = Get-Content -Raw -Encoding UTF8 (Join-Path $ExtractRoot "browser-ffmpeg.js")
  foreach ($marker in @("options.preservePitch === false", "options.signal", "videoSpeedChangerInspectArgs")) {
    if (-not $runtimeText.Contains($marker)) { throw "Release runtime is missing required marker: $marker" }
  }

  $jsBytes = Expand-GzipFileBytes (Join-Path $ExtractRoot "ffmpeg.js.gz")
  $jsText = [System.Text.Encoding]::UTF8.GetString($jsBytes)
  if (-not $jsText.Contains("createFFmpegCore")) { throw "Release ffmpeg.js.gz payload is invalid." }

  $wasmBytes = Expand-GzipFileBytes (Join-Path $ExtractRoot "ffmpeg.wasm.gz")
  if ($wasmBytes.Length -lt 8 -or $wasmBytes[0] -ne 0x00 -or $wasmBytes[1] -ne 0x61 -or $wasmBytes[2] -ne 0x73 -or $wasmBytes[3] -ne 0x6d) {
    throw "Release ffmpeg.wasm.gz does not expand to a valid WebAssembly module."
  }
}

$config = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
if ([int]$config.schemaVersion -ne 1) { throw "ffmpeg.release.json must use schemaVersion 1." }
foreach ($property in @("repository", "tag", "asset", "profile", "builderVersion")) {
  if ([string]::IsNullOrWhiteSpace([string]$config.$property)) { throw "ffmpeg.release.json is missing $property." }
}
if ([string]$config.profile -ne "video-speed-changer") { throw "Pinned profile must be video-speed-changer." }

$apiUrl = "https://api.github.com/repos/$($config.repository)/releases/tags/$($config.tag)"
Write-Host "[FFmpeg Release Pin] Reading $apiUrl" -ForegroundColor Cyan
$release = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing -Headers @{ "User-Agent" = "htmlapps-video-speed-changer-release-pin"; "Accept" = "application/vnd.github+json" }
if ([string]$release.tag_name -ne [string]$config.tag) { throw "GitHub release tag mismatch." }
$assets = @($release.assets)
$asset = @($assets | Where-Object { [string]$_.name -eq [string]$config.asset } | Select-Object -First 1)
if ($asset.Count -ne 1) { throw "Release asset '$($config.asset)' was not found in $($config.tag)." }
if ([string]::IsNullOrWhiteSpace([string]$asset.digest) -or [string]$asset.digest -notmatch '^sha256:[a-f0-9]{64}$') {
  throw "GitHub release asset does not expose a SHA-256 digest."
}
$expectedSha = ([string]$asset.digest).Substring(7).ToLowerInvariant()

New-Item -ItemType Directory -Force -Path $CacheRoot | Out-Null
$archivePath = Join-Path $CacheRoot ([string]$config.asset)
if ($ForceDownload -or -not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
  $partPath = "$archivePath.part"
  Remove-Item -Force -ErrorAction SilentlyContinue $partPath
  Write-Host "[FFmpeg Release Pin] Downloading $($asset.browser_download_url)" -ForegroundColor Cyan
  Invoke-WebRequest -Uri ([string]$asset.browser_download_url) -OutFile $partPath -UseBasicParsing -Headers @{ "User-Agent" = "htmlapps-video-speed-changer-release-pin" }
  Move-Item -Force $partPath $archivePath
}
$actualSha = Get-Sha256FileHex $archivePath
if ($actualSha -ne $expectedSha) { throw "Downloaded release SHA-256 mismatch. Expected $expectedSha, got $actualSha." }
if ([long](Get-Item $archivePath).Length -ne [long]$asset.size) { throw "Downloaded release size does not match GitHub metadata." }

$extractRoot = Join-Path $CacheRoot "verify"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $extractRoot
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($archivePath, $extractRoot)
Assert-ReleasePayload $extractRoot $config

$lock = [ordered]@{
  schemaVersion = 1
  repository = [string]$config.repository
  tag = [string]$config.tag
  asset = [string]$config.asset
  profile = [string]$config.profile
  builderVersion = [string]$config.builderVersion
  releaseId = [long]$release.id
  assetId = [long]$asset.id
  assetBytes = [long]$asset.size
  sha256 = $expectedSha
  browserDownloadUrl = [string]$asset.browser_download_url
  pinnedAtUtc = [DateTime]::UtcNow.ToString("o")
}
[System.IO.File]::WriteAllText($LockPath, ($lock | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[OK] Pinned $($config.tag) / $($config.asset)" -ForegroundColor Green
Write-Host "[OK] SHA-256: $expectedSha" -ForegroundColor Green
Write-Host "[OK] Lock: $LockPath" -ForegroundColor Green
