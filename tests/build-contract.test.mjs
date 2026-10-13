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
test('app configuration declares both ST/MT paths in its strict schema',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('app.config.json',root),'utf8'));
  const schema=JSON.parse(fs.readFileSync(new URL('schemas/app-config.schema.json',root),'utf8'));
  function validateKnownKeys(value,shape,location){
    if(!value||typeof value!=='object'||Array.isArray(value))return;
    if(shape.additionalProperties===false)for(const key of Object.keys(value))assert.ok(shape.properties?.[key],`${location}.${key} must be declared in strict schema`);
    for(const[key,item]of Object.entries(value))if(shape.properties?.[key])validateKnownKeys(item,shape.properties[key],`${location}.${key}`);
  }
  validateKnownKeys(config,schema,'app');
  assert.equal(config.build.multiThreadOutput,'dist/index.mt.html');
  assert.equal(config.build.selfExtract.multiThreadOutput,'dist/index.mt.self-extract.html');
});
test('both size reports account for embedded FFmpeg core and runtime bytes',()=>{
  for(const suffix of ['', '.mt']){
    const report=JSON.parse(fs.readFileSync(new URL(`dist/build-size-report${suffix}.json`,root),'utf8'));
    assert.ok(report.embeddedAssetOriginalBytes>0,'FFmpeg raw payloads must be included in size review');
    assert.ok(report.embeddedAssetStoredBytes>0);
    assert.equal(report.assets.filter(asset=>asset.dependency==='ffmpeg').length,3);
  }
});
