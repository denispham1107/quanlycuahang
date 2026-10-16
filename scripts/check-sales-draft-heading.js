const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const {setup,filterStyles}=require('./check-desktop-trade-colors');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
// Chromium glass-edge rasterization can vary by three levels in isolated channels.
// Keep the two-level general tolerance and permit at most four such edge channels.
function pixels(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return false;let max=0,n=0;for(let i=0;i<x.data.length;i++){const d=Math.abs(x.data[i]-y.data[i]);max=Math.max(max,d);if(d>2)n++;}if(max>3||n>4){console.log({max,channels:n,pixels:x.width*x.height});const root='C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/';fs.writeFileSync(root+'draft-heading-before.png',a);fs.writeFileSync(root+'draft-heading-after.png',b);}return max<=3&&n<=4;}
async function typography(p){return p.evaluate(()=>{const title=document.querySelector('.draft-order-heading'),goods=document.querySelector('.sales-goods-panel h2'),count=document.getElementById('salesOrderCount'),a=title.getBoundingClientRect(),b=goods.getBoundingClientRect(),c=count.getBoundingClientRect(),pa=title.closest('.panel').getBoundingClientRect(),pb=goods.closest('.panel').getBoundingClientRect();const style=e=>{const s=getComputedStyle(e);return [s.fontSize,s.fontWeight,s.lineHeight,s.fontFamily];};return {draft:style(title),goods:style(goods),top:[a.top-pa.top,b.top-pb.top],left:[a.left-pa.left,b.left-pb.left],fits:a.right<c.left&&a.bottom<=document.querySelector('.draft-order-table').getBoundingClientRect().top,parent:title.parentElement.className,count:count.textContent};});}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
for(const [width,height,mobile] of [[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false],[320,700,true],[375,900,true],[430,900,true],[667,375,true],[375,400,true]]){
 const pages=[];for(const old of [true,false]){const p=await browser.newPage({viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:ua}:{})});await p.clock.setFixedTime(new Date('2026-10-16T12:00:00'));await setup(p,old);await p.evaluate(()=>{window.qaWrites=0;saveStateToCloud=()=>window.qaWrites++;});pages.push(p);}
 const [before,p]=pages;
 if(mobile){assert.equal(await p.locator('#salesDraftList > .draft-order-heading').count(),1);assert.ok(pixels(await before.locator('.layout').screenshot({animations:'disabled'}),await p.locator('.layout').screenshot({animations:'disabled'})),'Mobile pixels unchanged');}
 else{
 const t=await typography(p);assert.deepEqual(t.draft,t.goods,'same heading typography');assert.ok(Math.abs(t.top[0]-t.top[1])<1&&Math.abs(t.left[0]-t.left[1])<1,'same position inside card');assert.equal(t.parent,'panel-heading');assert.ok(t.fits);assert.equal(t.count,await before.locator('#salesOrderCount').innerText());
 assert.deepEqual(await filterStyles(p),await filterStyles(before));assert.ok(pixels(await before.locator('#desktopFilterRail').screenshot({animations:'disabled'}),await p.locator('#desktopFilterRail').screenshot({animations:'disabled'})),'filter unchanged');
 const header=async q=>q.locator('#desktopPageHeading').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {html:e.innerHTML,rect:[r.x,r.y,r.width,r.height],bg:s.backgroundImage};});assert.deepEqual(await header(p),await header(before),'top buttons unchanged');
 assert.equal(await p.locator('.draft-order-table').innerHTML(),await before.locator('.draft-order-table').innerHTML(),'draft table unchanged');
 await p.locator('[data-open-sales-draft="draft"]').click();assert.equal(await p.locator('#salesCustomerName').inputValue(),'Khách đang lưu');await p.locator('#cancelQuickEntry').click();
 if(width===1440)await p.screenshot({path:'C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/applied-sales-draft-heading.png'});
 await p.evaluate(()=>{window.qaDrafts=getActiveStore().draftOrders;getActiveStore().draftOrders=[];render();});assert.equal(await p.locator('.draft-order-heading').count(),0);
 await p.evaluate(()=>{getActiveStore().draftOrders=window.qaDrafts;render();render();});assert.equal(await p.locator('.draft-order-heading').count(),1);
 await p.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',storeId:'test',permissions:{sales:{view:true,draft:false}}};render();});assert.equal(await p.locator('.draft-order-heading').count(),0);
 await p.evaluate(()=>{authState.profile.permissions.sales.draft=true;render();});assert.equal(await p.locator('.draft-order-heading').count(),1);assert.ok((await typography(p)).fits);
 await p.evaluate(()=>{authState.role='admin';authState.profile={role:'admin'};render();});
 }
 for(const tab of ['purchase','overview']){for(const q of pages){await q.evaluate(t=>{activateTab(t);render();document.activeElement?.blur();scrollTo(0,0);},tab);await q.mouse.move(0,0);}assert.ok(pixels(await before.locator('.layout').screenshot({animations:'disabled'}),await p.locator('.layout').screenshot({animations:'disabled'})),tab+' unchanged');}
 await p.evaluate(()=>{activateTab('sales');render();});assert.equal(await p.locator('.draft-order-heading').count(),1);assert.equal(await p.evaluate(()=>window.qaWrites),0);for(const q of pages)await q.close();console.log(`${width}x${height}: title size/position, no overlap, draft/empty/permission/render states, buttons/filter/Mobile OK`);
}
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
