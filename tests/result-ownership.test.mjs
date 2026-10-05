import fs from 'node:fs';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the actual app script with synthetic media metadata, DOM elements, and an injected
// runtime double. This does not decode, convert, or validate a real video in a browser.
const testPath = new URL(process.env.VIDEO_SPEED_TEST_HTML || 'src/index.template.html', new URL('../', import.meta.url));
let html = fs.readFileSync(testPath, 'utf8');
const payload = html.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/)?.[1];
if (payload) html = gunzipSync(Buffer.from(payload.trim(), 'base64')).toString('utf8');
const originalScript = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

class Element {
  constructor(id = '') {
    this.id=id; this.value=''; this.checked=false; this.disabled=false; this.hidden=false; this.textContent='';
    this.dataset={}; this.attributes={}; this.listeners={}; this.style={setProperty(){}};
    const names=new Set(); this.classList={add:x=>names.add(x),remove:x=>names.delete(x),toggle:(x,on)=>on?names.add(x):names.delete(x)};
    this.preservesPitch=true; this.open=false;
  }
  addEventListener(type, fn) { (this.listeners[type]??=[]).push(fn); }
  async emit(type, additions={}) { const event={target:this,preventDefault(){},stopPropagation(){},...additions}; for(const fn of this.listeners[type]??[]) await fn(event); }
  setAttribute(k,v){this.attributes[k]=v;}
  removeAttribute(k){delete this.attributes[k];if(k==='src')this.src='';}
  pause(){} load(){} focus(){} scrollIntoView(){} click(){this.clicked=true;} remove(){} append(){}
  showModal(){this.open=true;} close(){this.open=false;} contains(node){return node===this;}
}
function harness(language = 'en'){
  const elements=new Map([...html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)].map(m=>{
    const element = new Element(m[1]);
    element.hidden = /\shidden(?:\s|>)/.test(m[0]);
    element.disabled = /\sdisabled(?:\s|>)/.test(m[0]);
    return [m[1], element];
  }));
  const get=id=>elements.get(id)??(()=>{throw Error(`missing element ${id}`)})();
  const qualities=['high','standard','small'].map(value=>Object.assign(new Element(),{value,checked:value==='standard'}));
  get('preservePitchInput').checked=true;
  for(const id of ['targetHours','targetMinutes','targetSeconds']){get(id).value='0';get(id).max=id==='targetHours'?'999':'59';}
  const created = [];
  const document={documentElement:{},body:new Element(),head:new Element(),activeElement:null,
    querySelector(s){if(s==='input[name="quality"]:checked')return qualities.find(x=>x.checked);if(s.startsWith('#'))return get(s.slice(1));throw Error(`query ${s}`);},
    querySelectorAll(s){if(s.startsWith('[data-i18n'))return [];if(s.includes(','))return s.split(',').flatMap(x=>this.querySelectorAll(x.trim()));if(s==='.target-time')return ['targetHours','targetMinutes','targetSeconds'].map(get);if(s==='input[name="quality"]')return qualities;if(s.startsWith('#'))return [get(s.slice(1))];throw Error(`queryAll ${s}`);},
    createElement(type){const element=new Element(type);created.push(element);return element;}
  };
  let nextUrl=0;const revoked=[];const runtimeCalls=[];let run=async()=>({files:[{name:'/output.mp4',data:new Uint8Array([109,112,52,97])}]});
  const runner={run:async args=>{runtimeCalls.push(args);return run(args);},dispose(){}};
  const BrowserFFmpeg={videoSpeedChangerArgs:options=>options,videoSpeedChangerInspectArgs:options=>options,decodeJsonOutput:result=>result.report};
  const sandbox={document,console:{error(){}},navigator:{language:'en'},localStorage:{getItem(key){return key.endsWith(':language') ? language : null;},setItem(){}},
    URL:{createObjectURL(){return `blob:synthetic-${++nextUrl}`;},revokeObjectURL(url){revoked.push(url);}},
    BrowserFFmpeg,Blob,Uint8Array,AbortController,DOMException,WebAssembly,TextDecoder,Intl,HTMLElement:Element,
    clearTimeout(){},setTimeout(){return 1;},requestAnimationFrame:fn=>fn(),addEventListener(){}};
  sandbox.window=sandbox;
  const source=originalScript.replace('__APP_CONFIG_JSON__',JSON.stringify({name:'test',slug:'test',version:'1.0.0',defaultLanguage:'en'}))
    .replace('__BUILD_MANIFEST_JSON__','{}').replace('__EMBEDDED_ASSET_BUNDLE_JSON__','{}')
    .replace(/\}\)\(\);\s*$/,`globalThis.assessment = {loadVideo, resetSourceBoundary, setSpeed, setTargetPanel, updateTargetFromInputs, convertCurrentVideo, cancelCurrentConversion, resultFileName,
      setRunner(value){ffmpegRunnerPromise=Promise.resolve(value);},
      state(){return {currentFile,currentSpeed,converting,resultBlob,resultUrl,resultSnapshot,resultSaved,phase:asyncState.state.phase,activeProbe};}
    };})();`);
  vm.runInNewContext(source,sandbox,{filename:'upstream-index-script.js'});
  const api=sandbox.assessment;api.setRunner(runner);
  async function load(name='sample.mp4',duration=60){api.loadVideo({name,type:'video/mp4',size:8});const probe=api.state().activeProbe;Object.assign(probe,{duration,videoWidth:16,videoHeight:9});await probe.emit('loadedmetadata');}
  return {api,get,load,revoked,runtimeCalls,created,setRun:fn=>{run=fn;}};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('ordinary supported rates and target-duration calculation',async()=>{
 const h=harness();await h.load();
 for(const rate of [.25,.5,1,1.33,1.67,2,4]){assert.equal(h.api.setSpeed(rate),true);await h.api.convertCurrentVideo();assert.equal(h.api.state().resultSnapshot.outputDuration,60/rate);assert.equal(h.runtimeCalls.at(-1).args.rate,rate);}
 h.api.setTargetPanel(true);h.get('targetMinutes').value='0';h.get('targetSeconds').value='30';h.api.updateTargetFromInputs();assert.equal(h.api.state().currentSpeed,2);
});

