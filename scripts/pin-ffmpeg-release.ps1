param([switch]$ForceDownload)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'ffmpeg-release-tools.ps1')
$ConfigPath = Join-Path $Root 'ffmpeg.release.json'
$LockPath = Join-Path $Root 'ffmpeg.release.lock.json'
$CacheRoot = Join-Path $Root '.cache/ffmpeg-release-pin'
$config = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
Assert-ReleaseConfig $config
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$($config.repository)/releases/tags/$($config.tag)" -UseBasicParsing -Headers @{ 'User-Agent'='htmlapps-video-speed-changer-release-pin'; 'Accept'='application/vnd.github+json' }
if ($release.draft -ne $false -or $release.prerelease -ne $false) { throw 'Only published stable official releases can be pinned.' }
if ([string]$release.tag_name -ne [string]$config.tag -or [long]$release.id -le 0) { throw 'Official release tag/ID mismatch.' }
$lock = [ordered]@{ schemaVersion=2; repository=[string]$config.repository; tag=[string]$config.tag; profile=[string]$config.profile; builderVersion=[string]$config.builderVersion; releaseId=[long]$release.id; variants=[ordered]@{}; pinnedAtUtc=[DateTime]::UtcNow.ToString('o') }
New-Item -ItemType Directory -Force -Path $CacheRoot | Out-Null
foreach ($variant in @('single-thread','multi-thread')) {
  $name = [string]$config.variants.$variant.asset
  $matches = @($release.assets | Where-Object { [string]$_.name -ceq $name })
  if ($matches.Count -ne 1) { throw "Expected exactly one official $name asset." }
  $asset = $matches[0]
  if ([string]$asset.digest -notmatch '^sha256:[a-f0-9]{64}$' -or [long]$asset.id -le 0 -or [long]$asset.size -le 0) { throw "Official $variant asset has incomplete digest/ID/size metadata." }
  $expectedUrl = "https://github.com/$($config.repository)/releases/download/$($config.tag)/$name"
  if ([string]$asset.browser_download_url -cne $expectedUrl) { throw 'Official download URL mismatch.' }
  $sha = ([string]$asset.digest).Substring(7)
  $archive = Join-Path $CacheRoot $name
  if ($ForceDownload -or -not (Test-Path -LiteralPath $archive)) {
    Invoke-WebRequest -Uri $expectedUrl -OutFile "$archive.part" -UseBasicParsing
    Move-Item -Force "$archive.part" $archive
  }
  if ((Get-Sha256FileHex $archive) -ne $sha -or (Get-Item -LiteralPath $archive).Length -ne [long]$asset.size) { throw "Official $variant download SHA-256/size mismatch." }
  $extract = Join-Path $CacheRoot $variant
  Expand-VerifiedRelease $archive $extract
  $null = Assert-ReleasePayload $extract $config $variant
  $lock.variants[$variant] = [ordered]@{asset=$name;assetId=[long]$asset.id;assetBytes=[long]$asset.size;sha256=$sha;browserDownloadUrl=$expectedUrl}
}
# No lock is modified until BOTH independently verified official assets pass.
$lockJson = $lock | ConvertTo-Json -Depth 20
Assert-ReleaseLock $config ($lockJson | ConvertFrom-Json)
$tempLock = "$LockPath.part"
[System.IO.File]::WriteAllText($tempLock, $lockJson, (New-Object System.Text.UTF8Encoding($false)))
Move-Item -LiteralPath $tempLock -Destination $LockPath -Force
Write-Host "[OK] Atomically pinned both official $($config.tag) threading variants."
