import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedHash = '3dbd5b694cb879fd386405c2347e702362ebbf9ece984dd6f2ff79a99c1afedb';
const icon = fs.readFileSync(path.join(root, 'assets/favicon.svg'));
const expectedSvg = icon.toString('utf8').trim();
const sources = ['src/index.template.html', 'video-speed-changer.html', 'dist/index.html'];
const variants = sources.filter(file => fs.existsSync(path.join(root, file)))
  .map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]);
const selfExtractPath = path.join(root, 'dist/index.self-extract.html');
if (fs.existsSync(selfExtractPath)) {
  const loader = fs.readFileSync(selfExtractPath, 'utf8');
  const payload = loader.match(/<script[^>]+id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (payload) variants.push(['restored self-extract', gunzipSync(Buffer.from(payload.trim(), 'base64')).toString('utf8')]);
}

test('favicon asset preserves the supplied icon bytes', () => {
  assert.equal(createHash('sha256').update(icon).digest('hex'), expectedHash);
});
for (const [name, html] of variants) {
  test(`${name}: header and embedded favicon match the supplied artwork`, () => {
    const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0];
    const svg = header?.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
    assert.equal(svg, expectedSvg);
    const href = html.match(/<link\b[^>]*rel="icon"[^>]*href="([^"]+)"/)?.[1];
    assert.ok(href?.startsWith('data:image/svg+xml'), 'favicon stays embedded');
    const comma = href.indexOf(',');
    const bytes = href.slice(0, comma).endsWith(';base64')
      ? Buffer.from(href.slice(comma + 1), 'base64')
      : Buffer.from(decodeURIComponent(href.slice(comma + 1)), 'utf8');
    assert.deepEqual(bytes, icon);
    assert.match(svg, /viewBox="0 0 1095 1095"/);
    assert.match(html, /\.brand-mark\s+svg\s*\{\s*width:\s*100%;\s*height:\s*100%;/);
    assert.match(header, /class="brand-mark"[^>]*aria-hidden="true"/);
  });
}
