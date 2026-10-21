import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const preparePath = path.join(root, 'scripts/prepare-pages.ps1');
const helperHash = 'e97bbac6017322d48aa54a5bc7ce473c725a4b7376ff245002e0ba71c3dcdd7e';
const inputs = ['scripts/prepare-pages.ps1', 'coi-serviceworker.lock.json', 'vendor/coi-serviceworker/coi-serviceworker.js', 'licenses/coi-serviceworker-MIT.txt'];

function fixture(t, mutate = () => {}, arguments_ = []) {
  for (const relative of inputs) assert.ok(fs.existsSync(path.join(root, relative)), `Required deployment input: ${relative}`);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'speed-pages-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const relative of inputs) {
    fs.mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
    fs.copyFileSync(path.join(root, relative), path.join(directory, relative));
  }
  fs.mkdirSync(path.join(directory, 'dist'));
  const html = variant => `<!doctype html>\n<html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; script-src 'self' 'unsafe-inline' blob:; worker-src 'self' blob:"></head><body>${variant} 日本語</body></html>\n`;
  fs.writeFileSync(path.join(directory, 'dist/index.html'), html('single-thread'));
  fs.writeFileSync(path.join(directory, 'dist/index.mt.html'), html('multi-thread'));
  mutate(directory);
  const result = spawnSync(process.env.PWSH || 'pwsh', ['-NoLogo', '-NoProfile', '-File', path.join(directory, 'scripts/prepare-pages.ps1'), ...arguments_], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  return { directory, result, get: relative => fs.readFileSync(path.join(directory, relative), 'utf8') };
}

test('Pages staging preserves raw ST and MT while wrapping only /mt/', t => {
  const { directory, result, get } = fixture(t);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(get('pages-dist/index.html'), get('dist/index.html'));
  assert.equal(get('pages-dist/mt/index.mt.html'), get('dist/index.mt.html'));
  assert.doesNotMatch(get('dist/index.mt.html'), /coi-serviceworker/);
  assert.doesNotMatch(get('pages-dist/index.html'), /coi-serviceworker/);
  const wrapper = get('pages-dist/mt/index.html');
  assert.match(wrapper, /multi-thread/);
  assert.match(wrapper, /connect-src 'none'/);
  assert.match(wrapper, /window\.crossOriginIsolated === false/);
  assert.match(wrapper, /coiScript\.src = "\.\/coi-serviceworker\.js"/);
  assert.equal(get('pages-dist/mt/coi-serviceworker.js'), get('vendor/coi-serviceworker/coi-serviceworker.js'));
  assert.ok(fs.existsSync(path.join(directory, 'pages-dist/.nojekyll')));
  assert.equal(fs.existsSync(path.join(directory, 'pages-dist/pages-bootstrap-control-ready')), false, 'normal Pages staging must not include the QA fixture');
  assert.equal(get('pages-dist/_headers').trim(), '/mt/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  Cross-Origin-Resource-Policy: same-origin');

  const bootstrap = wrapper.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap, 'wrapper bootstrap must exist');
  for (const crossOriginIsolated of [true, false, undefined]) {
    const requests = [];
    const window = { crossOriginIsolated };
    vm.runInNewContext(bootstrap, { window, document: { createElement: () => ({}), head: { appendChild: script => requests.push(script.src) } } });
    assert.deepEqual(requests, crossOriginIsolated === false ? ['./coi-serviceworker.js'] : []);
    if (crossOriginIsolated === false) {
      assert.equal(window.coi.coepCredentialless(), false);
      assert.equal(window.coi.coepDegrade(), false);
    }
  }
});

test('preview bootstrap fixture copies exact MT wrapper/helper outside server-isolated route', t => {
  const { result, get } = fixture(t, () => {}, ['-PreviewBootstrapCheck']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const filename of ['index.html', 'index.mt.html', 'coi-serviceworker.js', 'coi-serviceworker-MIT.txt']) {
    assert.equal(get(`pages-dist/pages-bootstrap-control-ready/mt/${filename}`), get(`pages-dist/mt/${filename}`));
  }
  assert.match(get('pages-dist/pages-bootstrap-control-ready/mt/index.html'), /coiScript\.src = "\.\/coi-serviceworker\.js"/);
  const headers = get('pages-dist/_headers');
  assert.deepEqual(headers.split('\n').filter(line => line.startsWith('/')), ['/mt/*']);
  assert.equal('/pages-bootstrap-control-ready/mt/'.startsWith('/mt/'), false);
  assert.doesNotMatch(headers, /pages-bootstrap-control-ready/);
});

