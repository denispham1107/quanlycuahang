const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {setup}=require('./check-desktop-trade-colors');
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const note='Gói riêng cho khách\nKhông trộn món <b> & "test"';
async function open(p){await p.evaluate(()=>{closeQuickEntryModal();openQuickEntryModal('sales');});await p.locator('#quickEntryForm').evaluate(e=>{e.getAnimations().forEach(a=>a.finish());document.activeElement?.blur();e.parentElement.scrollTop=0;scrollTo(0,0);});}
async function fields(p){return p.locator('#quickEntryForm').evaluate(f=>[...f.querySelectorAll('input,select,button')].filter(e=>!e.matches('.sales-note-toggle')).map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {key:e.id||e.getAttribute('data-sales-item')||e.className,width:r.width,height:r.height,paint:[s.backgroundImage,s.color,s.borderColor,s.boxShadow],font:s.fontSize};}));}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const [width,height,mobile] of [[320,700,true],[375,900,true],[430,900,true],[667,375,true],[375,400,true],[800,1000,true],[800,900,false],[1024,900,false],[1440,1000,false],[1920,1080,false]]){
  const pages=[];for(const old of [true,false]){const p=await browser.newPage({viewport:{width,height},...(mobile?{isMobile:true,hasTouch:true,userAgent:ua}:{})});await p.clock.setFixedTime(new Date('2026-10-16T12:00:00'));await setup(p,old);await p.evaluate(()=>{window.qaWrites=0;saveStateToCloud=()=>window.qaWrites++;});await open(p);pages.push(p);}
  const [old,p]=pages;assert.deepEqual(await fields(p),await fields(old),'existing controls preserve dimensions and paint');
  const input=p.locator('[data-sales-item="note"]').first(),toggle=p.locator('[data-toggle-sales-note]').first();
  assert.equal(await input.isVisible(),mobile);assert.equal(await toggle.isVisible(),!mobile);
  if(!mobile){await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(await input.isVisible(),true);}
  await input.fill(note);await p.locator('[data-sales-item="name"]').first().fill('Cát nhật');await p.locator('[data-sales-item="price"]').first().fill('58000');await p.locator('#salesCustomerName').fill('Khách thử ghi chú');
  if(!mobile){await toggle.press('Enter');assert.equal(await input.isVisible(),false);assert.equal(await input.inputValue(),note);await toggle.press('Space');assert.equal(await input.isVisible(),true);}
  const order=await p.evaluate(()=>getSalesOrderItems());assert.equal(order[0].note,note);assert.equal(order[0].total,58000);
  await p.locator('#addSalesItem').click();const second=p.locator('[data-sales-item="note"]').nth(1);if(!mobile)await p.locator('[data-toggle-sales-note]').nth(1).click();await second.fill('Chỉ ghi chú cho món thứ hai');assert.equal(await input.inputValue(),note);
  const bounds=await input.evaluate(e=>{const n=e.getBoundingClientRect(),q=e.closest('.sales-item-row').querySelector('.quantity-stepper').getBoundingClientRect(),r=e.closest('.sales-item-row').getBoundingClientRect();return {x:n.x,right:n.right,bottom:n.bottom,rowBottom:r.bottom,below:n.y>=q.bottom};});assert.ok(bounds.x>=0&&bounds.right<=width+1&&bounds.bottom<=bounds.rowBottom+1);assert.equal(bounds.below,true);
  await p.locator('#salesItems [data-remove-sales-item]').last().click();assert.equal(await input.inputValue(),note);
  if(width===375&&height===900||width===1440)await p.screenshot({path:`C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/sales-item-note-form-${width}.png`,animations:'disabled'});
  await p.locator('#saveSalesDraft').click();const id=await p.evaluate(()=>getActiveStore().draftOrders.at(-1).id);assert.equal(await p.evaluate(id=>getActiveStore().draftOrders.find(d=>d.id===id).items[0].note,id),note);
  await p.evaluate(id=>{state=normalizeState(JSON.parse(JSON.stringify(state)));render();openSalesDraft(id);},id);assert.equal(await p.locator('[data-sales-item="note"]').first().inputValue(),note);assert.equal(await p.locator('[data-sales-item="note"]').first().isVisible(),true,'saved note is visible when reopening draft');
  await p.locator('#quickEntrySubmit').click();assert.equal(await p.locator('#quickEntryModal').isVisible(),false);const completed=await p.evaluate(()=>getActiveStore().orders.at(-1));assert.equal(completed.items[0].note,note);assert.equal(completed.total,58000);
  await p.evaluate(id=>openSalesOrderDetail(id),completed.id);const display=p.locator('.order-detail-product-note').first();assert.equal(await display.textContent(),note);assert.equal(await display.locator('b').count(),0,'note is text, not HTML');assert.equal(await display.evaluate(e=>e.parentElement.classList.contains('order-detail-product-name')),true);
  const fit=await display.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1;});assert.ok(fit);
  if(width===375&&height===900||width===1440)await p.screenshot({path:`C:/Users/HP/.codex/visualizations/2026/07/14/019f60d2-3ec4-7110-bb38-fd10c4af6926/sales-item-note-detail-${width}.png`,animations:'disabled'});
  await p.locator('#closeSalesOrderDetail').click();await p.evaluate(()=>{openQuickEntryModal('purchase');});assert.equal(await p.locator('#purchaseItems .sales-item-note,#purchaseItems .sales-note-toggle').count(),0,'purchase unchanged');
  for(const q of pages)await q.close();console.log(`${width}x${height} ${mobile?'Mobile':'Desktop'}: note layout/toggle/keyboard, independent values, draft/JSON/completion/detail escaping OK`);
 }
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
