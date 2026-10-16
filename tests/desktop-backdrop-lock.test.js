const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
function handler(id,mobile,type){let click,closed=0;const layer={addEventListener:(name,fn)=>click=fn},ctx={USE_MOBILE_APP_THEME:mobile,els:{[id]:layer,quickEntryForm:{dataset:{type}}},closeQuickEntryModal:()=>closed++,closeInventoryModal:()=>closed++};const start=app.indexOf(`els.${id}.addEventListener("click", (event) => {`),end=app.indexOf('\n});',start)+4;vm.runInNewContext(app.slice(start,end),ctx);return {click,layer,closed:()=>closed};}
test('desktop sales, purchase and bulk purchase ignore backdrop clicks without changing explicit buttons',()=>{
 for(const type of ['sales','purchase','purchase-bulk']){const h=handler('quickEntryModal',false,type);h.click({target:h.layer});h.click({target:{}});assert.equal(h.closed(),0,type);}
 assert.match(app,/els\.cancelQuickEntry\.addEventListener\("click", closeQuickEntryModal\)/);assert.match(app,/els\.quickEntryClose\.addEventListener\("click", closeQuickEntryModal\)/);assert.match(app,/if \(saved\) closeQuickEntryModal\(\)/);
});
test('desktop warehouse stays open on backdrop, while Mobile and other quick-entry types retain behavior',()=>{
 const desktop=handler('inventoryModal',false);desktop.click({target:desktop.layer});assert.equal(desktop.closed(),0);
 const mobile=handler('inventoryModal',true);mobile.click({target:mobile.layer});assert.equal(mobile.closed(),1);
 for(const type of ['sales','purchase','purchase-bulk','income','expense']){const h=handler('quickEntryModal',true,type);h.click({target:{}});assert.equal(h.closed(),0);h.click({target:h.layer});assert.equal(h.closed(),1);}
 for(const type of ['income','expense']){const h=handler('quickEntryModal',false,type);h.click({target:h.layer});assert.equal(h.closed(),1);}
 assert.match(app,/els\.closeInventory\.addEventListener\("click", closeInventoryModal\)/);
});
