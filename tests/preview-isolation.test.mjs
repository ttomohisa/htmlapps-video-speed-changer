import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual CI helper. CDP transport and time are deterministic doubles;
// these regressions do not replace the workflow's real Chromium isolation check.
const helperPath = new URL('../scripts/verify-mt-isolation.mjs', import.meta.url);
const workflow = fs.readFileSync(new URL('../.github/workflows/preview.yml', import.meta.url), 'utf8');
const source = fs.existsSync(helperPath) ? fs.readFileSync(helperPath, 'utf8') : '';

test('isolation helper exists', () => assert.ok(source, 'exact-URL isolation helper must exist'));
const mtUrl = 'https://preview.example.test/mt/';
const isolated = { href: mtUrl, crossOriginIsolated: true, sharedArrayBuffer: true };
const blank = { href: 'about:blank', crossOriginIsolated: false, sharedArrayBuffer: false };
const page = (url = mtUrl) => ({
  id: 'mt-page', type: 'page', url,
  webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/mt-page'
});

async function runHelper({
  targets = [[page()]], states = [isolated], stalledFetch = false,
  stalledOpen = false, stalledMethod = '', evaluationError = false
} = {}) {
  let now = 0, timerId = 0, fetchCount = 0, evaluationCount = 0;
  const timers = new Map(), sockets = [], messages = [], logs = [];
  function setTimer(callback, delay) {
    const id = ++timerId;
    timers.set(id, { callback, time: now + delay });
    return id;
  }
  class Socket extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.closed = false;
      sockets.push(this);
      if (!stalledOpen) queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }
    send(raw) {
      const request = JSON.parse(raw);
      messages.push(request);
      if (request.method === stalledMethod) return;
      let result = {};
      if (request.method === 'Runtime.evaluate') {
        const state = states[Math.min(evaluationCount++, states.length - 1)];
        result = evaluationError ? { exceptionDetails: { text: 'Evaluation failed' } } : {
          result: { value: vm.runInNewContext(request.params.expression, {
            self: { crossOriginIsolated: state.crossOriginIsolated },
            SharedArrayBuffer: state.sharedArrayBuffer ? function SharedArrayBuffer() {} : undefined,
            location: { href: state.href }
          }) }
        };
      }
      queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ id: request.id, result })
      })));
    }
    close() { this.closed = true; }
  }
  const context = {
    process: { env: { MT_URL: mtUrl } },
    console: { log: value => logs.push(value) },
    Date: { now: () => now }, URL, AbortController,
    setTimeout: setTimer, clearTimeout: id => timers.delete(id),
    WebSocket: Socket,
    fetch: async (url, options = {}) => {
      assert.equal(url, 'http://127.0.0.1:9222/json/list');
      const index = fetchCount++;
      if (stalledFetch) {
        return new Promise((resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('Fetch aborted')), { once: true });
        });
      }
      return { ok: true, json: async () => targets[Math.min(index, targets.length - 1)] };
    }
  };
  let done = false, error;
  vm.runInNewContext(`(async () => {\n${source}\n})()`, context)
    .then(() => { done = true; }, failure => { error = failure; done = true; });
  // Let promises and simulated CDP events settle before advancing a pending timer.
  for (let turn = 0; !done && turn < 1000; turn++) {
    await new Promise(setImmediate);
    if (done) break;
    assert.ok(timers.size, 'helper is stuck without a bounded timeout');
    const [id, timer] = [...timers].sort((a, b) => a[1].time - b[1].time)[0];
    timers.delete(id);
    now = timer.time;
    assert.ok(now <= 30000, `helper exceeded its 30-second deadline: ${now}ms`);
    timer.callback();
  }
  assert.ok(done, 'helper did not settle within its bounded deadline');
  return { error, now, fetchCount, evaluationCount, sockets, messages, logs, timers };
}

function assertClean(result) {
  assert.equal(result.timers.size, 0, 'all timers must be cleared');
  assert.ok(result.sockets.every(socket => socket.closed), 'all opened sockets must be closed');
}

test('passes only for the exact MT page with both isolation capabilities', async () => {
  const result = await runHelper();
  assert.equal(result.error, undefined);
  assert.deepEqual(JSON.parse(result.logs.at(-1)), isolated);
  assert.equal(result.evaluationCount, 1);
  assertClean(result);
});

test('waits for delayed navigation instead of evaluating the initial about:blank page', async () => {
  const result = await runHelper({ targets: [[page('about:blank')], [page('about:blank')], [page()]] });
  assert.equal(result.error, undefined);
  assert.ok(result.fetchCount >= 3, 'target navigation must be observed first');
  assert.equal(result.evaluationCount, 1, 'the initial blank page must not be evaluated');
  assertClean(result);
});

test('waits when target metadata is ready before the page execution context navigates', async () => {
  const result = await runHelper({ states: [blank, isolated] });
  assert.equal(result.error, undefined);
  assert.equal(result.evaluationCount, 2);
  assertClean(result);
});

test('times out with the expected URL and last observed blank page when navigation never finishes', async () => {
  const result = await runHelper({ targets: [[page('about:blank')]], states: [blank] });
  assert.match(result.error?.message ?? '', /Timed out.*https:\/\/preview\.example\.test\/mt\//);
  assert.match(result.error.message, /about:blank/);
  assert.equal(result.now, 30000);
  assert.equal(result.evaluationCount, 0);
  assertClean(result);
});

for (const wrongUrl of ['https://other.example.test/mt/', `${mtUrl}unexpected`, `${mtUrl}?different=1`]) {
  test(`never accepts a nonexact target URL: ${wrongUrl}`, async () => {
    const result = await runHelper({ targets: [[page(wrongUrl)]], states: [{ ...isolated, href: wrongUrl }] });
    assert.match(result.error?.message ?? '', /Timed out/);
    assert.equal(result.evaluationCount, 0);
    assertClean(result);
  });
}

test('never accepts a wrong-origin execution context even if metadata and capabilities look valid', async () => {
  const result = await runHelper({ states: [{ ...isolated, href: 'https://other.example.test/mt/' }] });
  assert.match(result.error?.message ?? '', /Timed out/);
  assert.match(result.error.message, /other\.example\.test/);
  assertClean(result);
});

for (const [field, message] of [['crossOriginIsolated', /not cross-origin isolated/], ['sharedArrayBuffer', /SharedArrayBuffer is unavailable/]]) {
  test(`fails the exact MT page when ${field} is false`, async () => {
    const result = await runHelper({ states: [{ ...isolated, [field]: false }] });
    assert.match(result.error?.message ?? '', message);
    assertClean(result);
  });
}

for (const scenario of [
  { name: 'target-list fetch', stalledFetch: true },
  { name: 'WebSocket connection', stalledOpen: true },
  { name: 'CDP evaluation', stalledMethod: 'Runtime.evaluate' }
]) {
  test(`bounds a stalled ${scenario.name} within the shared deadline`, async () => {
    const result = await runHelper(scenario);
    assert.match(result.error?.message ?? '', /Timed out/);
    assert.ok(result.now <= 30000);
    assertClean(result);
  });
}

test('reports evaluation failures without accepting an unverified page', async () => {
  const result = await runHelper({ evaluationError: true });
  assert.ok(result.error);
  assertClean(result);
});

test('preview CI runs these regressions and the same readable helper', () => {
  assert.match(workflow, /run: \.\/scripts\/check-repository\.ps1/);
  assert.match(workflow, /node \.\/scripts\/verify-mt-isolation\.mjs/);
  assert.doesNotMatch(workflow, /FromBase64String/);
});
