const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('approved lavender paint is limited to the mobile cash-list launch button', () => {
  const selector = 'html.mobile-app-theme .cash-quick-entry-mode #openBulkCashPage';
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0);
  const rule = css.slice(start, css.indexOf('}', start));
  for (const color of ['#cec7e9', '#eee8fb', '#e2eafa', '#5b4f8b', '#76669c17']) {
    assert.ok(rule.includes(color), color);
  }
  assert.doesNotMatch(rule, /(?:width|height|padding|margin|font|display|transform)\s*:/);
  assert.ok(css.includes(`${selector}:focus-visible {`));
  assert.ok(css.includes(`${selector}:active {`));
});