test('invalid direct rate does not call runtime; blur restores valid rate',async()=>{
 const h=harness();await h.load();h.api.setSpeed(2);h.get('speedInput').value='5';await h.get('speedInput').emit('input');await h.api.convertCurrentVideo();assert.equal(h.runtimeCalls.length,0);await h.get('speedInput').emit('change');assert.equal(h.api.state().currentSpeed,2);
});

test('cancel preserves previous result and its automatic export filename',async()=>{
 const h=harness();await h.load('sample.mp4');h.api.setSpeed(2);await h.api.convertCurrentVideo();
 const old=h.api.state();assert.equal(h.api.resultFileName(),'sample-speed-2.00x.mp4');
 h.api.setSpeed(.5);const d=deferred();h.setRun(args=>{args.signal.addEventListener('abort',()=>d.reject(new DOMException('Conversion cancelled.','AbortError')));return d.promise;});
 const pending=h.api.convertCurrentVideo();await tick();h.api.cancelCurrentConversion();await pending;
 assert.equal(h.api.state().resultBlob,old.resultBlob);assert.equal(h.api.state().resultUrl,old.resultUrl);assert.equal(h.api.state().resultSnapshot.speed,2);assert.equal(h.get('convertError').textContent,'');assert.equal(h.api.state().converting,false);
 assert.equal(h.api.resultFileName(),'sample-speed-2.00x.mp4');
});

