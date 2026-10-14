import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
let html=fs.readFileSync(new URL(process.env.VIDEO_SPEED_TEST_HTML||'src/index.template.html',new URL('../',import.meta.url)),'utf8');
const payload=html.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/)?.[1];
if(payload) html=gunzipSync(Buffer.from(payload.trim(),'base64')).toString('utf8');
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
// Parse only the actual workspace markup, never script strings or a DOM mock.
const workspace=html.slice(html.indexOf('<div class="ready-grid"'),html.indexOf('<input class="sr-only" id="videoInput"'));
function ancestors(id){
 const stack=[];
 for(const m of workspace.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)){
  const token=m[0],tag=m[1].toLowerCase();
  if(token.startsWith('</')){assert.equal(stack.pop()?.tag,tag,'balanced workspace markup');continue;}
  const ownId=token.match(/\bid="([^"]+)"/)?.[1];
  if(ownId===id)return stack.map(node=>node.id);
  if(!token.endsWith('/>')&&!['input','img','br','hr','source','path'].includes(tag))stack.push({tag,id:ownId});
 }
 throw new Error(`Missing ${id}`);
}
test('Converted result is a separate workspace region outside the settings column',()=>{
 assert.deepEqual(ancestors('convertResult'),['readyView']);
 assert.deepEqual(ancestors('resultPreview'),['readyView','convertResult',undefined]);
 assert.match(workspace,/<section[^>]*id="convertResult"[^>]*aria-labelledby="resultPreviewTitle"/);
});
test('Desktop places the converted result under the source and keeps settings separate',()=>{
 assert.match(css,/grid-template-areas:\s*"source settings"\s*"result settings"/);
 for(const [selector,area]of [['preview-pane','source'],['info-pane','settings'],['convert-result','result']])assert.match(css,new RegExp('\\.'+selector+'\\s*\\{[^}]*grid-area:\\s*'+area));
});
test('Narrow workflow keeps speed controls immediately after the source, followed by the result',()=>{
 const mobile=css.slice(css.indexOf('@media (max-width: 760px)'));
 assert.match(mobile,/grid-template-areas:\s*"source"\s*"settings"\s*"result"/);
});
test('Source and result have distinct visible bilingual titles and source replacement lives with the source',()=>{
 assert.match(html,/<h2[^>]*id="sourcePreviewTitle"[^>]*data-i18n="sourcePreviewTitle">元動画<\/h2>/);
 assert.match(html,/<h2[^>]*id="resultPreviewTitle"[^>]*tabindex="-1"[^>]*data-i18n="resultPreviewTitle">変換後の動画<\/h2>/);
 assert.match(html,/sourcePreviewTitle: 'Original video'/);assert.match(html,/resultPreviewTitle: 'Converted video'/);
 assert.ok(ancestors('replaceVideoButton').includes('sourcePreviewSection'));
 assert.equal(ancestors('speedInput').includes('sourcePreviewSection'),false);
});
test('Marked introduction sentence and duplicate preview explanation are removed in both languages',()=>{
 for(const text of ['目標時間から倍率を逆算することもできます。','変更した速度は左のプレビューへすぐ反映されます。','You can also calculate the required speed from a target duration.','Speed changes are applied to the preview immediately.'])assert.equal(html.includes(text),false,text);
});
