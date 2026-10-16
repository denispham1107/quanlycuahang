const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const {setup}=require('./check-desktop-trade-colors');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
function pixels(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);return x.width===y.width&&x.height===y.height&&x.data.every((v,i)=>Math.abs(v-y.data[i])<=2);}
async function snapshot(p,ignore){return p.locator('.layout').evaluate((root,ignore)=>[root,...root.querySelectorAll('*')].map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),target=ignore&&e.closest('#desktopPrimaryAction');return {tag:e.tagName,id:e.id,rect:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100),font:[s.fontSize,s.fontWeight,s.padding,s.borderRadius],paint:target?null:[s.backgroundImage,s.backgroundColor,s.color,s.borderColor,s.boxShadow,s.textShadow]};}),ignore);}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height,mobile] of [[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false],[320,700,true],[375,900,true],[430,900,true],[667,375,true],[375,400,true]]){
 const pages=[];for(const old of [true,false]){const p=await browser.newPage({viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:ua}:{})});await p.clock.setFixedTime(new Date('2026-10-16T12:00:00'));await setup(p,old);await p.evaluate(()=>{window.qaWrites=0;saveStateToCloud=()=>window.qaWrites++;});pages.push(p);}
 const [before,p]=pages;assert.deepEqual(await snapshot(p,!mobile),await snapshot(before,!mobile),'geometry/fonts/other paint unchanged');
 if(mobile)assert.ok(pixels(await before.locator('.layout').screenshot(),await p.locator('.layout').screenshot()),'Mobile unchanged');
 else{
 assert.ok(pixels(await before.locator('#desktopFilterRail').screenshot(),await p.locator('#desktopFilterRail').screenshot()),'filter unchanged');
 const style=await p.evaluate(()=>{const button=document.getElementById('desktopPrimaryAction'),a=getComputedStyle(button),b=getComputedStyle(document.getElementById('quickEntryButton'));return {same:['backgroundImage','color','borderColor','boxShadow'].every(k=>a[k]===b[k]),glass:['::before','::after'].every(k=>getComputedStyle(button,k).pointerEvents==='none'),html:button.innerHTML};});assert.ok(style.same&&style.glass);assert.equal(style.html,await before.locator('#desktopPrimaryAction').innerHTML());
 for(const key of ['Enter','Space']){await p.locator('#desktopPrimaryAction').press(key);assert.equal(await p.locator('#salesOrderFields').isVisible(),true);await p.locator('#cancelQuickEntry').click();}
 await p.locator('#desktopPrimaryAction span:last-child').click();assert.equal(await p.locator('#salesOrderFields').isVisible(),true);await p.locator('#cancelQuickEntry').click();
 if(width===1440)await p.screenshot({path:'C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/applied-sales-header-glass.png'});
 await p.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',storeId:'test',permissions:{sales:{view:true,create:false}}};render();});assert.equal(await p.locator('#desktopPrimaryAction').isVisible(),false);
 await p.evaluate(()=>{authState.role='admin';authState.profile={role:'admin'};render();});
 }
 for(const tab of ['purchase','overview','income','expense']){for(const q of pages)await q.evaluate(t=>{activateTab(t);render();},tab);assert.deepEqual(await snapshot(p,false),await snapshot(before,false),tab+' unchanged');}
 assert.equal(await p.evaluate(()=>window.qaWrites),0);for(const q of pages)await q.close();console.log(`${width}x${height}: glass match, layout/filter/Mobile/other tabs, keyboard/click/permissions OK`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