test('ordinary failure is retryable and successful retry clears the error',async()=>{
 const h=harness();await h.load();h.setRun(async()=>{throw Error('ordinary conversion failure');});await h.api.convertCurrentVideo();assert.ok(h.get('convertError').textContent);assert.equal(h.api.state().converting,false);
 h.setRun(async()=>({files:[{name:'/output.mp4',data:new Uint8Array([1])}]}));await h.api.convertCurrentVideo();assert.equal(h.get('convertError').textContent,'');assert.ok(h.api.state().resultBlob);
});

test('source replacement clears preceding conversion error and technical details',async()=>{
 const h=harness();await h.load('source-a.mp4');h.setRun(async()=>{throw Error('ordinary conversion failure A');});await h.api.convertCurrentVideo();assert.ok(h.get('convertError').textContent);
 await h.load('source-b.mp4');assert.equal(h.api.state().currentFile.name,'source-b.mp4');assert.equal(h.api.state().phase,'ready');assert.deepEqual({error:h.get('convertError').textContent,detailsHidden:h.get('convertErrorDetails').hidden,detailsContainA:h.get('convertErrorDetailText').textContent.includes('failure A')},{error:'',detailsHidden:true,detailsContainA:false});
});

test('late source A inspection cannot overwrite ready source B',async()=>{
 const h=harness();const d=deferred();h.setRun(()=>d.promise);h.api.loadVideo({name:'source-a.mkv',type:'video/x-matroska',size:8});await h.api.state().activeProbe.emit('error');await tick();
 await h.load('source-b.mp4',30);d.resolve({report:{duration:90,video:{width:16,height:9},audio:true}});await tick();assert.equal(h.api.state().currentFile.name,'source-b.mp4');assert.equal(h.get('videoPreview').dataset.duration,'30');assert.equal(h.api.state().phase,'ready');assert.equal(h.runtimeCalls[0].signal.aborted,true);
});

test('custom name remains owned by user across successful conversion',async()=>{
 const h=harness();await h.load();h.get('outputNameInput').value='my-edited-name';await h.get('outputNameInput').emit('input');h.api.setSpeed(2);await h.api.convertCurrentVideo();assert.equal(h.api.resultFileName(),'my-edited-name.mp4');
});


test('failed reconversion preserves previous result automatic export filename',async()=>{
 const h=harness();await h.load('sample.mp4');h.api.setSpeed(2);await h.api.convertCurrentVideo();const old=h.api.state();
 h.api.setSpeed(.5);h.setRun(async()=>{throw Error('ordinary conversion failure');});await h.api.convertCurrentVideo();
 assert.equal(h.api.state().resultBlob,old.resultBlob);assert.equal(h.api.state().resultSnapshot.speed,2);assert.equal(h.api.resultFileName(),'sample-speed-2.00x.mp4');
});

test('invalid zero/out-of-range target retains previous valid speed',async()=>{
 const h=harness();await h.load();h.api.setSpeed(2);h.api.setTargetPanel(true);
 h.get('targetMinutes').value='0';h.get('targetSeconds').value='0';h.api.updateTargetFromInputs();assert.equal(h.api.state().currentSpeed,2);assert.match(h.get('targetResult').textContent,/longer than 0/);
 h.get('targetSeconds').value='1';h.api.updateTargetFromInputs();assert.equal(h.api.state().currentSpeed,2);assert.match(h.get('targetResult').textContent,/0.25/);
});

const output = bytes => ({ files: [{ name: '/output.mp4', data: new Uint8Array(bytes) }] });
const errorState = h => ({
  message: h.get('convertError').textContent,
  detail: h.get('convertErrorDetailText').textContent,
  hidden: h.get('convertErrorDetails').hidden,
  open: h.get('convertErrorDetails').open
});
const noError = { message: '', detail: '', hidden: true, open: false };

async function completedResult(h, speed = 2) {
  await h.load('sample.mp4');
  h.api.setSpeed(speed);
  await h.api.convertCurrentVideo();
  return h.api.state();
}

