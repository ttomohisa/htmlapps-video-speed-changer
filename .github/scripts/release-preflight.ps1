# Read-only release preflight for on-main publish; missing tag/release is expected.
# This workflow runs under PowerShell 7; -SkipHttpErrorCheck gives an explicit 404.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) { throw 'GH_TOKEN is required.' }
if ([string]::IsNullOrWhiteSpace($env:GITHUB_REPOSITORY) -or [string]::IsNullOrWhiteSpace($env:GITHUB_SHA)) { throw 'GitHub workflow context is missing.' }
if ([string]::IsNullOrWhiteSpace($env:GITHUB_OUTPUT)) { throw 'GITHUB_OUTPUT is missing.' }

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$version = [string]((Get-Content -Raw -Encoding UTF8 (Join-Path $root 'app.config.json') | ConvertFrom-Json).version)
if ($version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+$') { throw "Invalid SemVer version: $version" }
$tag = "v$version"
$headers = @{
  Authorization = "Bearer $env:GH_TOKEN"
  Accept = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}

function Get-OptionalGitHubJson([string]$Path) {
  $uri = "https://api.github.com/repos/$env:GITHUB_REPOSITORY/$Path"
  $response = Invoke-WebRequest -Uri $uri -Headers $headers -SkipHttpErrorCheck -ErrorAction Stop
  $status = [int]$response.StatusCode
  if ($status -eq 404) { return $null }
  if ($status -ne 200) { throw "GitHub API HTTP $status while checking $Path" }
  return $response.Content | ConvertFrom-Json
}

$existingTag = Get-OptionalGitHubJson "git/ref/tags/$tag"
if ($null -ne $existingTag -and [string]$existingTag.object.sha -ne $env:GITHUB_SHA) {
  # Never move or silently overwrite a published version tag.
  Write-Host "Tag $tag belongs to another commit; skipping."
  'publish=false' | Out-File $env:GITHUB_OUTPUT -Append -Encoding utf8
  exit 0
}

$existingRelease = Get-OptionalGitHubJson "releases/tags/$tag"
if ($null -ne $existingRelease) {
  Write-Host "Release $tag is already published; skipping."
  'publish=false' | Out-File $env:GITHUB_OUTPUT -Append -Encoding utf8
  exit 0
}

'publish=true' | Out-File $env:GITHUB_OUTPUT -Append -Encoding utf8
"tag=$tag" | Out-File $env:GITHUB_OUTPUT -Append -Encoding utf8
"tag_exists=$($null -ne $existingTag)".ToLowerInvariant() | Out-File $env:GITHUB_OUTPUT -Append -Encoding utf8
Write-Host "Release $tag is missing; verified tag existence and authorized publication."
