const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const {setup}=require('./check-desktop-trade-colors');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
function pixels(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);return x.width===y.width&&x.height===y.height&&x.data.every((v,i)=>Math.abs(v-y.data[i])<=2);}
async function snapshot(p,desktop){return p.locator('.dashboard').evaluate((root,desktop)=>[root,...root.querySelectorAll('*')].map(e=>{
 const s=getComputedStyle(e),r=e.getBoundingClientRect(),target=desktop?e.closest('#desktopPurchaseActions #desktopPrimaryAction, #desktopPurchaseActions #toggleInventory'):null;
 const origin=(r.width||r.height)?target?.getBoundingClientRect():null;
 return {tag:e.tagName,id:e.id,rect:[r.x-(origin?.x||0),r.y-(origin?.y||0),r.width,r.height].map(v=>Math.round(v*100)/100),font:[s.fontSize,s.fontWeight,s.padding,s.borderRadius],paint:[s.backgroundImage,s.backgroundColor,s.color,s.borderColor,s.boxShadow]};
}).sort((a,b)=>(a.id+'|'+a.tag+'|'+JSON.stringify(a)).localeCompare(b.id+'|'+b.tag+'|'+JSON.stringify(b))),desktop);}
async function icons(p){return p.evaluate(()=>{
 const svg=document.querySelector('#toggleInventory .purchase-action-icon'),s=getComputedStyle(svg),plus=document.querySelector('#desktopPrimaryAction span:first-child');
 return {svg:svg.outerHTML,paint:[s.backgroundImage,s.borderColor,s.boxShadow,s.width,s.height,s.padding],plus:plus.outerHTML,plusColor:getComputedStyle(plus).color};
});}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height,mobile] of [[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false],[320,700,true],[375,900,true],[430,900,true],[667,375,true],[375,400,true]]){
  const pages=[];for(const old of [true,false]){const p=await browser.newPage({viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:ua}:{})});await p.clock.setFixedTime(new Date('2026-10-15T12:00:00'));await setup(p,old);await p.evaluate(()=>{window.qaWrites=0;saveStateToCloud=()=>window.qaWrites++;activateTab('purchase');render();});pages.push(p);}
  const [before,p]=pages;assert.deepEqual(await snapshot(p,!mobile),await snapshot(before,!mobile),`${width}: geometry, fonts and other paints`);
  if(mobile){assert.ok(pixels(await before.locator('.layout').screenshot(),await p.locator('.layout').screenshot()),`${width}: Mobile pixels unchanged`);}
  else{
   assert.deepEqual(await icons(p),await icons(before),`${width}: original icons and icon plate unchanged`);
   assert.ok(pixels(await before.locator('#desktopFilterRail').screenshot(),await p.locator('#desktopFilterRail').screenshot()),'filter pixels unchanged');
   const paints=await p.evaluate(()=>['desktopPrimaryAction','toggleInventory'].map(id=>{const s=getComputedStyle(document.getElementById(id));return [s.backgroundImage,s.color,s.borderTopColor,s.boxShadow];}));
   assert.ok(paints[0][0].includes('rgb(51, 121, 133)')&&paints[0][0].includes('rgb(60, 108, 151)'));assert.equal(paints[0][1],'rgb(255, 255, 255)');
   assert.ok(paints[1][0].includes('rgb(213, 233, 231)')&&paints[1][0].includes('rgb(215, 231, 244)'));assert.equal(paints[1][1],'rgb(49, 94, 114)');assert.equal(paints[1][2],'rgb(163, 195, 207)');
   const buttons=p.locator('#desktopPurchaseActions > button');assert.equal(await buttons.count(),2);
   assert.deepEqual(await buttons.evaluateAll(es=>es.map(e=>e.id)),['toggleInventory','desktopPrimaryAction']);
   const order=await buttons.evaluateAll(es=>{const a=es[0].getBoundingClientRect(),b=es[1].getBoundingClientRect();return {left:a.right<=b.left,gap:b.left-a.right,y:Math.abs(a.y-b.y)};});assert.ok(order.left&&order.gap>=8&&order.y<1,JSON.stringify(order));
   await p.locator('#toggleInventory').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'desktopPrimaryAction');await p.locator('#desktopPrimaryAction').blur();
   for(const id of ['desktopPrimaryAction','toggleInventory']){const fit=await p.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth+1;});assert.ok(fit);}
   if(width===1440)await p.screenshot({path:'C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/applied-purchase-header-jade.png',animations:'disabled'});
   await p.locator('#desktopPrimaryAction').press('Enter');assert.equal(await p.locator('#purchaseOrderFields').isVisible(),true);await p.locator('#cancelQuickEntry').click();
   await p.locator('#toggleInventory .purchase-action-icon').click();assert.equal(await p.locator('#inventoryModal').isVisible(),true);await p.locator('#closeInventory').click();
   await p.locator('#toggleInventory').press('Space');assert.equal(await p.locator('#inventoryModal').isVisible(),true);await p.locator('#closeInventory').click();
  }
  for(const tab of ['sales','overview']){await before.evaluate(t=>{activateTab(t);render();},tab);await p.evaluate(t=>{activateTab(t);render();},tab);assert.deepEqual(await snapshot(p,false),await snapshot(before,false),`${width}: ${tab} unchanged`);}
  assert.equal(await p.evaluate(()=>window.qaWrites),0);for(const q of pages)await q.close();console.log(`${width}x${height}: approved matched colors, original icons/layout/filter/Mobile/other tabs and handlers OK`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
