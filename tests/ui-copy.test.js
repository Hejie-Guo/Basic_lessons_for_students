const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('candidate identifier label is displayed as 工号', () => {
  const files = [
    path.join(__dirname, '..', 'public', 'index.html'),
    path.join(__dirname, '..', 'public', 'app.js'),
    path.join(__dirname, '..', 'public', 'admin.html'),
    path.join(__dirname, '..', 'public', 'admin.js'),
  ];
  const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

  assert.doesNotMatch(combined, /工号\/学号/);
  assert.match(combined, /工号/);
});
