const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const removed = [
  "長い説明はダイアログ内をスクロールできます。背面のページは、ダイアログを閉じてからスクロールできます。",
  "Scroll long explanations inside the dialog. Close the dialog to scroll the underlying page again."
];
for (const file of ["src/index.template.html", "video-speed-changer.html"]) {
  test(`${file}: user help omits implementation commentary`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const text of removed) assert.ok(!html.includes(text), `Remove implementation copy from ${file}`);
  });
}
