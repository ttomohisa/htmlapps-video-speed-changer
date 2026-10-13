import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
function runtime(html) {
  const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  return script.replace(/(const (?:APP_CONFIG|BUILD_MANIFEST|assetBundle) = )[^\n]+/g, '$1__BUILD_VALUE__;').replace(/\r\n/g, '\n');
}
const source=read('src/index.template.html');
const help=html=>html.match(/<!-- APP:HELP:BEGIN -->([\s\S]*?)<!-- APP:HELP:END -->/)[1];
for(const suffix of ['', '.mt']){
  const download=read(`video-speed-changer${suffix}.html`);
  assert.equal(runtime(download),runtime(source),`${suffix||'ST'} checked-in download contains the source runtime`);
  assert.equal(help(download),help(source),'checked-in download contains current help');
  if(!process.argv.includes('--source-only')){
    const readable=read(`dist/index${suffix}.html`);
    const wrapper=read(`dist/index${suffix}.self-extract.html`);
    const payload=wrapper.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(payload);assert.equal(gunzipSync(Buffer.from(payload.trim(),'base64')).toString('utf8'),readable);
    assert.equal(download,readable);assert.equal(runtime(readable),runtime(source));
    const manifest=JSON.parse(read(`dist/dependency-manifest${suffix}.json`));
    assert.equal(manifest.embeddedRuntime.ffmpeg.threading,suffix?'multi-thread':'single-thread');
  }
}
console.log('Video Speed Changer ST/MT release parity passed.');
