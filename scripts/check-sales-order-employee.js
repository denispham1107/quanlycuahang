const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
 try{for(const [width,height,platform='ios'] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900],[375,900,'android']]){
  const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:platform==='android'?'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='seller.test')return route.abort();if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});});
  await page.goto('http://seller.test/');await page.evaluate(()=>{
   const base={date:today,createdAt:new Date().toISOString(),customerName:'Khách hàng thử',customerPhone:'0123456789',total:200500,subtotal:200500,items:[{name:'Hàng thử',quantity:1,price:200500,total:200500}]};
   window.__seller='Nhân viên Nguyễn Thị <Hồng> '+ 'TênRấtDài'.repeat(12);
   state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng thử',categories:{income:[],expense:[]},orders:[{...base,id:'known',createdByUid:'worker',createdByName:window.__seller},{...base,id:'legacy'},{...base,id:'unknown',status:'cancelled'}],inventory:[{id:'stock',name:'Hàng thử',quantity:20,salePrice:200500,lastPrice:100000,totalCost:2000000}],activityHistory:[{action:'create',targetType:'sales-order',targetId:'legacy',actorName:'Nhân viên cũ'},{action:'delete',targetType:'sales-order',targetId:'unknown',actorName:'Người hủy'}]}]});
   authState.role='admin';authState.ready=true;authState.profile={role:'admin',displayName:'Admin hoàn thành'};authState.user={uid:'admin'};cloudStore.enabled=false;els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('sales');render();renderSalesOrderTable(els.salesOrderTable,getActiveStore().orders);
  });
  assert.equal(await page.locator('.sales-history-table th').first().textContent(),'Nhân viên');assert.equal(await page.locator('#salesOrderTable tr').first().locator('td').count(),7);
  for(const [id,name] of [['known',await page.evaluate(()=>window.__seller)],['legacy','Nhân viên cũ'],['unknown','Chưa ghi nhận']]){
   const row=page.locator(`[data-open-sales-order="${id}"]`);assert.equal(await row.locator('td').first().textContent(),name);await row.scrollIntoViewIfNeeded();
   const bounds=await row.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,`history row within horizontal viewport ${width}: ${JSON.stringify(bounds)}`);
   for(const cell of await row.locator('td').all()){const measurement=await cell.evaluate(el=>({text:el.textContent,width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(measurement.scroll<=measurement.width+1,`${width}: history cell does not overflow: ${JSON.stringify(measurement)}`);}
   if(width<=700)assert.equal(await row.locator('td').first().evaluate(el=>getComputedStyle(el,'::before').content),'"Nhân viên"');
   await row.locator('.sales-bill-code').click();assert.equal(await page.locator('.order-detail-meta > div').count(),5);assert.equal(await page.locator('.order-detail-employee dd').textContent(),name);
   for(const field of await page.locator('.order-detail-meta > div').all()){await field.scrollIntoViewIfNeeded();const b=await field.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1,'detail metadata within horizontal viewport');}
   assert.equal(await page.locator('#salesOrderDetailContent img').count(),0,'seller name is escaped text');assert.equal(await page.evaluate(()=>els.salesOrderDetailModal.scrollWidth>innerWidth+1),false);
   if(id==='known'&&process.env.SELLER_TEST_SHOTS&&[375,800,1440].includes(width)&&height===900){await page.evaluate(()=>els.salesOrderDetailModal.scrollTop=0);await page.screenshot({path:path.join(process.env.SELLER_TEST_SHOTS,`seller-detail-${platform}-${width}.png`)});}
   await page.locator('#closeSalesOrderDetail').click();
  }
  if(process.env.SELLER_TEST_SHOTS&&[375,800,1440].includes(width)&&height===900){await page.locator('[data-open-sales-order="known"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.SELLER_TEST_SHOTS,`seller-history-${platform}-${width}.png`)});}
  await page.evaluate(()=>{openSalesOrderModal(getActiveStore());els.salesCustomerName.value='Khách mới';const row=els.salesItems.querySelector('.sales-item-row');row.querySelector('[data-sales-item="name"]').value='Hàng thử';row.querySelector('[data-sales-item="price"]').value='200500';});
  assert.equal(await page.evaluate(()=>saveSalesOrder()),true);const order=await page.evaluate(()=>{closeQuickEntryModal();return getActiveStore().orders.at(-1);});assert.equal(order.createdByName,'Admin hoàn thành');assert.equal(order.createdByUid,'admin');
  await page.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',displayName:'Người đang xem khác',storeId:'a',permissions:{sales:{view:true}}};render();renderSalesOrderTable(els.salesOrderTable,getActiveStore().orders);});assert.equal(await page.locator('[data-open-sales-order="known"] .sales-employee-name').textContent(),await page.evaluate(()=>window.__seller));
  await page.evaluate(()=>renderSalesOrderTable(els.salesOrderTable,[]));assert.equal(await page.locator('#salesOrderTable .empty-list').getAttribute('colspan'),'7');assert.equal(await page.locator('#salesOrderTable .empty-list').evaluate(el=>getComputedStyle(el,'::before').content),'none');
  assert.deepEqual(errors,[]);await page.close();console.log(`Seller ${platform} ${width}x${height}: snapshot/legacy/unknown, admin completion, employee viewer, escaped names, empty state and bounds OK`);
 }}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
