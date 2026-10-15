const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {setup}=require('./check-desktop-trade-colors');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
async function open(p,type){await p.evaluate(type=>{closeQuickEntryModal();openQuickEntryModal(type);},type);await p.locator('#quickEntryForm').evaluate(e=>{e.getAnimations().forEach(a=>a.finish());document.activeElement?.blur();e.scrollTop=0;e.parentElement.scrollTop=0;window.scrollTo(0,0);});}
async function snapshot(p){return p.locator('#quickEntryForm').evaluate(form=>[form,...form.querySelectorAll('*')].map(e=>{
 const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {id:e.id,rect:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100),font:[s.fontSize,s.fontWeight,s.lineHeight],paint:['addSalesItem','addPurchaseItem'].includes(e.id)?null:[s.backgroundImage,s.backgroundColor,s.color,s.borderColor,s.boxShadow]};
}));}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height,mobile] of [[320,700,true],[375,900,true],[430,900,true],[667,375,true],[375,400,true],[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false]]){
  const pages=[];for(const old of [true,false]){const p=await browser.newPage({viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:ua}:{})});await p.clock.setFixedTime(new Date('2026-10-15T12:00:00'));await setup(p,old);await p.evaluate(()=>{window.qaWrites=0;saveStateToCloud=()=>window.qaWrites++;});pages.push(p);}
  const [before,p]=pages;
  for(const type of ['sales','purchase']){
   await open(before,type);await open(p,type);
   assert.deepEqual(await snapshot(p),await snapshot(before),`${width} ${type}: only button paint changes`);
   const id=type==='sales'?'addSalesItem':'addPurchaseItem',items=type==='sales'?'salesItems':'purchaseItems',data=type==='sales'?'sales':'purchase';
   const button=p.locator('#'+id);
   const paint=await button.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect();return {bg:s.backgroundImage,fg:s.color,border:s.borderTopColor,fit:t.left>=r.left&&t.right<=r.right&&t.top>=r.top&&t.bottom<=r.bottom};});
   assert.ok(paint.bg.includes('rgb(220, 207, 235)')&&paint.bg.includes('rgb(205, 220, 242)'));assert.equal(paint.fg,'rgb(88, 69, 127)');assert.equal(paint.border,'rgb(182, 167, 208)');assert.ok(paint.fit);
   await p.locator(`#${items} [data-${data}-item="name"]`).first().fill('Hàng đang nhập');
   const rows=p.locator('#'+items+' > .sales-item-row');const count=await rows.count();
   await button.click();assert.equal(await rows.count(),count+1);
   await button.press('Enter');assert.equal(await rows.count(),count+2);
   await button.press('Space');assert.equal(await rows.count(),count+3);
   assert.equal(await p.locator(`#${items} [data-${data}-item="name"]`).first().inputValue(),'Hàng đang nhập');
   await button.evaluate(e=>{e.disabled=true;e.click();});assert.equal(await rows.count(),count+3);await button.evaluate(e=>e.disabled=false);
   if(width===375&&height===900){await button.scrollIntoViewIfNeeded();await p.screenshot({path:`C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/applied-amethyst-add-${type}.png`,animations:'disabled'});}
   assert.equal(await p.evaluate(()=>window.qaWrites),0);
  }
  for(const type of ['income','expense']){await open(before,type);await open(p,type);assert.deepEqual(await snapshot(p),await snapshot(before),`${width} ${type} unchanged`);}
  for(const p of pages)await p.close();console.log(`${width}x${height}: soft-amethyst colors, unchanged layout/other paints, add rows by click/Enter/Space, draft/disabled OK`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
