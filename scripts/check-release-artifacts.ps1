param([string]$DistRoot='', [ValidateSet('all','single-thread','multi-thread')][string]$Variant='all')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'ffmpeg-release-tools.ps1')
if([string]::IsNullOrWhiteSpace($DistRoot)){$DistRoot=Join-Path $Root 'dist'}
if(-not [System.IO.Path]::IsPathRooted($DistRoot)){$DistRoot=Join-Path $Root $DistRoot}
$app=Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'app.config.json')|ConvertFrom-Json
$config=Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'ffmpeg.release.json')|ConvertFrom-Json
$lock=Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'ffmpeg.release.lock.json')|ConvertFrom-Json
Assert-ReleaseLock $config $lock
$variants=if($Variant -eq 'all'){@('single-thread','multi-thread')}else{@($Variant)}
foreach($threading in $variants){
  $suffix=if($threading -eq 'multi-thread'){'.mt'}else{''}
  $readable=Join-Path $DistRoot "index$suffix.html"
  $selfExtract=Join-Path $DistRoot "index$suffix.self-extract.html"
  $manifestPath=Join-Path $DistRoot "dependency-manifest$suffix.json"
  $sizePath=Join-Path $DistRoot "build-size-report$suffix.json"
  foreach($path in @($readable,$selfExtract,$manifestPath,$sizePath,(Join-Path $DistRoot "self-extract-manifest$suffix.json"),(Join-Path $DistRoot '.nojekyll'))){if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw "Required release artifact missing: $path"}}
  & (Join-Path $PSScriptRoot 'verify-standalone.ps1') -Path $readable -RequireNetworkBlock ([bool]$app.build.blockRuntimeNetwork)
  & (Join-Path $PSScriptRoot 'verify-self-extract.ps1') -Path $selfExtract -ExpectedSourcePath $readable
  $manifest=Get-Content -Raw -Encoding UTF8 $manifestPath|ConvertFrom-Json
  if([string]$manifest.app.slug -ne [string]$app.slug -or [string]$manifest.app.version -ne [string]$app.version){throw 'Artifact app identity mismatch.'}
  $ffmpeg=$manifest.embeddedRuntime.ffmpeg
  if([string]$ffmpeg.profile -ne [string]$config.profile -or [string]$ffmpeg.builderVersion -ne [string]$config.builderVersion -or [string]$ffmpeg.threading -ne $threading){throw 'Artifact runtime identity mismatch.'}
  $mt=$threading -eq 'multi-thread'
  if($ffmpeg.fileProtocolSingleHtml -ne (-not $mt) -or $ffmpeg.requiresSharedArrayBuffer -ne $mt -or $ffmpeg.requiresCrossOriginIsolation -ne $mt){throw 'Artifact threading requirements mismatch.'}
  if([string]$ffmpeg.source.type -ne 'github-release'){throw 'Release artifact must use github-release provenance, not local-builder.'}
  $entry=$lock.variants.$threading
  foreach($property in @('repository','tag','releaseId')){if([string]$ffmpeg.source.$property -ne [string]$lock.$property){throw "Artifact source $property mismatch."}}
  foreach($property in @('asset','assetId','assetBytes')){if([string]$ffmpeg.source.$property -ne [string]$entry.$property){throw "Artifact source $property mismatch."}}
  if([string]$ffmpeg.source.assetSha256 -ne [string]$entry.sha256){throw 'Artifact source SHA-256 mismatch.'}
  foreach($name in @('ffmpeg.js.gz','ffmpeg.wasm.gz','browser-ffmpeg.js')){
    if([long]$ffmpeg.files.$name.bytes -le 0 -or [string]$ffmpeg.files.$name.sha256 -notmatch '^[a-f0-9]{64}$'){throw "Artifact file provenance is invalid: $name"}
  }
  $html=[System.IO.File]::ReadAllText($readable)
  $embedded=[regex]::Match($html,'const BUILD_MANIFEST = ([^\r\n]+);')
  if(-not $embedded.Success){throw 'Embedded build manifest is missing.'}
  $embeddedManifest=$embedded.Groups[1].Value|ConvertFrom-Json
  if(($embeddedManifest|ConvertTo-Json -Compress -Depth 50) -cne ($manifest|ConvertTo-Json -Compress -Depth 50)){throw 'Artifact manifest differs from the embedded manifest.'}
  $size=Get-Content -Raw -Encoding UTF8 $sizePath|ConvertFrom-Json
  if([long]$size.readableHtmlBytes -ne (Get-Item $readable).Length -or [long]$size.selfExtractHtmlBytes -ne (Get-Item $selfExtract).Length){throw 'Artifact build-size-report.json byte count mismatch.'}
  Write-Host "[OK] Verified $threading official release artifacts."
}
