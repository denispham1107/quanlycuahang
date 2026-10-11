const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('app.js','utf8'),css=fs.readFileSync('styles.css','utf8');
test('customer, goods and inventory mobile pages track a short visual viewport without changing desktop',()=>{
 for(const name of ['updateCustomersViewport','updateSalesCatalogViewport','updateInventoryViewport']){
  const start=app.indexOf('function '+name+'('),end=app.indexOf('\nfunction ',start+1),fn=app.slice(start,end);
  assert.match(fn,/if \(!USE_MOBILE_APP_THEME/);assert.match(fn,/mobile-list-short/);assert.match(fn,/viewport\?\.height/);
 }
 assert.match(app,/visualViewport\?\.addEventListener\("resize", updateInventoryViewport\)/);
 assert.match(css,/html.mobile-app-theme #inventoryModal\s*\{[^}]*top: var\(--inventory-visual-top[^}]*height: var\(--inventory-visual-height/);
});
test('compact mobile pages keep readable search and real actions with no card scroll regions',()=>{
 assert.match(css,/html.mobile-app-theme :is\(#salesCatalogPage, #inventoryModal\) \.sales-catalog-filter-grid input\s*\{[^}]*min-height: 44px;[^}]*font-size: 16px;/);
 assert.match(css,/html.mobile-app-theme #customersPage #customerSearchInput\s*\{[^}]*min-height: 44px;[^}]*font-size: 16px;/);
 assert.match(css,/#customersPage\.mobile-list-short \.customers-card:not\(\.customer-form-open\) > \.panel-heading \{ display: none;/);
 assert.match(css,/html.mobile-app-theme #inventoryModal \.inventory-export-button/);
 assert.match(css,/html.mobile-app-theme #customersPage \.customer-mobile-edit/);
});
