const assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const {setup}=require('./check-desktop-trade-colors');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
function same(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return false;return x.data.every((v,i)=>Math.abs(v-y.data[i])<=2);}
async function open(p,flow){await p.evaluate(flow=>{closeQuickEntryModal();if(flow==='purchase-bulk')openBulkPurchaseModal(getActiveStore());else openQuickEntryModal(flow);},flow);await p.locator('#quickEntryForm').evaluate(e=>{e.getAnimations().forEach(a=>a.finish());document.activeElement?.blur();e.scrollTop=0;e.parentElement.scrollTop=0;window.scrollTo(0,0);});}
async function snapshot(p,mobile){return p.locator('#quickEntryForm').evaluate((form,mobile)=>{
 const f=form.getBoundingClientRect();return [form,...form.querySelectorAll('*')].filter(e=>!mobile||e===form||!e.closest('.modal-actions')).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {id:e.id,rect:mobile&&e===form?null:[r.x-f.x,r.y-f.y,r.width,r.height].map(v=>Math.round(v*100)/100),paint:[s.backgroundImage,s.backgroundColor,s.color,s.borderColor,s.boxShadow],font:[s.fontSize,s.fontWeight,s.lineHeight]};});
},mobile);}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height,mobile] of [[320,700,true],[375,900,true],[430,900,true],[667,375,true],[375,400,true],[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false]]){
  const pages=[];for(const old of [true,false]){const p=await browser.newPage({viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:ua}:{})});await p.clock.setFixedTime(new Date('2026-10-15T12:00:00'));await setup(p,old);await p.evaluate(()=>{window.qaWrites=0;window.qaSubmits=0;saveStateToCloud=()=>window.qaWrites++;savePurchaseOrder=saveBulkPurchaseOrder=()=>{window.qaSubmits++;return false;};});pages.push(p);}
  const [before,p]=pages;
  for(const flow of ['purchase','purchase-bulk']){
   await open(before,flow);await open(p,flow);
   assert.deepEqual(await snapshot(p,mobile),await snapshot(before,mobile),`${width} ${flow}: fields/paint unchanged`);
   if(mobile){
    await p.locator('#quickEntrySubmit').scrollIntoViewIfNeeded();
    const layout=await p.evaluate(()=>{const a=els.cancelQuickEntry,b=els.quickEntrySubmit,ar=a.getBoundingClientRect(),br=b.getBoundingClientRect(),f=els.quickEntryForm.getBoundingClientRect();const fits=e=>{const range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect(),r=e.getBoundingClientRect();return t.left>=r.left&&t.right<=r.right&&t.top>=r.top&&t.bottom<=r.bottom;};return {sameRow:Math.abs(ar.top-br.top)<1,left:ar.right<br.left,bounds:ar.left>=f.left&&br.right<=f.right,height:Math.min(ar.height,br.height),fits:fits(a)&&fits(b),visible:ar.top>=0&&br.bottom<=innerHeight};});
    assert.ok(layout.sameRow&&layout.left&&layout.bounds&&layout.height>=44&&layout.fits&&layout.visible,JSON.stringify({width,flow,layout}));
    await p.locator('#quickEntrySubmit').press('Enter');assert.ok(await p.evaluate(()=>window.qaSubmits)>0);
    if(width===375&&height===900)await p.screenshot({path:`C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/purchase-footer-row-${flow}.png`,animations:'disabled'});
   }else assert.ok(same(await before.locator('#quickEntryForm').screenshot({animations:'disabled'}),await p.locator('#quickEntryForm').screenshot({animations:'disabled'})),`${width} ${flow}: desktop unchanged`);
   await p.locator('#cancelQuickEntry').press('Enter');assert.equal(await p.locator('#quickEntryModal').isVisible(),false);assert.equal(await p.evaluate(()=>window.qaWrites),0);
  }
  for(const flow of ['sales','income','expense']){await open(before,flow);await open(p,flow);assert.deepEqual(await snapshot(p,false),await snapshot(before,false),`${width} ${flow} unchanged`);}
  for(const p of pages)await p.close();console.log(`${width}x${height}: purchase actions share row, labels/actions fit; other flows and desktop unchanged`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