test('pending reconversion keeps the prior result name until successful replacement', async () => {
  const h = harness();
  const old = await completedResult(h);
  h.api.setSpeed(.5);
  const next = deferred();
  h.setRun(() => next.promise);
  const pending = h.api.convertCurrentVideo();
  await tick();
  assert.equal(h.get('outputNameInput').value, 'sample-speed-2.00x');
  assert.equal(h.api.state().resultBlob, old.resultBlob);
  next.resolve(output([9, 8, 7]));
  await pending;
  assert.notEqual(h.api.state().resultBlob, old.resultBlob);
  assert.equal(h.api.state().resultSnapshot.speed, .5);
  assert.deepEqual([...new Uint8Array(await h.api.state().resultBlob.arrayBuffer())], [9, 8, 7]);
  assert.equal(h.api.resultFileName(), 'sample-speed-0.50x.mp4');
  assert.ok(h.revoked.includes(old.resultUrl));
});

test('failed reconversion can retry and commit a matching result and automatic name', async () => {
  const h = harness();
  const old = await completedResult(h);
  h.api.setSpeed(.5);
  h.setRun(async () => { throw Error('failed retry'); });
  await h.api.convertCurrentVideo();
  assert.equal(h.api.resultFileName(), 'sample-speed-2.00x.mp4');
  assert.equal(h.revoked.includes(old.resultUrl), false);
  h.setRun(async () => output([5]));
  await h.api.convertCurrentVideo();
  assert.equal(h.api.state().resultSnapshot.speed, .5);
  assert.equal(h.api.resultFileName(), 'sample-speed-0.50x.mp4');
  assert.deepEqual(errorState(h), noError);
});

for (const outcome of ['cancel', 'failure', 'success']) {
  test(`custom filename survives ${outcome} of a reconversion`, async () => {
    const h = harness();
    await completedResult(h);
    h.get('outputNameInput').value = 'my edited result';
    await h.get('outputNameInput').emit('input');
    h.api.setSpeed(.5);
    const next = deferred();
    h.setRun(() => next.promise);
    const pending = h.api.convertCurrentVideo();
    await tick();
    assert.equal(h.api.resultFileName(), 'my edited result.mp4');
    if (outcome === 'cancel') {
      h.api.cancelCurrentConversion();
      next.reject(new DOMException('Conversion cancelled.', 'AbortError'));
    } else if (outcome === 'failure') next.reject(Error('failure'));
    else next.resolve(output([5]));
    await pending;
    assert.equal(h.api.resultFileName(), 'my edited result.mp4');
  });
}

test('source reset clears results, conversion diagnostics and the user-owned filename', async () => {
  const h = harness();
  const old = await completedResult(h);
  h.get('outputNameInput').value = 'my previous source';
  await h.get('outputNameInput').emit('input');
  h.setRun(async () => { throw Error('source A failure'); });
  await h.api.convertCurrentVideo();
  h.get('convertErrorDetails').open = true;
  h.api.resetSourceBoundary();
  assert.equal(h.api.state().resultBlob, null);
  assert.equal(h.api.state().currentFile, null);
  assert.equal(h.api.state().phase, 'empty');
  assert.equal(h.get('convertResult').hidden, true);
  assert.ok(h.revoked.includes(old.resultUrl));
  assert.deepEqual(errorState(h), noError);
  await h.load('source-b.mp4');
  assert.equal(h.api.resultFileName(), 'source-b-speed-1.00x.mp4');
});

