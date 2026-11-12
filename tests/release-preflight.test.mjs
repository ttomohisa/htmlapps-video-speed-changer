import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const preflight = path.join(root, '.github', 'scripts', 'release-preflight.ps1');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release-on-main.yml'), 'utf8');
const ps = process.env.PWSH || 'pwsh';
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const mock = [
  'function Invoke-WebRequest {',
  '  param([string]$Uri, $Headers, [switch]$SkipHttpErrorCheck, $ErrorAction)',
  '  if (-not $SkipHttpErrorCheck) { throw "Expected -SkipHttpErrorCheck" }',
  '  if ($Headers.Authorization -ne "Bearer $env:GH_TOKEN") { throw "Missing GitHub API auth" }',
  '  if ($Uri -like "*/git/ref/tags/*") {',
  '    if ($env:MOCK_TAG -eq "error") { return @{StatusCode=403; Content="{""message"":""Forbidden""}"} }',
  '    if ($env:MOCK_TAG -eq "missing") { return @{StatusCode=404; Content="{""message"":""Not Found""}"} }',
  '    $sha = if ($env:MOCK_TAG -eq "same") { $env:GITHUB_SHA } else { "0" * 40 }',
  '    return @{StatusCode=200; Content=(@{object=@{sha=$sha}} | ConvertTo-Json -Compress)}',
  '  }',
  '  if ($Uri -like "*/releases/tags/*") {',
  '    if ($env:MOCK_RELEASE -eq "missing") { return @{StatusCode=404; Content="{""message"":""Not Found""}"} }',
  '    return @{StatusCode=200; Content="{""id"":123}"}',
  '  }',
  '  throw "Unexpected GitHub API URI: $Uri"',
  '}'
].join('\n');

function runCase(tagState, releaseState) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'release-preflight-'));
  const output = path.join(directory, 'outputs.txt');
  const result = spawnSync(ps, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
    mock + '\n& ' + quote(preflight)], {
    encoding: 'utf8',
    env: {...process.env, GH_TOKEN:'test-token', GITHUB_REPOSITORY:'ttomohisa/htmlapps-video-speed-changer',
      GITHUB_SHA:'a'.repeat(40), GITHUB_OUTPUT:output, MOCK_TAG:tagState, MOCK_RELEASE:releaseState}
  });
  const text = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
  fs.rmSync(directory, {recursive:true, force:true});
  return {result, values:Object.fromEntries(text.trim().split(/\r?\n/).filter(Boolean).map(line=>line.split('=')))};
}

test('Release workflow handles missing tags in a separate HTTP 404-safe preflight', () => {
  assert.match(workflow, /run: \.\/\.github\/scripts\/release-preflight\.ps1/);
  assert.match(workflow, /steps\.version\.outputs\.tag_exists/);
  assert.doesNotMatch(workflow, /gh api "[^"]*git\/ref\/tags\//);
  assert.match(workflow, /gh release create/);
});

for (const [name, tag, release, publish, tagExists] of [
  ['missing tag and release', 'missing', 'missing', 'true', 'false'],
  ['matching tag without release', 'same', 'missing', 'true', 'true'],
  ['published tag and release', 'same', 'present', 'false', null],
  ['foreign tag is not moved', 'other', 'missing', 'false', null],
  ['release already exists', 'missing', 'present', 'false', null]
]) {
  test('Release preflight: ' + name, () => {
    const {result, values} = runCase(tag, release);
    assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
    assert.equal(values.publish, publish);
    if (publish === 'true') { assert.equal(values.tag, 'v1.1.2'); assert.equal(values.tag_exists, tagExists); }
  });
}

test('Release preflight fails closed on GitHub API HTTP 403', () => {
  const {result} = runCase('error', 'missing');
  assert.notEqual(result.status, 0, 'HTTP 403 is not a missing tag');
  assert.match(result.stderr || result.stdout, /HTTP 403/);
});
