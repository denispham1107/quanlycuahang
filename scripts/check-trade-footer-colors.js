const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {setup}=require('./check-desktop-trade-colors');
const {PNG}=require('pngjs');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ids=['cancelQuickEntry','openOrderDiscount','saveSalesDraft','quickEntrySubmit'];
const palettes=[['#fde6e8','#9c3d52'],['#f8edcf','#75581c'],['#e8e3f7','#59468a'],['#dcefe9','#22665a']];
function luminance(hex){const x=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return x[0]*.2126+x[1]*.7152+x[2]*.0722;}
function sameRaster(a,b){
  if(a.equals(b))return true;
  const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return false;
  // Allow sub-1% channel noise from native controls/compositing, not visual changes.
  for(let i=0;i<x.data.length;i++){if(Math.abs(x.data[i]-y.data[i])>2)return false;}
  return true;
}
async function snapshot(page,trade){return page.locator('#quickEntryForm').evaluate((form,{ids,trade})=>[form,...form.querySelectorAll('*')].map(e=>{
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {id:e.id,rect:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100),text:e.children.length?'':e.textContent,font:[s.fontSize,s.fontWeight,s.lineHeight],paint:trade&&ids.includes(e.id)?null:[s.backgroundImage,s.backgroundColor,s.color,s.borderColor,s.boxShadow]};
}),{ids,trade});}
async function open(page,flow){await page.evaluate(flow=>{
  closeQuickEntryModal();
  if(flow==='draft')openSalesOrderModal(getActiveStore(),getActiveStore().draftOrders[0]);
  else if(flow==='purchase-bulk')openBulkPurchaseModal(getActiveStore());
  else openQuickEntryModal(flow);
},flow);await page.waitForTimeout(300);await page.locator('#quickEntryForm').evaluate(e=>{
  e.getAnimations().forEach(a=>{if(a.effect.getTiming().iterations!==Infinity)a.finish();});
  document.activeElement?.blur();e.scrollTop=0;e.parentElement.scrollTop=0;window.scrollTo(0,0);
});}
async function main(){
  for(const [bg,ink] of palettes)assert.ok((luminance(bg)+.05)/(luminance(ink)+.05)>=4.5);
  const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{for(const [width,height,mobile] of [[320,700,true],[375,900,true],[430,900,true],[667,375,true],[375,400,true],[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false]].filter(v=>!process.env.FOOTER_TEST_WIDTH||v[0]===Number(process.env.FOOTER_TEST_WIDTH))){
    const pages=[];
    for(const old of [true,false]){
      const p=await browser.newPage({viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:ua}:{})});await p.clock.setFixedTime(new Date('2026-10-15T12:00:00'));await setup(p,old);
      await p.evaluate(()=>{
        window.qaWrites=0;window.qaSaves=[];
        saveStateToCloud=()=>{window.qaWrites++;};
        saveSalesOrder=()=>{window.qaSaves.push('sales');return false;};
        saveSalesDraft=()=>{window.qaSaves.push('draft');return false;};
        savePurchaseOrder=()=>{window.qaSaves.push('purchase');return false;};
        saveBulkPurchaseOrder=()=>{window.qaSaves.push('purchase-bulk');return false;};
        addEntry=(type)=>{window.qaSaves.push(type);return false;};
        getActiveStore().categories={income:[{id:'i',name:'Thu thử'}],expense:[{id:'e',name:'Chi thử'}]};
      });pages.push(p);
    }
    const [before,page]=pages;
    for(const flow of ['sales','draft','purchase','purchase-bulk','income','expense']){
      await open(before,flow);await open(page,flow);
      const trade=!['income','expense'].includes(flow);
      const desktopCash=!trade&&!mobile;
      const changed=trade||desktopCash;
      assert.deepEqual(await snapshot(page,changed),await snapshot(before,changed),`${width} ${flow}: geometry, labels, fonts, other paints`);
      if(changed){
        const paint=await page.locator('#quickEntryForm .modal-actions > button').evaluateAll(es=>es.filter(e=>!e.hidden&&e.id!=='deleteSalesDraft').map(e=>{
          const s=getComputedStyle(e),r=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect();
          return {id:e.id,bg:s.backgroundColor,fg:s.color,highlight:s.backgroundImage,line:s.boxShadow,inside:t.left>=r.left-1&&t.right<=r.right+1&&t.top>=r.top-1&&t.bottom<=r.bottom+1,width:r.width};
        }));
        for(const x of paint){const i=desktopCash&&x.id==='quickEntrySubmit'?2:ids.indexOf(x.id);const rgb=h=>'rgb('+h.slice(1).match(/../g).map(v=>parseInt(v,16)).join(', ')+')';assert.equal(x.bg,rgb(palettes[i][0]));assert.equal(x.fg,rgb(palettes[i][1]));assert.ok(x.highlight.includes('175deg'));assert.ok(x.inside,`${width} ${flow} ${x.id}: label fits`);}
        if(flow==='sales'||flow==='draft'){
          await page.locator('#openOrderDiscount').press('Enter');assert.equal(await page.locator('#orderDiscountModal').isVisible(),true);await page.locator('#cancelOrderDiscount').click();
          await page.locator('#saveSalesDraft').press('Space');assert.ok((await page.evaluate(()=>window.qaSaves)).includes('draft'));
        }
        await page.locator('#quickEntrySubmit').evaluate(e=>e.disabled=true);assert.equal(await page.locator('#quickEntrySubmit').isDisabled(),true);await page.locator('#quickEntrySubmit').evaluate(e=>e.disabled=false);
        await page.locator('#quickEntrySubmit').press('Enter');assert.ok((await page.evaluate(()=>window.qaSaves)).includes(flow==='draft'?'sales':flow));
        if(width===375&&flow==='sales'||width===1440&&flow==='purchase')await page.screenshot({path:`C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/applied-pearl-footer-${width}-${flow}.png`});
      }else {
        const previous=await before.locator('#quickEntryForm').screenshot({animations:'disabled'}),current=await page.locator('#quickEntryForm').screenshot({animations:'disabled'});
        if(!sameRaster(previous,current)){
          require('node:fs').writeFileSync(`C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/footer-baseline-${width}-${flow}.png`,previous);
          require('node:fs').writeFileSync(`C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/footer-current-${width}-${flow}.png`,current);
        }
        assert.ok(sameRaster(previous,current),`${width} ${flow}: unchanged pixels`);
      }
      await page.locator('#cancelQuickEntry').press('Enter');assert.equal(await page.locator('#quickEntryModal').isVisible(),false);
      assert.equal(await page.evaluate(()=>window.qaWrites),0);
    }
    for(const p of pages)await p.close();console.log(`${width}x${height}: trade states, Thu/Chi ${mobile?'unchanged':'pearl colors'}, labels/geometry/contrast/handlers/disabled OK`);
  }}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