for (const outcome of ['success', 'failure', 'abort']) {
  test(`late source A conversion ${outcome} cannot overwrite source B`, async () => {
    const h = harness();
    await h.load('source-a.mp4');
    const old = deferred();
    h.setRun(() => old.promise);
    const pending = h.api.convertCurrentVideo();
    await tick();
    const oldCall = h.runtimeCalls.at(-1);
    await h.load('source-b.mp4', 30);
    assert.equal(oldCall.signal.aborted, true);
    assert.equal(h.api.state().converting, false);
    assert.equal(h.get('convertProgress').hidden, true);
    assert.equal(h.get('speedInput').disabled, false);
    const message = h.get('appToastMessage').textContent;
    if (outcome === 'success') old.resolve(output([1]));
    else old.reject(outcome === 'abort' ? new DOMException('Conversion cancelled.', 'AbortError') : Error('late A failure'));
    await pending;
    assert.equal(h.api.state().currentFile.name, 'source-b.mp4');
    assert.equal(h.api.state().resultBlob, null);
    assert.equal(h.api.state().phase, 'ready');
    assert.deepEqual(errorState(h), noError);
    assert.equal(h.api.resultFileName(), 'source-b-speed-1.00x.mp4');
    assert.equal(h.get('appToastMessage').textContent, message);
  });
}

test('late source A completion cannot enable controls or change progress during conversion B', async () => {
  const h = harness();
  await h.load('source-a.mp4');
  const a = deferred();
  h.setRun(() => a.promise);
  const pendingA = h.api.convertCurrentVideo();
  await tick();
  const oldCall = h.runtimeCalls.at(-1);
  await h.load('source-b.mp4');
  const b = deferred();
  h.setRun(() => b.promise);
  const pendingB = h.api.convertCurrentVideo();
  await tick();
  assert.equal(h.runtimeCalls.length, 2);
  h.runtimeCalls.at(-1).onProgress(.25);
  oldCall.onProgress(.9);
  a.reject(Error('late source A error'));
  await pendingA;
  assert.equal(h.get('convertProgressBar').value, .25);
  assert.equal(h.api.state().converting, true);
  assert.equal(h.get('speedInput').disabled, true);
  assert.equal(h.get('convertProgress').hidden, false);
  assert.deepEqual(errorState(h), noError);
  b.resolve(output([2]));
  await pendingB;
  assert.equal(h.api.state().converting, false);
  assert.equal(h.api.resultFileName(), 'source-b-speed-1.00x.mp4');
});

test('source replacement while runtime is loading does not start the old conversion', async () => {
  const h = harness();
  await h.load('source-a.mp4');
  const ready = deferred();
  h.api.setRunner(ready.promise);
  const pending = h.api.convertCurrentVideo();
  await h.load('source-b.mp4');
  ready.resolve({ run: async () => { throw Error('obsolete runtime run'); } });
  await pending;
  assert.equal(h.api.state().resultBlob, null);
  assert.deepEqual(errorState(h), noError);
  assert.equal(h.get('appToastMessage').textContent, 'Video loaded');
});

test('a rejected runtime startup from source A cannot show its error on source B', async () => {
  const h = harness();
  await h.load('source-a.mp4');
  const ready = deferred();
  h.api.setRunner(ready.promise);
  const pending = h.api.convertCurrentVideo();
  await h.load('source-b.mp4');
  ready.reject(Error('source A runtime failed'));
  await pending;
  assert.deepEqual(errorState(h), noError);
});

test('cancelled conversion ignores a non-AbortError failure from the terminated runtime', async () => {
  const h = harness();
  const old = await completedResult(h);
  const next = deferred();
  h.setRun(() => next.promise);
  const pending = h.api.convertCurrentVideo();
  await tick();
  h.api.cancelCurrentConversion();
  next.reject(Error('Worker terminated'));
  await pending;
  assert.equal(h.api.state().resultBlob, old.resultBlob);
  assert.deepEqual(errorState(h), noError);
});

test('late source A inspection error cannot affect ready source B', async () => {
  const h = harness();
  const next = deferred();
  h.setRun(() => next.promise);
  h.api.loadVideo({name: 'source-a.mkv', type: 'video/x-matroska', size: 8});
  await h.api.state().activeProbe.emit('error');
  await tick();
  await h.load('source-b.mp4', 30);
  next.reject(Error('source A inspection failed'));
  await tick();
  assert.equal(h.api.state().currentFile.name, 'source-b.mp4');
  assert.equal(h.api.state().phase, 'ready');
  assert.deepEqual(errorState(h), noError);
});


