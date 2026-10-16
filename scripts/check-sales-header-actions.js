const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const {setup,filterStyles}=require('./check-desktop-trade-colors');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
function pixels(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);return x.width===y.width&&x.height===y.height&&x.data.every((v,i)=>Math.abs(v-y.data[i])<=2);}
async function customer(p){return p.locator('#openCustomers').evaluate(e=>{const s=getComputedStyle(e),svg=e.querySelector('svg'),i=getComputedStyle(svg);return {html:e.innerHTML,paint:[s.backgroundImage,s.backgroundColor,s.color,s.borderColor,s.boxShadow],icon:[i.width,i.height,i.filter]};});}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
for(const [width,height,mobile] of [[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false],[320,700,true],[375,900,true],[430,900,true],[667,375,true],[375,400,true]]){
 const pages=[];for(const old of [true,false]){const p=await browser.newPage({viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:ua}:{})});await p.clock.setFixedTime(new Date('2026-10-16T12:00:00'));await setup(p,old);await p.evaluate(()=>{window.qaWrites=0;saveStateToCloud=()=>window.qaWrites++;});pages.push(p);}
 const [before,p]=pages;
 if(mobile){assert.equal(await p.locator('#desktopSalesActions').count(),0);assert.ok(pixels(await before.locator('.layout').screenshot(),await p.locator('.layout').screenshot()),'mobile sales unchanged');}
 else{
 assert.deepEqual(await customer(p),await customer(before),'customer paint and SVG unchanged');
 assert.deepEqual(await filterStyles(p),await filterStyles(before),'filter styles unchanged');assert.ok(pixels(await before.locator('#desktopFilterRail').screenshot(),await p.locator('#desktopFilterRail').screenshot()),'filter pixels unchanged');
 assert.equal(await p.locator('.sales-main-panel > .panel-heading h2').isVisible(),false);assert.equal(await p.locator('#salesOrderCount').isVisible(),true);
 assert.deepEqual(await p.locator('#desktopSalesActions > button').evaluateAll(es=>es.map(e=>e.id)),['openCustomers','desktopPrimaryAction']);
 const fit=await p.evaluate(()=>{const a=document.getElementById('openCustomers').getBoundingClientRect(),b=document.getElementById('desktopPrimaryAction').getBoundingClientRect();return a.right<=b.left&&b.left-a.right>=8&&Math.abs(a.y-b.y)<1&&a.left>=0&&b.right<=innerWidth;});assert.ok(fit,'left/right order and bounds');
 assert.equal(await p.locator('#openCustomers').count(),1);await p.locator('#openCustomers').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'desktopPrimaryAction');
 for(const key of ['Enter','Space']){await p.locator('#openCustomers').press(key);assert.equal(await p.locator('#customersPage').isVisible(),true);await p.locator('#closeCustomersTop').click();assert.equal(await p.evaluate(()=>getActiveTabName()),'sales');}
 await p.locator('#openCustomers svg').click();assert.equal(await p.locator('#customersPage').isVisible(),true);await p.locator('#closeCustomersTop').click();
 await p.locator('#desktopPrimaryAction').click();assert.equal(await p.locator('#salesOrderFields').isVisible(),true);await p.locator('#cancelQuickEntry').click();
 for(const [create,manage] of [[false,true],[true,false],[false,false]]){await p.evaluate(([create,manage])=>{authState.role='employee';authState.profile={role:'employee',storeId:'test',permissions:{sales:{view:true,create,customerManage:manage}}};render();},[create,manage]);assert.equal(await p.locator('#openCustomers').isVisible(),manage);assert.equal(await p.locator('#desktopPrimaryAction').isVisible(),create);}
 await p.evaluate(()=>{authState.role='admin';authState.profile={role:'admin'};render();});
 if(width===1440)await p.screenshot({path:'C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/applied-sales-customer-header.png'});
 }
 for(const tab of ['purchase','overview','income','expense','sales','purchase','sales']){
  for(const q of pages){await q.evaluate(t=>{activateTab(t);render();document.activeElement?.blur();scrollTo(0,0);},tab);await q.mouse.move(0,0);}
  if(!mobile){assert.equal(await p.locator('#openCustomers').count(),1);assert.equal(await p.locator('#desktopSalesActions').count(),tab==='sales'?1:0);if(tab!=='sales')assert.equal(await p.locator('.sales-main-panel > #openCustomers').count(),1);if(tab==='purchase')assert.deepEqual(await p.locator('#desktopPurchaseActions > button').evaluateAll(es=>es.map(e=>e.id)),['toggleInventory','desktopPrimaryAction']);}
  if(tab!=='sales'||mobile)assert.ok(pixels(await before.locator('.layout').screenshot(),await p.locator('.layout').screenshot()),tab+' visible pixels unchanged');
 }
 assert.equal(await p.evaluate(()=>window.qaWrites),0);for(const q of pages)await q.close();console.log(`${width}x${height}: customer/header/title, icon/paint, permissions, actions, tab restoration and Mobile OK`);
}
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
