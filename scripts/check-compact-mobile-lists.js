const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch({headless:true,args:['--disable-features=OverlayScrollbar,OverlayScrollbars'],...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
 try{for(const [width,height,platform='ios'] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900],[375,900,'android']]){
  const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:platform==='android'?'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='compact.test')return route.abort();if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});});
  await page.goto('http://compact.test/');await page.evaluate(()=>{
   const inventory=Array.from({length:30},(_,i)=>({id:'i'+i,name:i===29?'Tên <Hàng> '+ 'RấtDài'.repeat(12):'Cát nhật '+i,groupName:i%2?'Spa':'Cát vệ sinh',quantity:i===2?0:5,lastPrice:44000,salePrice:58000,totalCost:i===29?9999999999999:220000,updatedAt:'2026-10-11'}));
   const customers=Array.from({length:30},(_,i)=>({id:'c'+i,name:i===29?'Khách <An> '+ 'RấtDài'.repeat(12):'Khách '+i,phone:'09000000'+String(i).padStart(2,'0'),memberTier:i%2?'Vip':'Thường',createdAt:'2026-10-11T10:00:00Z'}));
   state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng thử',categories:{income:[],expense:[]},inventory,customers}]});
   authState.role='admin';authState.ready=true;authState.profile={role:'admin'};authState.user={uid:'admin'};cloudStore.enabled=false;els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('sales');render();window.__before=JSON.stringify(state);
  });
  for(const [id,searchId,itemSelector,open,close,update] of [
   ['customersPage','customerSearchInput','.customer-card','openCustomersPage()','hideCustomersPage({restoreFocus:false})','updateCustomersViewport()'],
   ['salesCatalogPage','salesCatalogSearch','.goods-catalog-item','openSalesOrderModal(getActiveStore());els.salesCustomerName.value="Khách đang soạn";els.salesCustomerPhone.value="0900123456";openSalesCatalogPage(els.salesItems.querySelector(".sales-item-row"))','hideSalesCatalogPage({restoreFocus:false});closeQuickEntryModal()','updateSalesCatalogViewport()'],
   ['inventoryModal','inventorySearch','.inventory-item','openInventoryModal()','closeInventoryModal()','updateInventoryViewport()']
  ]){
   await page.evaluate(code=>eval(code),open);const layer=page.locator('#'+id),search=page.locator('#'+searchId);
   assert.equal(await layer.isVisible(),true);await search.click();
   await search.fill(id==='customersPage'?'khach':'cat');assert.ok(await layer.locator(itemSelector).count()>=15);
   if(width<700){
    assert.equal(await search.evaluate(el=>getComputedStyle(el).fontSize),'16px');
    await page.evaluate(code=>{window.__nativeViewport=window.visualViewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:400,width:innerWidth,offsetTop:40,offsetLeft:0,scale:1}});eval(code);},update);
    assert.equal(await layer.evaluate(el=>el.classList.contains('mobile-list-short')),true);
    const frame=await layer.boundingBox(),field=await search.boundingBox();assert.ok(frame.y>=40&&frame.y+frame.height<=440,'page follows visual keyboard viewport');assert.ok(field.y>=frame.y&&field.y+field.height<=frame.y+frame.height,'search remains visible');
    const first=await layer.locator(itemSelector).first().boundingBox();assert.ok(first.y>=frame.y&&first.y+first.height<=frame.y+frame.height,'one entire result is visible without scrolling with keyboard');
    if(process.env.CUSTOMER_TEST_SHOTS&&width===375&&height===900&&platform==='ios')await page.screenshot({path:path.join(process.env.CUSTOMER_TEST_SHOTS,`compact-${id}-keyboard.png`)});
    await page.evaluate(code=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:window.__nativeViewport});eval(code);},update);
   }
   await search.fill('');
   for(const node of await layer.locator('input:visible,select:visible,button:visible,'+itemSelector).all()){
    const rect=await node.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1,'controls do not overflow '+id+' '+width);
    assert.ok(await node.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'content fits '+id+' '+width);
   }
   const owners=await layer.evaluate(el=>[el,...el.querySelectorAll('*')].filter(n=>['auto','scroll'].includes(getComputedStyle(n).overflowY)&&n.scrollHeight>n.clientHeight+2&&n.getBoundingClientRect().height>0).map(n=>n.id));assert.deepEqual(owners,[id],'only page owns scrolling');
   await layer.evaluate(el=>el.scrollTop=0);const frame=await layer.boundingBox();await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2);await page.mouse.wheel(0,500);await page.waitForFunction(id=>document.getElementById(id).scrollTop>0,id);
   await layer.evaluate(el=>el.scrollTop=0);await search.fill('not found');assert.equal(await layer.locator(itemSelector).count(),0);await search.fill('');
   if(id==='customersPage'){
    const edit=layer.locator('[data-edit-customer="c0"]:visible');await edit.click();assert.equal(await page.locator('#customerNameInput').inputValue(),'Khách 0');await page.locator('#customerNameInput').fill('Đang sửa');await page.locator('#cancelCustomerForm').click();
    await layer.locator('[data-customer-history="c0"]:visible').click();assert.equal(await page.locator('#customerHistoryModal').isVisible(),true);await page.locator('#closeCustomerHistory').click();
    await layer.locator('[data-open-customer-orders="c0"]').click();assert.equal(await page.locator('#customerHistoryTitle').textContent(),'Đơn hàng đã hoàn thành');await page.locator('#closeCustomerHistory').click();
   }else if(id==='salesCatalogPage'){
    assert.equal(await layer.locator('[data-select-sales-catalog-item="i2"]').isDisabled(),true);
    await layer.locator('[data-select-sales-catalog-item="i0"]').click();await page.waitForFunction(()=>els.salesCatalogPage.hidden);assert.equal(await page.locator('#salesCustomerName').inputValue(),'Khách đang soạn');assert.equal(await page.locator('#salesCustomerPhone').inputValue(),'0900123456');assert.equal(await page.locator('[data-sales-item="name"]').first().inputValue(),'Cát nhật 0');
   }else{
    assert.equal(await layer.locator('[data-export-inventory="i2"]').isDisabled(),true);
    await layer.locator('[data-export-inventory="i0"]').click();assert.equal(await page.locator('#exportInventoryModal').isVisible(),true);await page.locator('#cancelExportInventory').click();
   }
   await page.evaluate(code=>eval(code),close);
   await page.evaluate(()=>window.history.replaceState(null,'','/'));
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),await page.evaluate(()=>window.__before),'searching and navigating never writes data');assert.deepEqual(errors,[]);await page.close();console.log(`Compact ${platform} ${width}x${height}: 3 pages, keyboard viewport, full visible result, search/empty, edit/history/select/export, draft preserved, bounds and one-scroll OK`);
 }}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
