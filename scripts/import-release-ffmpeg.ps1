param([switch]$ForceDownload, [ValidateSet('all','single-thread','multi-thread')][string]$Variant='all')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$Root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'ffmpeg-release-tools.ps1')
$config=Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'ffmpeg.release.json')|ConvertFrom-Json
$lock=Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'ffmpeg.release.lock.json')|ConvertFrom-Json
Assert-ReleaseLock $config $lock
$CacheRoot=Join-Path $Root '.cache/ffmpeg-release'
New-Item -ItemType Directory -Force -Path $CacheRoot|Out-Null
$variants=if($Variant -eq 'all'){@('single-thread','multi-thread')}else{@($Variant)}
foreach($threading in $variants){
  $entry=$lock.variants.$threading
  $archive=Join-Path $CacheRoot "$($entry.sha256).zip"
  if($ForceDownload -or -not(Test-Path -LiteralPath $archive)){
    Invoke-WebRequest -Uri ([string]$entry.browserDownloadUrl) -OutFile "$archive.part" -UseBasicParsing
    Move-Item -Force "$archive.part" $archive
  }
  if((Get-Sha256FileHex $archive) -ne [string]$entry.sha256 -or (Get-Item -LiteralPath $archive).Length -ne [long]$entry.assetBytes){throw "Pinned FFmpeg release SHA-256/size mismatch for $threading."}
  $extract=Join-Path $CacheRoot "extract-$($entry.sha256)"
  Expand-VerifiedRelease $archive $extract
  $manifest=Assert-ReleasePayload $extract $config $threading
  $vendor=Join-Path $Root "vendor/ffmpeg/$threading"
  New-Item -ItemType Directory -Force -Path $vendor|Out-Null
  foreach($name in @('ffmpeg.js','ffmpeg.wasm','ffmpeg.js.gz','ffmpeg.wasm.gz','browser-ffmpeg.js','manifest.json')){Copy-Item -LiteralPath (Join-Path $extract $name) -Destination (Join-Path $vendor $name) -Force}
  $provenance=[ordered]@{schemaVersion=2;sourceType='github-release';repository=[string]$lock.repository;tag=[string]$lock.tag;asset=[string]$entry.asset;releaseId=[long]$lock.releaseId;assetId=[long]$entry.assetId;assetBytes=[long]$entry.assetBytes;assetSha256=[string]$entry.sha256;profile=[string]$manifest.profile;builderVersion=[string]$manifest.builderVersion;threading=$threading}
  [System.IO.File]::WriteAllText((Join-Path $vendor 'provenance.json'),($provenance|ConvertTo-Json -Depth 10),(New-Object System.Text.UTF8Encoding($false)))
  Write-Host "[OK] Imported pinned $threading / $($lock.tag)."
}
