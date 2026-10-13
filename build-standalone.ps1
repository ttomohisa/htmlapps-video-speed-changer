param(
  [switch]$ForceDownload,
  [switch]$SkipSelfExtract,
  [switch]$UseLocalFfmpeg,
  [string]$OutputPath = "",
  [ValidateSet("all", "single-thread", "multi-thread")][string]$Variant = "all"
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = $PSScriptRoot
$customOutput = -not [string]::IsNullOrWhiteSpace($OutputPath)
# Preserve the original custom OutputPath behavior: default to ST only.
if ($customOutput -and $Variant -eq "all") {
  if ($PSBoundParameters.ContainsKey("Variant")) { throw "A custom OutputPath requires one variant, not all." }
  $Variant = "single-thread"
}
if (-not $UseLocalFfmpeg) {
  & (Join-Path $Root "scripts/import-release-ffmpeg.ps1") -Variant $Variant -ForceDownload:$ForceDownload
}
$variants = if ($Variant -eq "all") { @("single-thread", "multi-thread") } else { @($Variant) }
foreach ($threading in $variants) {
  & (Join-Path $Root "scripts/build-variant.ps1") -Variant $threading -OutputPath $OutputPath -UseLocalFfmpeg:$UseLocalFfmpeg -SkipSelfExtract:$SkipSelfExtract -ForceDownload:$ForceDownload
}
