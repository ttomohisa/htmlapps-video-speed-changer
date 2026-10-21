// CI-only Chromium DevTools check. Do not accept a startup page or a redirect
// as evidence that the expected MT preview is cross-origin isolated.
const mtUrl = process.env.MT_URL;
const waitForServiceWorker = process.env.MT_WAIT_FOR_SERVICE_WORKER === '1';
if (!mtUrl || !['http:', 'https:'].includes(new URL(mtUrl).protocol)) {
  throw new Error('MT_URL must be the expected HTTP(S) MT preview URL.');
}

const deadline = Date.now() + 30000;
let sequence = 0;
let lastObservation = 'No page target observed.';
const remaining = () => Math.max(0, deadline - Date.now());

// Every fetch, connection and CDP request shares the navigation deadline.
async function bounded(operation, label, limit = 10000) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timed out ${label}.`));
      controller.abort();
    }, Math.min(limit, remaining()));
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function socketEvent(socket, type, signal, accept = () => true, start = () => {}) {
  return new Promise((resolve, reject) => {
    const finish = (error, value) => {
      socket.removeEventListener(type, onEvent);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error); else resolve(value);
    };
    const onEvent = event => {
      try {
        const value = accept(event);
        if (value !== undefined) finish(null, value);
      } catch (error) { finish(error); }
    };
    const onError = event => finish(event.error ?? new Error('Chromium DevTools WebSocket error.'));
    const onClose = () => finish(new Error('Chromium DevTools WebSocket closed.'));
    const onAbort = () => finish(new Error('Chromium DevTools operation timed out.'));
    socket.addEventListener(type, onEvent);
    socket.addEventListener('error', onError);
    socket.addEventListener('close', onClose);
    signal.addEventListener('abort', onAbort, { once: true });
    try { start(); } catch (error) { finish(error); }
  });
}

async function readState(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  try {
    await bounded(signal => socketEvent(socket, 'open', signal), 'connecting to Chromium DevTools');
    const call = async (method, params = {}) => {
      const id = ++sequence;
      const message = await bounded(signal => socketEvent(socket, 'message', signal, event => {
        const response = JSON.parse(event.data);
        return response.id === id ? response : undefined;
      }, () => socket.send(JSON.stringify({ id, method, params }))), `waiting for CDP method ${method}`);
      if (message.error) throw new Error(JSON.stringify(message.error));
      return message.result;
    };
    await call('Runtime.enable');
    const evaluation = await call('Runtime.evaluate', {
      expression: waitForServiceWorker
        ? 'JSON.stringify({ crossOriginIsolated: self.crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer === "function", href: location.href, serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller) })'
        : 'JSON.stringify({ crossOriginIsolated: self.crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer === "function", href: location.href })',
      returnByValue: true
    });
    if (evaluation.exceptionDetails) {
      throw new Error(`CDP evaluation failed: ${JSON.stringify(evaluation.exceptionDetails)}`);
    }
    return JSON.parse(evaluation.result.value);
  } finally {
    socket.close();
  }
}

let state;
while (remaining() > 0) {
  try {
    const targets = await bounded(async signal => {
      const response = await fetch('http://127.0.0.1:9222/json/list', { signal });
      if (!response.ok) throw new Error(`Chromium target list returned HTTP ${response.status}.`);
      return response.json();
    }, 'reading Chromium page targets', 5000);
    lastObservation = `Page targets: ${JSON.stringify(targets.filter(item => item.type === 'page').map(item => item.url))}`;
    const target = targets.find(item => item.type === 'page' && item.url === mtUrl && item.webSocketDebuggerUrl);
    if (target) {
      const observed = await readState(target);
      lastObservation = JSON.stringify(observed);
      // Target metadata can update before its execution context leaves about:blank.
      if (observed.href === mtUrl && (!waitForServiceWorker ||
          (observed.crossOriginIsolated === true && observed.sharedArrayBuffer === true &&
           observed.serviceWorkerControlled === true))) {
        state = observed;
        break;
      }
    }
  } catch (error) {
    // Startup and navigation can briefly replace targets/execution contexts.
    // Retry only within the original deadline and retain the failure diagnostic.
    lastObservation = error.message;
  }
  if (remaining() > 0) await new Promise(resolve => setTimeout(resolve, Math.min(250, remaining())));
}

if (!state) {
  throw new Error(`Timed out waiting for exact MT URL ${mtUrl}. Last observation: ${lastObservation}`);
}
console.log(JSON.stringify(state));
if (state.crossOriginIsolated !== true) {
  throw new Error('MT Preview is not cross-origin isolated.');
}
if (state.sharedArrayBuffer !== true) {
  throw new Error('SharedArrayBuffer is unavailable in the MT Preview.');
}