test('Save uses the retained result URL and its filename after failed reconversion', async () => {
  const h = harness();
  const old = await completedResult(h);
  h.api.setSpeed(.5);
  h.setRun(async () => { throw Error('failure'); });
  await h.api.convertCurrentVideo();
  await h.get('downloadResultButton').emit('click');
  const link = h.created.find(element => element.id === 'a');
  assert.equal(link.href, old.resultUrl);
  assert.equal(link.download, 'sample-speed-2.00x.mp4');
  assert.equal(link.clicked, true);
  assert.equal(h.api.state().resultSaved, true);
});

test('cancel followed by successful runtime settlement keeps the previous result', async () => {
  const h = harness();
  const old = await completedResult(h);
  h.api.setSpeed(.5);
  const next = deferred();
  h.setRun(() => next.promise);
  const pending = h.api.convertCurrentVideo();
  await tick();
  h.api.cancelCurrentConversion();
  const progress = h.get('convertProgressBar').value;
  h.runtimeCalls.at(-1).onProgress(.95);
  assert.equal(h.get('convertProgressBar').value, progress);
  next.resolve(output([99]));
  await pending;
  assert.equal(h.api.state().resultBlob, old.resultBlob);
  assert.equal(h.api.resultFileName(), 'sample-speed-2.00x.mp4');
  assert.equal(h.revoked.includes(old.resultUrl), false);
  assert.deepEqual(errorState(h), noError);
});

for (const outcome of ['success', 'failure']) {
  test(`late A ${outcome} after B succeeds cannot damage B's completed result`, async () => {
    const h = harness();
    await h.load('source-a.mp4');
    const a = deferred();
    h.setRun(() => a.promise);
    const pending = h.api.convertCurrentVideo();
    await tick();
    const oldCall = h.runtimeCalls.at(-1);
    await h.load('source-b.mp4');
    h.api.setSpeed(4);
    h.setRun(async () => output([2]));
    await h.api.convertCurrentVideo();
    const b = h.api.state();
    if (outcome === 'success') a.resolve(output([1]));
    else a.reject(Error('late A'));
    await pending;
    oldCall.onProgress(.2);
    assert.equal(h.api.state().resultBlob, b.resultBlob);
    assert.equal(h.api.state().resultUrl, b.resultUrl);
    assert.equal(h.api.state().resultSnapshot, b.resultSnapshot);
    assert.equal(h.api.resultFileName(), 'source-b-speed-4.00x.mp4');
    assert.equal(h.get('convertProgressBar').value, 1);
    assert.deepEqual(errorState(h), noError);
  });
}

test('Japanese error and result ownership follow the same source boundary', async () => {
  const h = harness('ja');
  await completedResult(h);
  h.api.setSpeed(.5);
  h.setRun(async () => { throw Error('failure'); });
  await h.api.convertCurrentVideo();
  assert.equal(h.api.resultFileName(), 'sample-speed-2.00x.mp4');
  assert.match(h.get('convertError').textContent, /変換/);
  await h.load('source-b.mp4');
  assert.deepEqual(errorState(h), noError);
  assert.equal(h.api.state().resultBlob, null);
});