test('Pages bootstrap waits for actual service-worker control before its first reload', async t => {
  const { result, get } = fixture(t);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const bootstrap = get('pages-dist/mt/index.html').match(/<script>([\s\S]*?)<\/script>/)?.[1];
  const storage = new Map();
  const registrationEvents = new Map();
  const workerEvents = new Map();
  let reloads = 0;
  const registration = {
    active: null,
    addEventListener: (type, callback) => registrationEvents.set(type, callback)
  };
  const serviceWorker = {
    controller: null,
    register: async () => registration,
    addEventListener: (type, callback) => workerEvents.set(type, callback),
    removeEventListener: (type, callback) => {
      if (workerEvents.get(type) === callback) workerEvents.delete(type);
    }
  };
  const document = {
    currentScript: { src: 'https://example.test/project/mt/coi-serviceworker.js' },
    createElement: () => ({}),
    head: { appendChild: () => {} }
  };
  const window = {
    crossOriginIsolated: false,
    isSecureContext: true,
    document,
    location: { reload: () => reloads++ },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  };
  const context = vm.createContext({ window, document, navigator: { serviceWorker } });
  vm.runInContext(bootstrap, context);
  vm.runInContext(read('vendor/coi-serviceworker/coi-serviceworker.js'), context);
  await Promise.resolve();
  assert.equal(reloads, 0);
  registrationEvents.get('updatefound')();
  assert.equal(reloads, 0, 'updatefound precedes activation and must not reload an uncontrolled page');
  window.coi.doReload();
  workerEvents.get('controllerchange')();
  assert.equal(reloads, 0, 'duplicate requests and a controllerchange without control must still wait');
  registration.active = { state: 'activated' };
  assert.equal(reloads, 0, 'activation alone does not mean clients.claim has completed');
  serviceWorker.controller = { state: 'activated', postMessage: () => {} };
  workerEvents.get('controllerchange')();
  assert.equal(reloads, 1, 'reload after control lets the worker supply isolation headers');
  registrationEvents.get('updatefound')();
  window.coi.doReload();
  assert.equal(reloads, 1, 'duplicate lifecycle notifications must not request duplicate reloads');
});

test('Pages reload hook handles control already present and missing service-worker support', t => {
  const { result, get } = fixture(t);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const bootstrap = get('pages-dist/mt/index.html').match(/<script>([\s\S]*?)<\/script>/)?.[1];
  for (const supported of [true, false]) {
    let reloads = 0;
    const listeners = new Set();
    const serviceWorker = supported ? {
      controller: { state: 'activated' },
      addEventListener: (type, callback) => listeners.add(callback),
      removeEventListener: (type, callback) => listeners.delete(callback)
    } : undefined;
    const window = { crossOriginIsolated: false, location: { reload: () => reloads++ } };
    const document = { createElement: () => ({}), head: { appendChild: () => {} } };
    vm.runInNewContext(bootstrap, { window, document, navigator: { serviceWorker } });
    window.coi.doReload();
    window.coi.doReload();
    assert.equal(reloads, supported ? 1 : 0);
    assert.equal(listeners.size, 0, 'no listener remains after a controlled reload');
  }
});

