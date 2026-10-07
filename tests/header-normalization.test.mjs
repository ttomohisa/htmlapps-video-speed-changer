import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// Execute the real header-localization statements against a small DOM double.
// This is a unit regression, not a substitute for rendered browser verification.
const appId = 'video-speed-changer';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.config.json'), 'utf8'));
const files = process.argv.slice(2);
if (!files.length) files.push('src/index.template.html');

function objectBlock(source, start) {
  let depth = 0, quote = '', escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
    } else if (['"', "'", '`'].includes(char)) quote = char;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed source block');
}

for (const file of files) {
  const html = fs.readFileSync(path.resolve(root, file), 'utf8');
  test(`${file}: header version matches three-part app version`, () => {
    assert.match(config.version, /^\d+\.\d+\.\d+$/);
    assert.equal(html.match(/class="version-badge"[^>]*>([^<]+)/)?.[1], `v${config.version}`);
    if (!file.startsWith('src/') && appId !== 'face-redactor') {
      const embeddedStart = html.search(/const APP_CONFIG\s*=/);
      assert.ok(embeddedStart >= 0, 'built app config exists');
      const embedded = objectBlock(html, html.indexOf('{', embeddedStart));
      assert.equal(JSON.parse(embedded).version, config.version);
    }
  });

  test(`${file}: repeated JA/EN header language and Help localization`, () => {
    const face = appId === 'face-redactor';
    const cutter = appId === 'lossless-video-cutter';
    const dictionaryStart = html.search(new RegExp(`const ${cutter ? 'I18N' : 'translations'}\\s*=`));
    const dictionary = face ? null : vm.runInNewContext(`(${objectBlock(html, html.indexOf('{', dictionaryStart))})`, {}, { timeout: 1000 });
    const functionStart = html.indexOf('function applyLanguage(');
    assert.ok(functionStart >= 0);
    const body = objectBlock(html, html.indexOf('{', functionStart)).slice(1);
    const endMarker = face ? 'if(!busy' : cutter ? 'els.setStartCurrent' : appId === 'video-speed-changer' ? 'document.title =' : 'document.title=';
    const end = body.indexOf(endMarker);
    assert.ok(end > 0, 'header localization boundary exists');
    const code = body.slice(0, end);
    const elements = new Map();
    function get(id) {
      id = id.replace(/^#/, '');
      if (!elements.has(id)) {
        const tag = html.match(new RegExp(`<[^>]*\\bid="${id}"[^>]*>`))?.[0] || '';
        const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
        const dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
        elements.set(id, { attrs, dataset, title: attrs.title || '', textContent: '', setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; } });
      }
      return elements.get(id);
    }
    const languageButton = get(face ? 'languageToggle' : 'languageButton');
    const helpButton = get(face ? 'helpToggle' : 'helpButton');
    const languageLabel = cutter ? get('languageLabel') : languageButton;
    const document = { documentElement: {}, querySelector: () => ({ childNodes: [{}] }), querySelectorAll: selector => [...elements.values()].filter(e => {
      const key = selector.slice(1, -1).replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return e.dataset[key];
    }) };
    for (const language of ['ja', 'en', 'ja', 'en']) {
      const t = key => dictionary?.[language]?.[key] ?? key;
      vm.runInNewContext(code, { document, $: get, els: new Proxy({}, { get: (_, key) => get(key) }), state: { language }, language, appLanguage: language, t, translate: t, tr: (ja, en) => language === 'ja' ? ja : en }, { timeout: 1000 });
      assert.equal(document.documentElement.lang, language);
      assert.equal(languageLabel.textContent, language === 'ja' ? 'EN' : 'JA');
      const destination = language === 'ja' ? '英語に切り替え' : 'Switch to Japanese';
      assert.equal(languageButton.title, destination);
      assert.equal(languageButton.getAttribute('aria-label'), destination);
      const expectedHelp = face ? (language === 'ja' ? '使い方と注意事項' : 'Help & notes') : t(cutter ? 'help' : 'helpTitle');
      assert.equal(helpButton.title, expectedHelp);
      assert.equal(helpButton.getAttribute('aria-label'), expectedHelp);
      const privacy = face ? get('localProcessingText').textContent : t(cutter ? 'privacy' : 'localBadge');
      assert.match(privacy, language === 'ja' ? /完全ローカル処理/ : /fully local/i);
    }
  });
}