for (const language of ['en', 'ja']) {
  test(`${language}: target panel suggestions never apply a rounded speed or stale a fresh result`, async () => {
    for (const [duration, speed] of [[10, 1.33], [60, 1.33], [10, 4], [1, 4], [2.04, 4], [.1, .25], [60, 2]]) {
      const h = harness(language); await h.load('synthetic.mp4', duration); h.api.setSpeed(speed);
      await h.api.convertCurrentVideo(); const before = h.api.state();
      const name = h.get('outputNameInput').value;
      for (let cycle = 0; cycle < 2; cycle++) {
        await h.get('targetDurationButton').emit('click');
        assert.equal(h.api.state().currentSpeed, speed, `duration=${duration}; speed=${speed}`);
        assert.equal(h.get('videoPreview').playbackRate, speed);
        assert.equal(h.get('videoPreview').defaultPlaybackRate, speed);
        assert.equal(h.get('resultStaleNotice').hidden, true);
        assert.equal(h.api.state().resultBlob, before.resultBlob);
        assert.equal(h.api.state().resultSnapshot, before.resultSnapshot);
        assert.equal(h.get('outputNameInput').value, name);
        assert.equal(h.runtimeCalls.length, 1);
        assert.doesNotMatch(h.get('targetResult').textContent, /longer than 0|outside|0秒より|範囲では/);
        await h.get('targetDurationButton').emit('click');
        assert.equal(h.api.state().currentSpeed, speed);
      }
    }
  });
  test(`${language}: target guidance gives feasible whole-second ranges including field limits`, async () => {
    for (const [duration, minimum, maximum] of [[60, '0:15', '4:00'], [10, '0:03', '0:40'], [10.01, '0:03', '0:40'], [.25, '0:01', '0:01'], [900000, '62:30:00', '999:59:59']]) {
      const h = harness(language); await h.load('range.mp4', duration); h.api.setTargetPanel(true);
      const guidance = h.get('targetRangeHint'); assert.equal(guidance.hidden, false);
      assert.ok(guidance.textContent.includes(minimum), guidance.textContent);
      assert.ok(guidance.textContent.includes(maximum), guidance.textContent);
      assert.match(guidance.textContent, language === 'en' ? /whole.second/ : /1秒単位/);
      assert.equal(h.runtimeCalls.length, 0);
    }
  });
  test(`${language}: infeasible whole-second targets explain direct speed without opening errors`, async () => {
    for (const duration of [.1, 14400000]) {
      const h = harness(language); await h.load('range.mp4', duration); h.api.setSpeed(4); h.api.setTargetPanel(true);
      assert.equal(h.api.state().currentSpeed, 4);
      assert.match(h.get('targetRangeHint').textContent, language === 'en' ? /directly/ : /直接/);
      assert.doesNotMatch(h.get('targetResult').textContent, /longer than 0|outside|0秒より|範囲では/);
    }
  });
  test(`${language}: deliberate target edits retain existing validation and speed rounding`, async () => {
    const h = harness(language); await h.load('target.mp4', 60); h.api.setSpeed(1.33); await h.api.convertCurrentVideo();
    h.api.setTargetPanel(true); h.get('targetMinutes').value = '0'; h.get('targetSeconds').value = '45';
    await h.get('targetSeconds').emit('input'); assert.equal(h.api.state().currentSpeed, 1.333);
    assert.equal(h.get('resultStaleNotice').hidden, false);
    assert.match(h.get('targetResult').textContent, /1\.33/);
    h.get('targetSeconds').value = '0'; await h.get('targetSeconds').emit('input');
    assert.match(h.get('targetResult').textContent, language === 'en' ? /longer than 0/ : /0秒より/);
    assert.equal(h.api.state().currentSpeed, 1.333);
    h.get('targetSeconds').value = '1'; await h.get('targetSeconds').emit('input');
    assert.match(h.get('targetResult').textContent, language === 'en' ? /outside/ : /範囲では/);
    assert.equal(h.api.state().currentSpeed, 1.333);
    h.get('targetSeconds').value = '30'; await h.get('targetSeconds').emit('input');
    assert.equal(h.api.state().currentSpeed, 2);
    h.api.setSpeed(4);
    assert.doesNotMatch(h.get('targetResult').textContent, /Required speed|必要な速度/);
  });
}

