const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('styles.css','utf8'),html=fs.readFileSync('index.html','utf8');
test('all full-page/dialog classes share html and body scroll locking based on visible layers',()=> {
  const match=css.match(/html:has\(body > :is\(([^)]+)\):not\(\[hidden\]\)\),\s*body:has\(> :is\(([^)]+)\):not\(\[hidden\]\)\)\s*\{\s*overflow:\s*hidden;/);
  assert.ok(match,'Both html and body must be locked, not body alone');assert.equal(match[1],match[2]);
  for(const className of ['auth-screen','modal-backdrop','bulk-cash-page','settings-detail-page','customers-page','sales-order-detail-page','sales-catalog-page','closing-book-page']) {
    assert.ok(match[1].includes('.'+className));assert.ok(html.includes(className));
  }
  assert.match(css,/\.modal-backdrop\s*\{[^}]*align-items:\s*safe center;[^}]*overflow-y:\s*auto;/,'Tall generic forms remain reachable');
  assert.match(css,/\.modal-backdrop\[inert\]\s*\{\s*overflow:\s*hidden !important;/,'Covered non-interactive dialogs cannot add another scrollbar');
});
test('short dialog lists use their backdrop and covered parents do not scroll',()=> {
  assert.match(css,/#salesCustomerCatalogModal \.sales-catalog-card,\s*#inventoryHistoryModal \.inventory-card\s*\{\s*max-height: none;\s*overflow: visible;/);
  assert.match(css,/#salesCustomerCatalogModal \.sales-catalog-list,\s*#inventoryHistoryModal \.inventory-list\s*\{\s*max-height: none;\s*overflow: visible;/);
  for(const id of ['inventoryHistoryModal','editInventoryModal','exportInventoryModal','orderDiscountModal','salesCustomerCatalogModal','customerHistoryModal','memberTierModal'])assert.ok(css.includes('#'+id));
  assert.match(css,/body:has\(> :is\(#customerHistoryModal, #memberTierModal\):not\(\[hidden\]\)\) > #customersPage\s*\{\s*overflow: hidden;/);
  assert.match(css,/\.modal-backdrop\.customer-history-backdrop,\s*\.modal-backdrop\.member-tier-backdrop\s*\{\s*z-index: 190;/,'Child dialogs stay above their customer page');
});
