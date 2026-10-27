import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
const root = fileURLToPath(new URL('../', import.meta.url));
const toolsPath = path.join(root, 'scripts/ffmpeg-release-tools.ps1');
const pwsh = process.env.PWSH || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
const hash = b => createHash('sha256').update(b).digest('hex');
const q = value => `'${value.replaceAll("'", "''")}'`;
function invoke(command) { return spawnSync(pwsh, ['-NoLogo','-NoProfile','-Command', `$ErrorActionPreference='Stop'; . ${q(toolsPath)}; ${command}`], {encoding:'utf8', env:process.env}); }
function fixture(variant) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speed-runtime-'));
  const mt = variant === 'multi-thread';
  const raw = {'ffmpeg.js':Buffer.from('function createFFmpegCore(){}'),'ffmpeg.wasm':Buffer.from([0,97,115,109,1,0,0,0])};
  const files = {};
  for (const [name, bytes] of Object.entries(raw)) { fs.writeFileSync(path.join(dir,name),bytes); files[name]={bytes:bytes.length,sha256:hash(bytes)}; const gz=gzipSync(bytes); fs.writeFileSync(path.join(dir,name+'.gz'),gz); files[name+'.gz']={bytes:gz.length}; }
  fs.writeFileSync(path.join(dir,'browser-ffmpeg.js'),'options.preservePitch === false; options.signal; videoSpeedChangerInspectArgs');
  const manifest = {schemaVersion:8,builderVersion:'1.10.6',profile:'video-speed-changer',runtime:{threading:variant,fileProtocolSingleHtml:!mt,requiresSharedArrayBuffer:mt,requiresCrossOriginIsolation:mt},files};
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest));
  return {dir,manifest};
}
function validate(dir,variant) {return invoke(`$c=Get-Content -Raw ${q(path.join(root,'ffmpeg.release.json'))}|ConvertFrom-Json; Assert-ReleasePayload ${q(dir)} $c ${q(variant)} | Out-Null`);}
test('dedicated ST and MT release configuration uses the shared schema 2 pin',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,'ffmpeg.release.json')));
  assert.equal(config.schemaVersion,2); assert.equal(config.tag,'v1.10.6');
  for(const variant of ['single-thread','multi-thread']) assert.equal(config.variants[variant].asset,`ffmpeg-wasm-video-speed-changer-${variant}-v1.10.6.zip`);
});
test('release payload validation is shared by pinning, import, and builds',()=>{
  assert.ok(fs.existsSync(toolsPath),'shared release verifier must exist');
  for(const name of ['pin-ffmpeg-release.ps1','import-release-ffmpeg.ps1','build-variant.ps1']) assert.match(fs.readFileSync(path.join(root,'scripts',name),'utf8'),/ffmpeg-release-tools\.ps1/);
});
for (const variant of ['single-thread','multi-thread']) test(`validates ${variant} raw hashes, sizes, gzip equality and metadata`,()=>{
  assert.ok(fs.existsSync(toolsPath),'shared verifier must exist before validation');
  const {dir,manifest}=fixture(variant);
  try {
    const result=validate(dir,variant); assert.equal(result.status,0,result.stderr || result.error?.message);
    const mutations=[m=>m.profile='wrong',m=>m.builderVersion='1.10.5',m=>m.schemaVersion=7,m=>m.runtime.threading='wrong',m=>m.runtime.requiresSharedArrayBuffer=!m.runtime.requiresSharedArrayBuffer,m=>m.files['ffmpeg.js'].sha256='0'.repeat(64),m=>m.files['ffmpeg.wasm'].bytes++];
    for(const mutate of mutations){const wrong=structuredClone(manifest);mutate(wrong);fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(wrong));assert.notEqual(validate(dir,variant).status,0);}
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest));
    fs.writeFileSync(path.join(dir,'ffmpeg.js.gz'),gzipSync(Buffer.from('function createFFmpegCore(){return 1;}')));
    assert.notEqual(validate(dir,variant).status,0,'mismatched gzip must fail');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('official pin writes only after both validated assets, rejects draft/prerelease and uses atomic replacement',()=>{
  const source=fs.readFileSync(path.join(root,'scripts/pin-ffmpeg-release.ps1'),'utf8');
  assert.match(source,/\.draft/); assert.match(source,/\.prerelease/); assert.match(source,/Assert-ReleasePayload/); assert.match(source,/foreach.*single-thread.*multi-thread/);
  assert.match(source,/Move-Item.*\$LockPath/); assert.ok(source.lastIndexOf('Assert-ReleasePayload') < source.indexOf('WriteAllText'));
});
test('pin script preserves the previous lock if the second asset or official release metadata is invalid',()=>{
  const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'speed-pin-'));
  const fixtures=['single-thread','multi-thread'].map(fixture);
  try{
    fs.mkdirSync(path.join(sandbox,'scripts')); fs.mkdirSync(path.join(sandbox,'.cache/ffmpeg-release-pin'),{recursive:true});
    for(const name of ['ffmpeg-release-tools.ps1','pin-ffmpeg-release.ps1'])fs.copyFileSync(path.join(root,'scripts',name),path.join(sandbox,'scripts',name));
    const config=JSON.parse(fs.readFileSync(path.join(root,'ffmpeg.release.json')));
    fs.writeFileSync(path.join(sandbox,'ffmpeg.release.json'),JSON.stringify(config));
    const assets=[];
    for(let i=0;i<fixtures.length;i++){
      const variant=['single-thread','multi-thread'][i], dir=fixtures[i].dir, name=config.variants[variant].asset;
      const archive=path.join(sandbox,'.cache/ffmpeg-release-pin',name);
      const zip=invoke(`Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(${q(dir)},${q(archive)})`);
      assert.equal(zip.status,0,zip.stderr);
      const bytes=fs.readFileSync(archive);
      assets.push({name,id:i+10,size:bytes.length,digest:`sha256:${hash(bytes)}`,browser_download_url:`https://github.com/${config.repository}/releases/download/${config.tag}/${name}`});
    }
    const metadata={draft:false,prerelease:false,tag_name:config.tag,id:99,assets};
    const lockPath=path.join(sandbox,'ffmpeg.release.lock.json');
    const metadataPath=path.join(sandbox,'metadata.json');
    const run=()=>invoke(`function Invoke-RestMethod { Get-Content -Raw ${q(metadataPath)}|ConvertFrom-Json }; function Invoke-WebRequest { throw 'Fixture must not download' }; & ${q(path.join(sandbox,'scripts/pin-ffmpeg-release.ps1'))}`);
    for(const mutate of [m=>m.draft=true,m=>m.prerelease=true,m=>m.assets[1].digest='sha256:'+'0'.repeat(64),m=>m.assets[1].size++,m=>m.assets.pop()]){
      const invalid=structuredClone(metadata);mutate(invalid);fs.writeFileSync(metadataPath,JSON.stringify(invalid));fs.writeFileSync(lockPath,'previous-lock');
      const result=run();assert.notEqual(result.status,0,'invalid official asset/release must fail');assert.equal(fs.readFileSync(lockPath,'utf8'),'previous-lock');
    }
    fs.writeFileSync(metadataPath,JSON.stringify(metadata));const good=run();assert.equal(good.status,0,good.stderr);
    const lock=JSON.parse(fs.readFileSync(lockPath));assert.equal(lock.releaseId,99);assert.equal(Object.keys(lock.variants).length,2);
    assert.equal(lock.variants['multi-thread'].assetId,11);
  }finally{fs.rmSync(sandbox,{recursive:true,force:true});for(const {dir}of fixtures)fs.rmSync(dir,{recursive:true,force:true});}
});
test('custom ST and MT builds preserve release aliases and write separate per-variant metadata',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'speed-custom-'));
  const before=['video-speed-changer.html','video-speed-changer.mt.html'].map(name=>hash(fs.readFileSync(path.join(root,name))));
  try{
    for(const variant of ['single-thread','multi-thread']){
      const output=path.join(temp,variant,'custom.html');
      const args=variant==='multi-thread'?"-Variant 'multi-thread'":'';
      const result=invoke(`& ${q(path.join(root,'build-standalone.ps1'))} -OutputPath ${q(output)} ${args}`);
      assert.equal(result.status,0,result.stderr);
      const suffix=variant==='multi-thread'?'.mt':'';
      const manifest=JSON.parse(fs.readFileSync(path.join(temp,variant,`dependency-manifest${suffix}.json`)));
      assert.equal(manifest.embeddedRuntime.ffmpeg.threading,variant);
      assert.ok(fs.existsSync(path.join(temp,variant,'custom.self-extract.html')));
      assert.ok(fs.existsSync(path.join(temp,variant,`self-extract-manifest${suffix}.json`)));
      assert.ok(fs.existsSync(path.join(temp,variant,`build-size-report${suffix}.json`)));
    }
    assert.deepEqual(['video-speed-changer.html','video-speed-changer.mt.html'].map(name=>hash(fs.readFileSync(path.join(root,name)))),before);
    const ambiguous=invoke(`& ${q(path.join(root,'build-standalone.ps1'))} -OutputPath ${q(path.join(temp,'ambiguous.html'))} -Variant all`);
    assert.notEqual(ambiguous.status,0);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('local Builder import builds both development editions but cannot pass release verification',()=>{
  const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'speed-local-'));
  const builder=path.join(sandbox,'builder');const app=path.join(sandbox,'app');
  const fixtures=['single-thread','multi-thread'].map(fixture);
  try{
    fs.mkdirSync(path.join(builder,'runtime'),{recursive:true});fs.mkdirSync(path.join(app,'src'),{recursive:true});fs.mkdirSync(path.join(app,'scripts'));
    for(const name of ['app.config.json','dependencies.json','dependencies.lock.json','ffmpeg.release.json','ffmpeg.release.lock.json','build-standalone.ps1'])fs.copyFileSync(path.join(root,name),path.join(app,name));
    fs.copyFileSync(path.join(root,'src/index.template.html'),path.join(app,'src/index.template.html'));
    fs.mkdirSync(path.join(app,'components'));for(const name of ['ui-conventions.js','ui-conventions.css','ui-conventions.lock.json'])fs.copyFileSync(path.join(root,'components',name),path.join(app,'components',name));
    for(const name of fs.readdirSync(path.join(root,'scripts')).filter(name=>name.endsWith('.ps1')))fs.copyFileSync(path.join(root,'scripts',name),path.join(app,'scripts',name));
    for(let i=0;i<fixtures.length;i++){
      const destination=path.join(builder,'dist/video-speed-changer',['single-thread','multi-thread'][i]);
      fs.mkdirSync(destination,{recursive:true});for(const name of fs.readdirSync(fixtures[i].dir))fs.copyFileSync(path.join(fixtures[i].dir,name),path.join(destination,name));
    }
    fs.copyFileSync(path.join(fixtures[0].dir,'browser-ffmpeg.js'),path.join(builder,'runtime/browser-ffmpeg.js'));
    const local=invoke(`& ${q(path.join(app,'scripts/import-local-ffmpeg.ps1'))} -BuilderRoot ${q(builder)}; & ${q(path.join(app,'build-standalone.ps1'))} -UseLocalFfmpeg`);
    assert.equal(local.status,0,local.stderr);
    for(const suffix of ['', '.mt'])assert.equal(JSON.parse(fs.readFileSync(path.join(app,`dist/dependency-manifest${suffix}.json`))).embeddedRuntime.ffmpeg.source.type,'local-builder');
    const rejected=invoke(`& ${q(path.join(app,'scripts/check-release-artifacts.ps1'))}`);
    assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/github-release provenance, not local-builder/);
  }finally{fs.rmSync(sandbox,{recursive:true,force:true});for(const{dir}of fixtures)fs.rmSync(dir,{recursive:true,force:true});}
});
