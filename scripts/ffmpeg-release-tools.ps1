# Shared fail-closed validation for official release pins and local development.
Set-StrictMode -Version Latest
function Get-Sha256Bytes([byte[]]$Bytes) {
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try { return (($algorithm.ComputeHash($Bytes) | ForEach-Object { $_.ToString('x2') }) -join '') }
  finally { $algorithm.Dispose() }
}
function Get-Sha256FileHex([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try { return (($algorithm.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) -join '') }
  finally { $algorithm.Dispose(); $stream.Dispose() }
}
function Expand-GzipFileBytes([string]$Path) {
  $input = [System.IO.File]::OpenRead($Path)
  $output = New-Object System.IO.MemoryStream
  try {
    $gzip = New-Object System.IO.Compression.GZipStream -ArgumentList $input, ([System.IO.Compression.CompressionMode]::Decompress)
    try { $gzip.CopyTo($output) } finally { $gzip.Dispose() }
    return ,$output.ToArray()
  } finally { $output.Dispose(); $input.Dispose() }
}
function Assert-ReleaseConfig($Config) {
  if ([int]$Config.schemaVersion -ne 2) { throw 'FFmpeg release configuration must use schemaVersion 2.' }
  if ([string]$Config.repository -ne 'ttomohisa/htmlapps-ffmpeg-wasm-builder') { throw 'Unexpected Builder repository.' }
  if ([string]$Config.profile -ne 'video-speed-changer') { throw 'Unexpected Builder profile.' }
  if ([string]$Config.builderVersion -notmatch '^\d+\.\d+\.\d+$' -or [string]$Config.tag -ne ('v' + [string]$Config.builderVersion)) { throw 'Builder tag/version mismatch.' }
  if (@($Config.variants.PSObject.Properties).Count -ne 2) { throw 'Exactly two threading variants are required.' }
  foreach ($variant in @('single-thread', 'multi-thread')) {
    if ([string]$Config.variants.$variant.asset -ne "ffmpeg-wasm-video-speed-changer-$variant-$($Config.tag).zip") { throw "Dedicated release asset mismatch for $variant." }
  }
}
function Assert-ReleaseLock($Config, $Lock) {
  Assert-ReleaseConfig $Config
  if ([int]$Lock.schemaVersion -ne 2) { throw 'FFmpeg release lock must use schemaVersion 2.' }
  foreach ($property in @('repository','tag','profile','builderVersion')) {
    if ([string]$Config.$property -ne [string]$Lock.$property) { throw "FFmpeg release lock mismatch for $property." }
  }
  if ([long]$Lock.releaseId -le 0) { throw 'FFmpeg release is not pinned: release ID is missing.' }
  if (@($Lock.variants.PSObject.Properties).Count -ne 2) { throw 'Both official release variants must be pinned atomically.' }
  foreach ($variant in @('single-thread','multi-thread')) {
    $entry = $Lock.variants.$variant
    if ([string]$entry.asset -ne [string]$Config.variants.$variant.asset) { throw "Asset lock mismatch for $variant." }
    if ([string]$entry.sha256 -notmatch '^[a-f0-9]{64}$' -or [long]$entry.assetId -le 0 -or [long]$entry.assetBytes -le 0) { throw "FFmpeg release is not pinned: incomplete $variant lock." }
    $expectedUrl = "https://github.com/$($Lock.repository)/releases/download/$($Lock.tag)/$($entry.asset)"
    if ([string]$entry.browserDownloadUrl -cne $expectedUrl) { throw "Unexpected official asset URL for $variant." }
  }
  if ([long]$Lock.variants.'single-thread'.assetId -eq [long]$Lock.variants.'multi-thread'.assetId) { throw 'ST and MT must reference distinct release assets.' }
}
function Assert-ReleasePayload([string]$ExtractRoot, $Config, [string]$Variant) {
  if ($Variant -notin @('single-thread','multi-thread')) { throw 'Unknown FFmpeg threading variant.' }
  foreach ($name in @('ffmpeg.js','ffmpeg.wasm','ffmpeg.js.gz','ffmpeg.wasm.gz','browser-ffmpeg.js','manifest.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $ExtractRoot $name) -PathType Leaf)) { throw "Release asset is missing $name." }
  }
  $manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $ExtractRoot 'manifest.json') | ConvertFrom-Json
  if ([int]$manifest.schemaVersion -ne 8) { throw 'Release manifest must use schemaVersion 8.' }
  if ([string]$manifest.profile -ne [string]$Config.profile) { throw 'Release manifest profile mismatch.' }
  if ([string]$manifest.builderVersion -ne [string]$Config.builderVersion) { throw 'Release manifest Builder version mismatch.' }
  if ([string]$manifest.runtime.threading -ne $Variant) { throw 'Release manifest threading mismatch.' }
  $mt = $Variant -eq 'multi-thread'
  if ($manifest.runtime.fileProtocolSingleHtml -isnot [bool] -or $manifest.runtime.fileProtocolSingleHtml -ne (-not $mt)) { throw 'Release fileProtocolSingleHtml mismatch.' }
  foreach ($property in @('requiresSharedArrayBuffer','requiresCrossOriginIsolation')) {
    if ($manifest.runtime.$property -isnot [bool] -or $manifest.runtime.$property -ne $mt) { throw "Release $property mismatch." }
  }
  foreach ($name in @('ffmpeg.js','ffmpeg.wasm')) {
    $rawPath = Join-Path $ExtractRoot $name
    $entry = $manifest.files.$name
    if ([long]$entry.bytes -le 0 -or [long]$entry.bytes -ne (Get-Item -LiteralPath $rawPath).Length) { throw "Release $name byte count mismatch." }
    if ([string]$entry.sha256 -notmatch '^[a-f0-9]{64}$' -or (Get-Sha256FileHex $rawPath) -ne [string]$entry.sha256) { throw "Release $name SHA-256 mismatch." }
    $gzName = "$name.gz"
    $gzPath = Join-Path $ExtractRoot $gzName
    if ([long]$manifest.files.$gzName.bytes -ne (Get-Item -LiteralPath $gzPath).Length) { throw "Release $gzName byte count mismatch." }
    $expanded = Expand-GzipFileBytes $gzPath
    if ($expanded.Length -ne [long]$entry.bytes -or (Get-Sha256Bytes $expanded) -ne [string]$entry.sha256) { throw "Release $gzName does not restore the verified raw file." }
  }
  $js = [System.IO.File]::ReadAllText((Join-Path $ExtractRoot 'ffmpeg.js'))
  if (-not $js.Contains('createFFmpegCore')) { throw 'Release FFmpeg JavaScript factory is missing.' }
  $wasm = [System.IO.File]::ReadAllBytes((Join-Path $ExtractRoot 'ffmpeg.wasm'))
  if ($wasm.Length -lt 8 -or $wasm[0] -ne 0 -or $wasm[1] -ne 97 -or $wasm[2] -ne 115 -or $wasm[3] -ne 109) { throw 'Release FFmpeg WebAssembly header is invalid.' }
  $runtime = [System.IO.File]::ReadAllText((Join-Path $ExtractRoot 'browser-ffmpeg.js'))
  foreach ($marker in @('options.preservePitch === false','options.signal','videoSpeedChangerInspectArgs')) {
    if (-not $runtime.Contains($marker)) { throw "Release runtime is missing required marker: $marker" }
  }
  return $manifest
}
function Expand-VerifiedRelease([string]$ArchivePath, [string]$ExtractRoot) {
  # Always re-extract verified bytes; never trust a mutable prior cache extraction.
  if (Test-Path -LiteralPath $ExtractRoot) { Remove-Item -LiteralPath $ExtractRoot -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $ExtractRoot | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ArchivePath, $ExtractRoot)
}
