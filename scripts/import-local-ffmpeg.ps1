param([Parameter(Mandatory=$true)][string]$BuilderRoot,[ValidateSet('all','single-thread','multi-thread')][string]$Variant='all')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'ffmpeg-release-tools.ps1')
$BuilderRoot=[System.IO.Path]::GetFullPath($BuilderRoot)
$config=Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'ffmpeg.release.json')|ConvertFrom-Json
$variants=if($Variant -eq 'all'){@('single-thread','multi-thread')}else{@($Variant)}
foreach($threading in $variants){
  $source=Join-Path $BuilderRoot "dist/video-speed-changer/$threading"
  # Builder keeps its shared runtime outside the per-profile core output.
  $stage=Join-Path $Root ".cache/local-ffmpeg/$threading"
  New-Item -ItemType Directory -Force -Path $stage|Out-Null
  foreach($name in @('ffmpeg.js','ffmpeg.wasm','ffmpeg.js.gz','ffmpeg.wasm.gz','manifest.json')){Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $stage $name) -Force}
  Copy-Item -LiteralPath (Join-Path $BuilderRoot 'runtime/browser-ffmpeg.js') -Destination (Join-Path $stage 'browser-ffmpeg.js') -Force
  $manifest=Assert-ReleasePayload $stage $config $threading
  $vendor=Join-Path $Root "vendor/ffmpeg/$threading"
  New-Item -ItemType Directory -Force -Path $vendor|Out-Null
  Copy-Item (Join-Path $stage '*') -Destination $vendor -Force
  $provenance=[ordered]@{schemaVersion=2;sourceType='local-builder';profile=[string]$manifest.profile;builderVersion=[string]$manifest.builderVersion;threading=$threading;manifestSha256=(Get-Sha256FileHex (Join-Path $stage 'manifest.json'))}
  [System.IO.File]::WriteAllText((Join-Path $vendor 'provenance.json'),($provenance|ConvertTo-Json -Depth 10),(New-Object System.Text.UTF8Encoding($false)))
  Write-Host "[OK] Imported $threading local Builder development runtime (not releasable)."
}
