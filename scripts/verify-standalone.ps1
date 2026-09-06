param(
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [bool]$RequireNetworkBlock = $true,
  [string[]]$ForbiddenPlaceholders = @(
    "__APP_CONFIG_JSON__",
    "__BUILD_MANIFEST_JSON__",
    "__EMBEDDED_ASSET_BUNDLE_JSON__",
    "__FFMPEG_JS_GZIP_BASE64__",
    "__FFMPEG_WASM_GZIP_BASE64__",
    "__FFMPEG_BROWSER_RUNTIME__"
  )
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path $Path)) { throw "HTML file not found: $Path" }
$html = Get-Content -Raw -Encoding UTF8 $Path

function Expand-GzipBytes([byte[]]$Bytes) {
  $input = New-Object System.IO.MemoryStream -ArgumentList (, $Bytes)
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

function Get-EmbeddedScriptBase64([string]$Html, [string]$Id) {
  $match = [regex]::Match(
    $Html,
    ('<script\s+id=["'']' + [regex]::Escape($Id) + '["'']\s+type=["'']application/octet-stream["'']>(?<payload>[A-Za-z0-9+/=\r\n]+)</script>'),
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if (-not $match.Success) { return $null }
  return ($match.Groups["payload"].Value -replace '\s+', '')
}

$checks = @(
  @{ Message = "HTML document marker is missing"; Failed = -not $html.TrimStart().StartsWith("<!doctype html>", [StringComparison]::OrdinalIgnoreCase) },
  @{ Message = "Viewport metadata is missing"; Failed = $html -notmatch '<meta\s+name=["'']viewport["'']' },
  @{ Message = "An external script URL remains"; Failed = $html -match '<script[^>]+src\s*=\s*["'']https?://' },
  @{ Message = "An external stylesheet URL remains"; Failed = $html -match '<link[^>]+href\s*=\s*["'']https?://' },
  @{ Message = "An external frame URL remains"; Failed = $html -match '<(?:iframe|frame)[^>]+src\s*=\s*["'']https?://' },
  @{ Message = "An external image/media URL remains"; Failed = $html -match '<(?:img|video|audio|source)[^>]+(?:src|poster)\s*=\s*["'']https?://' },
  @{ Message = "An external object URL remains"; Failed = $html -match '<object[^>]+data\s*=\s*["'']https?://' },
  @{ Message = "An external CSS url() remains"; Failed = $html -match 'url\(\s*["'']?https?://' },
  @{ Message = "An external CSS import remains"; Failed = $html -match '@import\s+(?:url\()?\s*["'']?https?://' },
  @{ Message = "An external module import remains"; Failed = $html -match '(?:import\s+.+?from\s*|import\s*\()\s*["'']https?://' },
  @{ Message = "Embedded favicon is missing"; Failed = $html -notmatch '<link\b[^>]*\brel\s*=\s*["''][^"'']*\bicon\b[^"'']*["''][^>]*\bhref\s*=\s*["'']data:image/svg\+xml' -and $html -notmatch '<link\b[^>]*\bhref\s*=\s*["'']data:image/svg\+xml[^"'']*["''][^>]*\brel\s*=\s*["''][^"'']*\bicon\b' }
)

foreach ($placeholder in @($ForbiddenPlaceholders)) {
  if ([string]::IsNullOrWhiteSpace([string]$placeholder)) { continue }
  if ($html.Contains([string]$placeholder)) {
    throw "Build placeholder remains: $placeholder"
  }
}

if ($RequireNetworkBlock -and $html -notmatch "connect-src\s+'none'") {
  throw "connect-src 'none' is missing from Content Security Policy"
}

if ($RequireNetworkBlock) {
  foreach ($directive in @("object-src 'none'", "frame-src 'none'", "base-uri 'none'", "form-action 'none'")) {
    if (-not $html.Contains($directive)) { throw "$directive is missing from Content Security Policy" }
  }
}
if ($html -match '__FFMPEG_BROWSER_RUNTIME__|BrowserFFmpeg|ffmpeg-wasm-gzip') {
  if ($html -notmatch "worker-src[^;]*blob:") { throw "worker-src blob: is missing for the embedded FFmpeg Worker" }
  if ($html -notmatch "media-src[^;]*blob:") { throw "media-src blob: is missing for local video previews" }
}

if ($html -match '__FFMPEG_BROWSER_RUNTIME__|BrowserFFmpeg|ffmpeg-wasm-gzip' -and $html -notmatch "script-src[^;]*'wasm-unsafe-eval'") {
  throw "'wasm-unsafe-eval' is missing from Content Security Policy for the embedded FFmpeg WASM core"
}

$ffmpegJsBase64 = Get-EmbeddedScriptBase64 $html "ffmpeg-js-gzip"
$ffmpegWasmBase64 = Get-EmbeddedScriptBase64 $html "ffmpeg-wasm-gzip"
if (($null -ne $ffmpegJsBase64) -xor ($null -ne $ffmpegWasmBase64)) {
  throw "Embedded FFmpeg JS/WASM gzip payloads must be present together."
}
if ($null -ne $ffmpegJsBase64) {
  try { $jsCompressed = [Convert]::FromBase64String($ffmpegJsBase64) } catch { throw "Embedded FFmpeg JS payload is not valid Base64." }
  try { $wasmCompressed = [Convert]::FromBase64String($ffmpegWasmBase64) } catch { throw "Embedded FFmpeg WASM payload is not valid Base64." }
  $jsBytes = Expand-GzipBytes $jsCompressed
  $wasmBytes = Expand-GzipBytes $wasmCompressed
  $jsText = [System.Text.Encoding]::UTF8.GetString($jsBytes)
  if (-not $jsText.Contains("createFFmpegCore")) { throw "Embedded FFmpeg JS payload does not contain createFFmpegCore." }
  if ($wasmBytes.Length -lt 8 -or $wasmBytes[0] -ne 0x00 -or $wasmBytes[1] -ne 0x61 -or $wasmBytes[2] -ne 0x73 -or $wasmBytes[3] -ne 0x6d) {
    throw "Embedded FFmpeg WASM payload is not a valid WebAssembly module."
  }
}

foreach ($check in $checks) {
  if ($check.Failed) { throw $check.Message }
}

Write-Host "[OK] Standalone verification passed: $Path" -ForegroundColor Green
