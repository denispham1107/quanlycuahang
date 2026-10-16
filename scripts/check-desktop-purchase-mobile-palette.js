const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const {setup,filterStyles}=require('./check-desktop-trade-colors');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const props=['backgroundImage','backgroundColor','color','borderTopColor','boxShadow'];
async function paint(p,s,keys=props){return p.locator(s).first().evaluate((e,keys)=>{const s=getComputedStyle(e);return keys.map(k=>s[k]);},keys);}
// Tolerate only isolated glass-edge raster rounding (four channels at most); computed styles and geometry remain exact.
function pixels(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return false;let max=0,n=0;for(let i=0;i<x.data.length;i++){const d=Math.abs(x.data[i]-y.data[i]);max=Math.max(max,d);if(d>2)n++;}if(max>4||n>4)console.log({pixelMax:max,edgeChannels:n});return max<=4&&n<=4;}
async function snap(p,ignorePurchase){return p.locator('.layout').evaluate((root,ignore)=>[root,...root.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width||r.height;}).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),target=ignore&&(e.closest('[data-tab-panel="purchase"]')||e.closest('#desktopInsights'));return {tag:e.tagName,id:e.id,rect:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100),font:[s.fontSize,s.fontWeight,s.padding,s.borderWidth,s.display],paint:target?null:[s.backgroundImage,s.backgroundColor,s.color,s.borderColor,s.boxShadow]};}),ignorePurchase);}
async function icons(p){return p.evaluate(()=>['toggleInventory','openBulkPurchase'].map(id=>{const e=document.querySelector('#'+id+' svg'),s=getComputedStyle(e);return {html:e.outerHTML,paint:[s.backgroundImage,s.backgroundColor,s.borderColor,s.boxShadow,s.width,s.height,s.padding]};}));}
const pairs=[
 ['#desktopInsights','.mobile-purchase-overview',['backgroundImage','boxShadow']],
 ['#desktopInsights .desktop-insight.total','.mobile-purchase-overview > .purchase-value-metric',['backgroundImage','backgroundColor','borderTopColor']],
 ['#desktopInsights .stock-import','.mobile-purchase-overview > div:nth-child(2)',['backgroundImage','backgroundColor','borderTopColor']],
 ['#desktopInsights .total div span','.purchase-value-metric > span',['color']],
 ['#desktopInsights .stock-import div span','.mobile-purchase-overview > div:nth-child(2) > span',['color']],
 ['#desktopInsights .total strong','#mobilePurchaseStockValue',['color']],
 ['#desktopInsights .stock-import strong','#mobilePurchaseImportCount',['color']],
 ['#desktopInsights .stock-export strong','#mobilePurchaseExportCount',['color']],
 ['#desktopInsights .category-two strong','#mobilePurchaseStockTotal',['color']],
 ['.purchase-main-panel','#inventoryLogPanel',['backgroundImage','backgroundColor','borderTopColor','boxShadow']],
 ['#openBulkPurchase','#openBulkPurchase',props],
 ['.purchase-main-panel > .panel-heading h2','.mobile-purchase-heading h2',['color']],
 ['#inventoryLogPanel .inventory-log-heading','#inventoryLogPanel .inventory-log-heading',['color']],
 ['#inventoryLogPanel label','#inventoryLogPanel label',['color']],
 ['#inventoryLogPanel .inventory-log-summary','#inventoryLogPanel .inventory-log-summary',['backgroundImage','backgroundColor','borderTopColor','color']],
 ['#inventoryLogPanel .inventory-log-summary strong','#inventoryLogPanel .inventory-log-summary strong',['color']],
 ['#inventoryLogPanel tbody tr','#inventoryLogPanel tbody tr',['backgroundImage','backgroundColor','boxShadow']],
 ['#inventoryLogPanel .inventory-log-total','#inventoryLogPanel .inventory-log-total',['color']]
];
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const reference=await browser.newPage({viewport:{width:375,height:900},isMobile:true,hasTouch:true,userAgent:ua});await reference.clock.setFixedTime(new Date('2026-10-16T12:00:00'));await setup(reference);await reference.evaluate(()=>{activateTab('purchase');render();});const expected=[];for(const [,mobile,keys] of pairs)expected.push(await paint(reference,mobile,keys));await reference.close();
 for(const [width,height,mobile] of [[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false],[320,700,true],[375,900,true],[430,900,true],[667,375,true],[375,400,true]]){
  const pages=[];for(const old of [true,false]){const p=await browser.newPage({viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:ua}:{})});await p.clock.setFixedTime(new Date('2026-10-16T12:00:00'));await setup(p,old);await p.evaluate(()=>{window.qaWrites=0;saveStateToCloud=()=>window.qaWrites++;activateTab('purchase');render();});pages.push(p);}
  const [before,p]=pages;assert.deepEqual(await snap(p,!mobile),await snap(before,!mobile),'geometry/fonts and non-purchase paint unchanged');
  if(mobile)assert.ok(pixels(await before.locator('.layout').screenshot({animations:'disabled'}),await p.locator('.layout').screenshot({animations:'disabled'})),'Mobile unchanged');
  else{
   for(let i=0;i<pairs.length;i++){const [desktop,,keys]=pairs[i];assert.deepEqual(await paint(p,desktop,keys),expected[i],width+': Mobile paint '+desktop);}
   assert.deepEqual(await icons(p),await icons(before),'original SVGs and icon plates');
   assert.deepEqual(await filterStyles(p),await filterStyles(before));assert.ok(pixels(await before.locator('#desktopFilterRail').screenshot({animations:'disabled'}),await p.locator('#desktopFilterRail').screenshot({animations:'disabled'})),'left filter pixels unchanged');
   assert.deepEqual(await paint(p,'#desktopPurchaseActions #desktopPrimaryAction'),await paint(before,'#desktopPurchaseActions #desktopPrimaryAction'));assert.deepEqual(await paint(p,'#toggleInventory'),await paint(before,'#toggleInventory'));
   assert.equal(await p.locator('#desktopInsights').innerText(),await before.locator('#desktopInsights').innerText(),'same four real metrics');assert.equal(await p.locator('#inventoryLogPanel').innerText(),await before.locator('#inventoryLogPanel').innerText(),'same history data');
   if(width===1440)await p.screenshot({path:'C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/applied-desktop-purchase-mobile-palette.png'});
   await p.locator('[data-toggle-inventory-logs]').click();assert.equal(await p.locator('.inventory-log-extra').isVisible(),true);await p.locator('#inventoryLogFilter').selectOption('export');assert.equal(await p.locator('#inventoryLogReasonFilter').isVisible(),true);await p.locator('#inventoryLogFilter').selectOption('all');await p.locator('#inventoryLogSearch').fill('không tồn tại');assert.equal(await p.locator('.inventory-log-empty').isVisible(),true);await p.locator('#inventoryLogSearch').fill('');
   await p.locator('#openBulkPurchase svg').click();assert.equal(await p.locator('#bulkPurchaseFields').isVisible(),true);await p.locator('#cancelQuickEntry').click();await p.locator('#openBulkPurchase').press('Enter');assert.equal(await p.locator('#bulkPurchaseFields').isVisible(),true);await p.locator('#cancelQuickEntry').click();
   await p.locator('#toggleInventory').press('Space');assert.equal(await p.locator('#inventoryModal').isVisible(),true);await p.locator('#closeInventory').click();await p.locator('#desktopPrimaryAction').click();assert.equal(await p.locator('#purchaseOrderFields').isVisible(),true);await p.locator('#cancelQuickEntry').click();
   await p.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',storeId:'test',permissions:{purchase:{view:true,inventoryView:true,create:false}}};render();});assert.equal(await p.locator('#openBulkPurchase').isVisible(),false);assert.equal(await p.locator('#toggleInventory').isVisible(),true);await p.evaluate(()=>{authState.role='admin';authState.profile={role:'admin'};window.qaLogs=getActiveStore().inventoryLogs;getActiveStore().inventoryLogs=[];render();});assert.equal(await p.locator('.inventory-log-empty').isVisible(),true);await p.evaluate(()=>{getActiveStore().inventoryLogs=window.qaLogs;render();});
  }
  for(const tab of ['sales','overview','income','expense']){for(const q of pages){await q.evaluate(t=>{activateTab(t);render();document.activeElement?.blur();scrollTo(0,0);},tab);await q.mouse.move(0,0);}assert.deepEqual(await snap(p,false),await snap(before,false),tab+' unchanged');}
  assert.equal(await p.evaluate(()=>window.qaWrites),0);for(const q of pages)await q.close();console.log(`${width}x${height}: Mobile purchase paint, desktop geometry/header/filter, data/actions/roles and Mobile/other tabs OK`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
