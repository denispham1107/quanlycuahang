const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8'), css = fs.readFileSync('styles.css','utf8'), app = fs.readFileSync('app.js','utf8');
test('customer picker has scoped wide glass shell with fixed heading/footer and one inset scroll body', () => {
  assert.match(html, /sales-customer-picker-card" role="dialog" aria-modal="true" aria-labelledby="salesCustomerCatalogTitle"/);
  assert.match(html, /sales-customer-picker-body" id="salesCustomerPickerBody"/);
  assert.match(css, /#salesCustomerCatalogModal \.sales-customer-picker-card\s*\{[^}]*width: min\(940px, 100%\);[^}]*overflow: hidden;/);
  assert.match(css, /#salesCustomerCatalogModal \.sales-catalog-tools\s*\{[^}]*grid-template-columns: minmax\(0, 2fr\) minmax\(180px, 1fr\)/);
  assert.match(css, /#salesCustomerPickerBody\s*\{[^}]*min-height: 0;[^}]*overflow-y: auto;[^}]*scrollbar-gutter: stable;/);
});
test('customer picker follows keyboard viewport, supports Escape and confines keyboard focus', () => {
  assert.match(app, /visualViewport\?\.addEventListener\("resize", updateSalesCustomerPickerViewport\)/);
  assert.match(app, /function updateSalesCustomerPickerViewport\(\)[\s\S]*?--customer-picker-height[\s\S]*?--customer-picker-top/);
  assert.match(app, /event.key === "Escape"\) closeSalesCustomerCatalogModal\(\)/);
  assert.match(app, /event.key === "Tab"[\s\S]*?event.shiftKey/);
  const select = app.match(/function selectSalesCustomer\(customerId\) \{([\s\S]*?)\n\}/)[1];
  assert.match(select, /els.salesCustomerName.value = customer.name/);
  assert.match(select, /els.salesCustomerPhone.value = customer.phone/);
  assert.doesNotMatch(select, /saveState|persist|\.orders|salesItems|salesOrderDate/);
});
