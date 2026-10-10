import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const root=new URL('../',import.meta.url);
test('PowerShell preflight expects the current app package version',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('app.config.json',root),'utf8'));
  const preflight=fs.readFileSync(new URL('scripts/check-repository.ps1',root),'utf8');
  const version=preflight.match(/\$app\.version\s+-ne\s+"([^"]+)"/)?.[1];
  assert.equal(version,config.version);
});