test('Pages staging rejects tampered helper before replacing an existing stage', t => {
  const { result, get } = fixture(t, directory => {
    fs.appendFileSync(path.join(directory, 'vendor/coi-serviceworker/coi-serviceworker.js'), '\n// tampered');
    fs.mkdirSync(path.join(directory, 'pages-dist'));
    fs.writeFileSync(path.join(directory, 'pages-dist/index.html'), 'previous stage');
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /SHA-256/);
  assert.equal(get('pages-dist/index.html'), 'previous stage');
});

for (const invalid of ['missing', 'malformed', 'already-wrapped']) {
  test(`Pages staging rejects ${invalid} MT input before replacing existing output`, t => {
    const { result, get } = fixture(t, directory => {
      const mt = path.join(directory, 'dist/index.mt.html');
      if (invalid === 'missing') fs.unlinkSync(mt);
      if (invalid === 'malformed') fs.writeFileSync(mt, '<html><body>no head</body></html>');
      if (invalid === 'already-wrapped') fs.appendFileSync(mt, '<script src="./coi-serviceworker.js"></script>');
      fs.mkdirSync(path.join(directory, 'pages-dist'));
      fs.writeFileSync(path.join(directory, 'pages-dist/index.html'), 'previous stage');
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /missing|<\/head>|remain standalone/);
    assert.equal(get('pages-dist/index.html'), 'previous stage');
  });
}

test('COI fallback uses the reviewed upstream bytes, license and directory-scoped registration', () => {
  assert.ok(fs.existsSync(preparePath), 'Pages staging script must exist');
  const lock = JSON.parse(read('coi-serviceworker.lock.json'));
  assert.equal(lock.version, '0.1.7');
  assert.equal(lock.commit, '7b1d2a092d0d2dd2b7270b6f12f13605de26f214');
  assert.equal(lock.sha256, helperHash);
  assert.equal(lock.license, 'MIT');
  const worker = read('vendor/coi-serviceworker/coi-serviceworker.js');
  assert.equal(crypto.createHash('sha256').update(worker).digest('hex'), helperHash);
  assert.match(worker, /serviceWorker\.register\(window\.document\.currentScript\.src\)/);
  assert.doesNotMatch(worker, /scope\s*:/);
  assert.match(read('licenses/coi-serviceworker-MIT.txt'), /Copyright \(c\) 2021 Guido Zuidhof/);
});

test('build, Pages and preview share the canonical Node 24 repository gate and staged site', () => {
  for (const name of ['build-standalone', 'deploy-pages', 'preview']) {
    const workflow = read(`.github/workflows/${name}.yml`);
    assert.match(workflow, /actions\/setup-node@(?:v6|249970729cb0ef3589644e2896645e5dc5ba9c38)/);
    assert.match(workflow, /node-version: 24/);
    assert.match(workflow, /POWERSHELL_TELEMETRY_OPTOUT: ['"]1['"]/);
    assert.match(workflow, /run: \.\/scripts\/check-repository\.ps1/);
    assert.doesNotMatch(workflow, /run: \.\/build-standalone\.ps1/);
  }
  assert.match(read('.github/workflows/deploy-pages.yml'), /path: pages-dist/);
  assert.match(read('wrangler.preview.jsonc'), /"directory": "\.\/pages-dist"/);
  const buildPreview = read('.github/workflows/preview.yml');
  const preview = read('.github/workflows/preview-deploy.yml');
  assert.match(preview, /Probe ST and MT Preview/);
  assert.match(buildPreview, /prepare-pages\.ps1 -PreviewBootstrapCheck/);
  assert.match(preview, /\$baseUrl\/pages-bootstrap-control-ready\/mt\//);
  assert.match(preview, /node \.\/scripts\/verify-mt-isolation\.mjs/);
  assert.match(preview, /Cross-Origin-Opener-Policy/);
  assert.match(preview, /Cross-Origin-Embedder-Policy/);
  assert.match(preview, /Cross-Origin-Resource-Policy/);
});

test('preview browser selection treats one executable as an array, never its first character', t => {
  const workflow = read('.github/workflows/preview-deploy.yml');
  const selection = workflow.match(/\$browserCandidates = ([\s\S]*?)\n\s*if \(/)?.[1];
  assert.ok(selection, 'browser candidate discovery must exist');
  assert.match(selection, /^@\(\s*@\(/, 'wrap the filtered pipeline in @()');
  assert.match(selection, /Where-Object \{ Test-Path -LiteralPath \$_ \}\s*\)\s*$/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'speed-browser-path-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const programFiles = path.join(directory, 'Program Files');
  const programFilesX86 = path.join(directory, 'Program Files (x86)');
  const executable = path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe');
  const secondExecutable = path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe');
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  // Assign inside the child process so Windows/PowerShell startup handling of
  // ProgramFiles cannot substitute a runner's installed browser into the fixture.
  const command = `$env:ProgramFiles = ${quote(programFiles)}; ${'${env:ProgramFiles(x86)}'} = ${quote(programFilesX86)}; $browserCandidates = ${selection}; ConvertTo-Json -Compress @{ count = @($browserCandidates).Count; first = [string]$browserCandidates[0]; paths = @($browserCandidates) }`;
  for (const expected of [[], [executable], [executable, secondExecutable]]) {
    for (const file of expected) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'synthetic executable path; never launched');
    }
    const result = spawnSync(process.env.PWSH || 'pwsh', ['-NoLogo', '-NoProfile', '-Command', command], { encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), { count: expected.length, first: expected[0] || '', paths: expected });
  }
});
