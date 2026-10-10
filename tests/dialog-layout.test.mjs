// CSS contracts complement native resize/keyboard/wheel checks; they do not perform layout.
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import test from 'node:test';
const input=new URL(process.env.VIDEO_SPEED_TEST_HTML||'src/index.template.html',new URL('../',import.meta.url));
let html=fs.readFileSync(input,'utf8');const payload=html.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/)?.[1];if(payload)html=gunzipSync(Buffer.from(payload.trim(),'base64')).toString('utf8');
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
function rule(selector){const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const found=css.match(new RegExp(escaped+'\\s*\\{([^}]+)\\}'));assert.ok(found,`Missing ${selector}`);return found[1];}
test('Only open native modal dialogs lock both root and body background scrolling',()=>{
  assert.match(rule('html:has(dialog:modal),body:has(dialog:modal)'),/overflow\s*:\s*hidden/);
});
test('Existing Help shell retains its fixed header and shrinkable inner scroll body',()=>{
  assert.match(rule('#helpDialog[open]'),/display\s*:\s*flex/);assert.match(rule('#helpDialog[open]'),/flex-direction\s*:\s*column/);
  assert.match(rule('.dialog-header'),/flex\s*:\s*0 0 auto/);assert.match(rule('.dialog-body'),/min-height\s*:\s*0/);assert.match(rule('.dialog-body'),/overflow-y\s*:\s*auto/);
});
test('Existing decorative shield precedes truthful local-processing labels',()=>{
  const badge=html.match(/<div class="local-badge">([\s\S]*?)<\/div>/)[1];assert.match(badge,/<svg[^>]*aria-hidden="true"/);assert.match(badge,/M12 3 5 6v5/);assert.ok(badge.indexOf('<svg')<badge.indexOf('data-i18n="localBadge"'));assert.ok(html.includes('Fully local processing'));assert.ok(html.includes('完全ローカル処理'));
});
test('Narrow English header keeps its title and version visible without shrinking actions',()=>{
  const narrow=css.slice(css.indexOf('@media (max-width: 420px)'));
  const brand=narrow.match(/\.brand-name\s*\{([^}]+)\}/)?.[1]||'';
  const version=narrow.match(/\.version-badge\s*\{([^}]+)\}/)?.[1]||'';
  const actions=narrow.match(/\.header-actions\s*\{([^}]+)\}/)?.[1]||'';
  assert.match(brand,/display\s*:\s*flex/);assert.match(brand,/flex-wrap\s*:\s*wrap/);assert.match(brand,/white-space\s*:\s*normal/);assert.match(brand,/overflow\s*:\s*visible/);
  assert.match(version,/flex\s*:\s*0 0 auto/);assert.match(version,/margin-left\s*:\s*0/);assert.match(actions,/flex-shrink\s*:\s*0/);
});
