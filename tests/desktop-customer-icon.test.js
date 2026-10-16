const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('desktop customer button reuses Mobile SVG and renames gradient IDs, never maintains separate artwork', () => {
  const desktopInit = app.slice(app.indexOf('if (desktopUi) {'), app.indexOf('document.querySelector("#desktopFilterControls").append'));
  assert.match(desktopInit, /els\.mobileSalesCustomers\?\.querySelector\("\.sales-customers-icon"\)/);
  assert.match(desktopInit, /mobileCustomerIcon\.cloneNode\(true\)/);
  assert.match(desktopInit, /!els\.openCustomers\.querySelector\("\.sales-customers-icon"\)/);
  assert.match(desktopInit, /const desktopId = `\$\{originalId\}Desktop`/);
  assert.match(desktopInit, /shape\.setAttribute\("fill", `url\(#\$\{desktopId\}\)`\)/);
  assert.match(desktopInit, /els\.openCustomers\.prepend\(desktopCustomerIcon\)/);
  assert.match(desktopInit, /setAttribute\("focusable", "false"\)/);
  assert.equal((html.match(/<svg class="sales-customers-icon"/g) || []).length, 1);
  assert.match(html, /<svg class="sales-customers-icon" aria-hidden="true"/);
});

test('desktop customer icon is before the label, centered and scoped away from Mobile and filters', () => {
  const button = css.match(/html:not\(\.mobile-app-theme\) body\[data-active-tab="sales"\] #openCustomers \{ display: flex;([^}]+)\}/)[1];
  assert.match(button, /align-items: center; justify-content: center; gap: 8px/);
  const icon = css.match(/html:not\(\.mobile-app-theme\) body\[data-active-tab="sales"\] #openCustomers \.sales-customers-icon \{([^}]+)\}/)[1];
  assert.match(icon, /width: 32px; height: 32px; flex: 0 0 auto/);
  assert.doesNotMatch(button + icon, /font-size|height: 48px|position|grid-template|display: none/);
  assert.match(app, /els\.openCustomers\.addEventListener\("click", \(\) => openCustomersPage\(\)\)/);
});
