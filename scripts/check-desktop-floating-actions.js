const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
const {setup,geometry,filterStyles,samePixels}=require('./check-desktop-trade-colors');
const tabs=['income','expense','purchase','sales'];
const mobileOptions=(width,height)=>({viewport:{width,height},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
async function prepare(page,old=false){await page.clock.setFixedTime(new Date('2026-10-15T12:00:00'));await setup(page,old);await page.evaluate(()=>{window.__writes=0;saveStateToCloud=async()=>{window.__writes++;return true;};});}
const change=(page,tab)=>page.evaluate(tab=>{activateTab(tab);render();scrollTo(0,0);document.activeElement?.blur();},tab);
async function paint(page,id){return page.locator('#'+id).evaluate(e=>{
 const get=n=>{const s=getComputedStyle(n);return ['width','height','padding','backgroundImage','border','borderRadius','boxShadow','color','stroke','strokeWidth','filter'].map(k=>s[k]);};
 return{circle:get(e),icon:get(e.querySelector('svg')),before:['backgroundImage','boxShadow','inset'].map(k=>getComputedStyle(e,'::before')[k]),svg:e.querySelector('svg').outerHTML};
});}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const mobile=await browser.newPage(mobileOptions(375,900));await prepare(mobile);const plusPaint=await paint(mobile,'quickEntryButton');await change(mobile,'overview');const aiPaint=await paint(mobile,'aiButton');await mobile.close();
 for(const width of [800,1024,1440,1920]){
  const before=await browser.newPage({viewport:{width,height:1000}});await prepare(before,true);
  const expected={};for(const tab of tabs){await change(before,tab);expected[tab]={filter:await filterStyles(before),filterImage:await before.locator('#desktopFilterRail').screenshot(),geometry:await geometry(before,['.layout','.dashboard','#desktopFilterRail'])};}await before.close();
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],api=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/cloudfunctions\.net|firestore\.googleapis/.test(r.url()))api.push(r.url());});page.on('dialog',d=>d.dismiss());await prepare(page);
  for(const tab of tabs){
   await change(page,tab);const fab=page.locator('#quickEntryButton');assert.equal(await fab.isVisible(),true,`${tab} FAB visible`);assert.equal(await page.locator('#aiButton').isVisible(),false);
   assert.deepEqual(await paint(page,'quickEntryButton'),plusPaint,'exact Mobile plus SVG, dimensions and paint');
   assert.deepEqual(await filterStyles(page),expected[tab].filter);assert.deepEqual(await geometry(page,['.layout','.dashboard','#desktopFilterRail']),expected[tab].geometry);
   assert.ok(samePixels(await page.locator('#desktopFilterRail').screenshot(),expected[tab].filterImage),'left filter pixels unchanged');
   const box=await fab.boundingBox();assert.ok(box.width>=44&&box.height>=44);assert.ok(Math.abs(box.x+box.width-(width-24))<1);assert.ok(Math.abs(box.y+box.height-980)<1);
   const beforeState=await page.evaluate(()=>JSON.stringify(state));
   await fab.click();assert.equal(await page.locator('#quickEntryModal').isVisible(),true);assert.equal(await page.locator('#quickEntryForm').getAttribute('data-type'),tab);
   assert.equal(await page.evaluate(()=>{const e=document.getElementById('quickEntryButton'),b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),false,'modal blocks the background FAB');
   await page.locator('#cancelQuickEntry').click();assert.equal(await page.evaluate(()=>JSON.stringify(state)),beforeState);
   await page.keyboard.press('Tab');await fab.focus();assert.equal(await fab.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');await fab.press('Enter');assert.equal(await page.locator('#quickEntryModal').isVisible(),true);await page.locator('#cancelQuickEntry').click();
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));const end=await fab.boundingBox();assert.ok(Math.abs(end.y-box.y)<1,'FAB remains fixed at end of page');
   assert.deepEqual(await page.evaluate(tab=>{const f=document.getElementById('quickEntryButton').getBoundingClientRect();return [...document.querySelector(`[data-tab-panel="${tab}"]`).querySelectorAll('button,input,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.left<f.right&&r.right>f.left&&r.top<f.bottom&&r.bottom>f.top;}).map(e=>e.id||e.className);},tab),[],'FAB does not cover final visible controls');
   if(process.env.FLOATING_SHOTS)await page.screenshot({path:path.join(process.env.FLOATING_SHOTS,`desktop-fab-${tab}-${width}.png`)});
  }
  await change(page,'overview');const ai=page.locator('#aiButton');assert.equal(await ai.isVisible(),true);assert.equal(await page.locator('#quickEntryButton').isVisible(),false);assert.deepEqual(await paint(page,'aiButton'),aiPaint,'exact Mobile AI robot and glass circle');assert.equal(await page.locator('#aiButton .ai-fab-label').isVisible(),false);
  await ai.focus();await ai.press('Space');assert.equal(await page.locator('#aiChatModal').isVisible(),true);await page.locator('#aiChatClose').click();assert.equal(await page.locator('#aiChatModal').isVisible(),false);if(process.env.FLOATING_SHOTS)await page.screenshot({path:path.join(process.env.FLOATING_SHOTS,`desktop-ai-${width}.png`)});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await ai.evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await page.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',storeId:'test',permissions:{purchase:{view:true,create:false},sales:{view:true,create:false}}};activateTab('purchase');render();});assert.equal(await page.locator('#quickEntryButton').isVisible(),false);await change(page,'sales');assert.equal(await page.locator('#quickEntryButton').isVisible(),false);
  await page.evaluate(()=>{authState.profile.permissions.purchase.create=true;activateTab('purchase');render();});assert.equal(await page.locator('#quickEntryButton').isVisible(),true);
  await page.evaluate(()=>{authState.role='admin';authState.profile={role:'admin'};state.stores=[];state.activeStoreId=null;activateTab('sales');render();});assert.equal(await page.locator('#quickEntryButton').isVisible(),false);await change(page,'overview');assert.equal(await ai.isVisible(),false);
  assert.equal(await page.evaluate(()=>window.__writes),0);assert.deepEqual(api,[],'opening AI/forms never sends APIs');assert.deepEqual(errors,[]);await page.close();console.log(`Desktop ${width}: four FABs, Mobile-matching robot/paint, fixed position, filters, keyboard, dialogs, roles and no writes/API OK`);
 }
 for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400]]){
  const before=await browser.newPage(mobileOptions(width,height));await prepare(before,true);const shots={};for(const tab of [...tabs,'overview']){await change(before,tab);await before.mouse.move(0,0);shots[tab]=await before.screenshot();}await before.close();
  const page=await browser.newPage(mobileOptions(width,height));await prepare(page);for(const tab of [...tabs,'overview']){await change(page,tab);await page.mouse.move(0,0);assert.ok(samePixels(await page.screenshot(),shots[tab]),`${tab} Mobile pixels unchanged at ${width}x${height}`);}await page.close();console.log(`Mobile ${width}x${height}: all five tabs pixel-identical`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