test('target guidance is hidden without finite positive metadata and source replacement clears it', async () => {
  const h = harness(); h.api.setTargetPanel(true);
  assert.equal(h.get('targetRangeHint').hidden, true);
  assert.equal(h.get('targetResult').textContent, '—');
  for (const duration of [0, NaN, Infinity]) {
    h.get('videoPreview').dataset.duration = String(duration); h.api.setTargetPanel(true);
    assert.equal(h.get('targetRangeHint').hidden, true);
  }
  await h.load('first.mp4', 60); h.api.setTargetPanel(true);
  assert.equal(h.get('targetRangeHint').hidden, false);
  h.api.loadVideo({name:'second.mp4', type:'video/mp4', size:8});
  assert.equal(h.get('targetRangeHint').hidden, true);
  assert.equal(h.get('targetRangeHint').textContent, '');
  const probe = h.api.state().activeProbe;
  Object.assign(probe, {duration:10, videoWidth:16, videoHeight:9}); await probe.emit('loadedmetadata');
  h.api.setTargetPanel(true);
  assert.match(h.get('targetRangeHint').textContent, /0:03.*0:40/);
});

test('language changes render target guidance and validation without applying suggested speed', async () => {
  const h = harness(); await h.load('language.mp4', 10); h.api.setSpeed(1.33); h.api.setTargetPanel(true);
  await h.get('languageButton').emit('click');
  assert.match(h.get('targetRangeHint').textContent, /1秒単位/);
  assert.equal(h.api.state().currentSpeed, 1.33);
  h.get('targetSeconds').value = '0'; await h.get('targetSeconds').emit('input');
  await h.get('languageButton').emit('click');
  assert.match(h.get('targetResult').textContent, /longer than 0/);
  assert.equal(h.api.state().currentSpeed, 1.33);
});

test('target panel preserves an edited filename and unapplied automatic filename', async () => {
  const h = harness(); await h.load('names.mp4', 10); h.api.setSpeed(1.33);
  const automatic = h.get('outputNameInput').value;
  h.api.setTargetPanel(true); h.api.setTargetPanel(false);
  assert.equal(h.get('outputNameInput').value, automatic);
  h.get('outputNameInput').value = 'my final cut'; await h.get('outputNameInput').emit('input');
  await h.api.convertCurrentVideo();
  h.api.setTargetPanel(true); await h.get('languageButton').emit('click'); h.api.setTargetPanel(false);
  assert.equal(h.api.resultFileName(), 'my final cut.mp4');
  assert.equal(h.api.state().currentSpeed, 1.33);
  assert.equal(h.get('resultStaleNotice').hidden, true);
});

test('fallback inspection supplies guidance and late inspection cannot replace a newer range', async () => {
  const h = harness();
  h.setRun(async () => ({report:{duration:10.01, video:{width:16, height:9}, audio:true}}));
  h.api.loadVideo({name:'fallback.mkv', type:'video/x-matroska', size:8});
  await h.api.state().activeProbe.emit('error'); await tick(); await tick();
  assert.equal(h.api.state().phase, 'ready'); h.api.setTargetPanel(true);
  assert.match(h.get('targetRangeHint').textContent, /0:03.*0:40/);
  assert.equal(h.runtimeCalls.length, 1);
  const d = deferred(); h.setRun(() => d.promise);
  h.api.loadVideo({name:'obsolete.mkv', type:'video/x-matroska', size:8});
  await h.api.state().activeProbe.emit('error'); await tick();
  await h.load('new.mp4', 60); h.api.setTargetPanel(true);
  d.resolve({report:{duration:10, video:{width:16, height:9}, audio:true}}); await tick();
  assert.match(h.get('targetRangeHint').textContent, /0:15.*4:00/);
});

test('target helper descriptions are attached to all target fields', () => {
  for (const id of ['targetHours', 'targetMinutes', 'targetSeconds']) {
    const markup = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0];
    assert.match(markup, /aria-describedby="targetRangeHint targetResult"/);
  }
});
