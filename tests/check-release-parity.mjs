import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
function runtime(html) {
  const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  return script.replace(/(const (?:APP_CONFIG|BUILD_MANIFEST|assetBundle) = )[^\n]+/g, '$1__BUILD_VALUE__;').replace(/\r\n/g, '\n');
}
const source = read('src/index.template.html');
const download = read('video-speed-changer.html');
assert.equal(runtime(download), runtime(source), 'checked-in download must contain the source runtime');
const help = html => html.match(/<!-- APP:HELP:BEGIN -->([\s\S]*?)<!-- APP:HELP:END -->/)[1];
assert.equal(help(download), help(source), 'checked-in download must contain current help');
if (!process.argv.includes('--source-only')) {
  const readable = read('dist/index.html');
  const wrapper = read('dist/index.self-extract.html');
  const payload = wrapper.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(payload, 'self-extract gzip payload exists');
  assert.equal(gunzipSync(Buffer.from(payload.trim(), 'base64')).toString('utf8'), readable, 'self-extract payload restores readable HTML exactly');
  assert.equal(download, readable, 'root download matches the generated standalone byte-for-byte');
  assert.equal(runtime(readable), runtime(source), 'standalone contains the source runtime');
}
console.log('Video Speed Changer release parity passed.');
