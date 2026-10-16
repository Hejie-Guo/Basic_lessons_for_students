const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('hidden elements stay hidden even when component classes set display', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');

  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important;[^}]*\}/s);
});
