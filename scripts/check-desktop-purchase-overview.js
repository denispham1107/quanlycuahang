const assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
const {setup,filterStyles,geometry,samePixels}=require('./check-desktop-trade-colors');
const read=page=>page.locator('#desktopInsights strong').allTextContents();
const expected=['660.000 ₫','20','5','15'];
const actions=page=>page.locator('#desktopPurchaseActions').evaluate(root=>[...root.children].map(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {html:e.innerHTML,x:b.x,y:b.y,width:b.width,height:b.height,paint:['backgroundImage','color','borderColor','boxShadow','fontSize'].map(p=>s[p])};}));
async function prepare(page,old=false){await page.clock.setFixedTime(new Date('2026-10-15T12:00:00'));await setup(page,old);await page.evaluate(()=>{
 const s=getActiveStore(),d=new Date(today+'T12:00:00');d.setDate(d.getDate()-1);
 s.inventoryLogs.push({date:today,type:'type-change',oldQuantity:100,newQuantity:0},{date:today,status:'cancelled',oldQuantity:0,newQuantity:999},{date:toDateInputValue(d),oldQuantity:0,newQuantity:1000});
 window.__writes=0;saveStateToCloud=async()=>{window.__writes++;};render();scrollTo(0,0);
});}
async function fits(page){assert.deepEqual(await page.locator('#desktopInsights').evaluate(root=>{
 const r=root.getBoundingClientRect(),errors=[];for(const e of root.querySelectorAll('article,article div,article strong')){const b=e.getBoundingClientRect();if(b.left<r.left-1||b.right>r.right+1||b.bottom>r.bottom+1||e.scrollWidth>e.clientWidth+1)errors.push(e.className||e.tagName);}return errors;
}),[]);}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height] of [[800,900],[1024,900],[1280,900],[1440,1000],[1920,1000],[320,700],[375,900],[430,900],[667,375],[375,400]]){
  const mobile=width<700,options={viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})};
  const before=await browser.newPage(options);await prepare(before,true);const sales=await before.screenshot({animations:'disabled'});await before.evaluate(()=>{activateTab('purchase');render();scrollTo(0,0)});
  const base=mobile?{pixels:await before.screenshot({animations:'disabled'})}:{filter:await before.locator('#desktopFilterRail').screenshot(),paint:await filterStyles(before),geometry:await geometry(before,['#desktopFilterRail']),buttons:await actions(before)};await before.close();
  const page=await browser.newPage(options),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());await prepare(page);
  assert.ok(samePixels(await page.screenshot({animations:'disabled'}),sales),'Sales tab remains pixel-identical');await page.evaluate(()=>{activateTab('purchase');render();scrollTo(0,0)});
  if(mobile){assert.ok(samePixels(await page.screenshot({animations:'disabled'}),base.pixels),'Mobile purchase remains pixel-identical');}
  else{
   assert.deepEqual((await read(page)).map(s=>s.replace(/\s/g,' ')),expected);assert.deepEqual(await page.locator('#desktopInsights article div > span').allTextContents(),['Tổng giá trị kho','Nhập kho','Xuất kho','Tổng tồn kho']);await fits(page);
   assert.deepEqual(await filterStyles(page),base.paint);assert.deepEqual(await geometry(page,['#desktopFilterRail']),base.geometry);assert.ok(samePixels(await page.locator('#desktopFilterRail').screenshot(),base.filter),'Filter unchanged');assert.deepEqual(await actions(page),base.buttons,'Header action content, icons, geometry and paint unchanged');
   const mobileStats=await page.evaluate(()=>[els.mobilePurchaseStockValue,els.mobilePurchaseImportCount,els.mobilePurchaseExportCount,els.mobilePurchaseStockTotal].map(e=>e.textContent));assert.deepEqual(await read(page),mobileStats,'Desktop uses exactly Mobile values');
   if(process.env.PURCHASE_OVERVIEW_SHOTS)await page.screenshot({path:path.join(process.env.PURCHASE_OVERVIEW_SHOTS,`purchase-overview-${width}.png`),animations:'disabled'});
   await page.evaluate(()=>{uiState.inventoryLogSearch='no-match';uiState.inventoryLogFilter='export';render()});assert.deepEqual((await read(page)).map(s=>s.replace(/\s/g,' ')),expected,'Log filters do not alter overview');
   await page.evaluate(()=>{els.rangeMode.value='yesterday';applyRangeModeFilter({type:'change'})});assert.deepEqual((await read(page)).map(s=>s.replace(/\s/g,' ')),['660.000 ₫','1.000','0','15']);
   await page.evaluate(()=>{state.stores.push(normalizeState({stores:[{id:'other',name:'Khác',inventory:[{id:'s',name:'Khác',quantity:1.5,totalCost:1234}],inventoryLogs:[{date:today,oldQuantity:0,newQuantity:2.5}]}]}).stores[0]);state.activeStoreId='other';els.rangeMode.value='today';applyRangeModeFilter({type:'change'})});assert.deepEqual((await read(page)).map(s=>s.replace(/\s/g,' ')),['1.234 ₫','2,5','0','1,5']);
   await page.evaluate(()=>{const s=getActiveStore();s.inventory=[];s.inventoryLogs=[];render()});assert.deepEqual((await read(page)).map(s=>s.replace(/\s/g,' ')),['0 ₫','0','0','0']);
   await page.evaluate(()=>{getActiveStore().inventory=[{name:'Số lớn',quantity:999999999999.5,totalCost:99999999999999}];render()});await fits(page);
   await page.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',storeId:'test',permissions:{purchase:{view:true,inventoryView:true,create:false}}};state.activeStoreId='test';render()});assert.deepEqual((await read(page)).map(s=>s.replace(/\s/g,' ')),expected);assert.equal(await page.locator('#quickEntryButton').isVisible(),false);
  }
  assert.equal(await page.evaluate(()=>window.__writes),0);assert.deepEqual(errors,[]);await page.close();console.log(`${mobile?'Mobile':'Desktop'} ${width}x${height}: overview values/layout, filters, permissions and unaffected views OK`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
