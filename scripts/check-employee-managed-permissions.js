const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {applyEmployeeInventoryExport,applyEmployeeCustomerSave}=require('../functions/employee-managed-mutations');
async function main() {
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
  try {for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
    const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
    const errors=[],alerts=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>{alerts.push(dialog.message());return dialog.accept();});
    await page.route('**/*',route=> {
      const url=new URL(route.request().url());if(url.hostname!=='permissions.test')return route.abort();
      if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});
      const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
      return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
    });
    const stamp='2026-10-07T01:00:00.000Z';
    const store={id:'a',name:'Cửa hàng thử',categories:{income:[],expense:[]},entries:[],orders:[],customers:[{id:'customer0',name:'An',phone:'0123',memberTier:'Thường',createdAt:stamp,updatedAt:stamp}],inventory:[{id:'stock0',name:'Cát nhật',groupName:'Cát',quantity:5,totalCost:50000,lastPrice:10000,salePrice:16000,updatedAt:stamp}],inventoryLogs:[],exportReasons:['Hỏng']};
    const user={uid:'employee',profile:{role:'employee',storeId:'a',displayName:'Nhân viên',permissions:{purchase:{inventoryExport:true},sales:{customerManage:true}}}};
    let calls=0;await page.exposeFunction('__saveEmployeeMutation',mutation=> {
      calls++;const activity=(user,area,message,target)=>({id:'activity'+calls,actorUid:user.uid,area,message,...target});
      if(mutation.type==='inventory-export')applyEmployeeInventoryExport(store,mutation,user,()=> 'log'+calls,activity);
      else if(mutation.type==='customer-save')applyEmployeeCustomerSave(store,mutation.customer,user,()=> 'customer'+calls,activity);
      else throw new Error('Unexpected mutation');
      return {state:{activeStoreId:'a',stores:[structuredClone(store)]}};
    });
    await page.goto('http://permissions.test/');
    await page.evaluate(store=> {
      state=normalizeState({activeStoreId:'a',stores:[store]});authState.role='admin';authState.ready=true;authState.profile={role:'admin'};authState.user={uid:'admin'};
      cloudStore.enabled=false;loadEmployeeAccounts=async()=>{};els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('sales');render();
      openEmployeeManagerPage();renderEmployeeAccounts({stores:[{id:'a',name:'Cửa hàng thử'}],employees:[{uid:'employee',storeId:'a',displayName:'Nhân viên',permissions:{purchase:{inventoryView:true},sales:{view:true}}}]});
    },store);
    for(const name of ['purchaseInventoryExport','salesCustomerManage'])assert.equal(await page.locator(`#employeeCreateForm [name="${name}"]`).isChecked(),false);
    await page.locator('#employeeCreateForm [name="purchaseInventoryExport"]').check();
    assert.equal(await page.locator('#employeeCreateForm [name="purchaseInventoryView"]').isChecked(),true);
    await page.locator('#employeeCreateForm [name="salesCustomerManage"]').check();
    assert.equal(await page.locator('#employeeCreateForm [name="salesView"]').isChecked(),true);
    assert.equal(await page.locator('.employee-account-card [name="salesCustomerManage"]').count(),1);
    assert.equal(await page.evaluate(()=>document.getElementById('employeeManagerPage').scrollWidth>innerWidth+1),false);
    if(process.env.EMPLOYEE_TEST_SHOTS&&[375,1440].includes(width)&&height===900)await page.screenshot({path:path.join(process.env.EMPLOYEE_TEST_SHOTS,`employee-permissions-${width}.png`)});
    await page.evaluate(()=> {
      hideEmployeeManagerPage({restoreFocus:false});authState.role='employee';authState.profile={role:'employee',storeId:'a',permissions:{purchase:{inventoryView:true},sales:{view:true}}};authState.user={uid:'employee'};render();openInventoryModal();
    });
    assert.equal(await page.locator('[data-export-inventory]').count(),0);
    assert.equal(await page.evaluate(()=>{openExportInventoryModal('stock0');return els.exportInventoryModal.hidden;}),true);
    assert.equal(await page.evaluate(()=>{openCustomersPage();return els.customersPage.hidden;}),true);
    await page.evaluate(()=> {
      closeInventoryModal();authState.profile.permissions={purchase:{inventoryExport:true},sales:{customerManage:true}};cloudStore.enabled=true;cloudStore.docRef={};
      callEmployeeFunction=async(name,body)=>window.__saveEmployeeMutation(body.mutation);render();openInventoryModal();
    });
    assert.equal(await page.locator('[data-export-inventory]').count(),1);assert.equal(await page.locator('[data-edit-inventory]').count(),0);
    await page.locator('[data-export-inventory]').click();
    assert.equal(await page.locator('#toggleExportInventoryReason').isVisible(),false);
    await page.locator('#exportInventoryDate').fill('2026-10-07');await page.locator('#exportInventoryQuantity').fill('2');await page.locator('#exportInventoryReason').selectOption('Hỏng');
    if(process.env.EMPLOYEE_TEST_SHOTS&&[375,1440].includes(width)&&height===900)await page.screenshot({path:path.join(process.env.EMPLOYEE_TEST_SHOTS,`employee-export-${width}.png`)});
    await page.locator('#exportInventoryForm [type="submit"]').click();await page.waitForFunction(()=>els.exportInventoryModal.hidden);
    assert.equal(store.inventory[0].quantity,3);assert.equal(store.inventory[0].totalCost,30000);assert.equal(store.inventoryLogs.length,1);
    await page.evaluate(()=>{closeInventoryModal();openCustomersPage();openCustomerById('customer0');});
    await page.locator('#customerNameInput').fill('An đã sửa');await page.locator('#customerForm [type="submit"]').click();await page.waitForFunction(()=>els.customerForm.hidden);
    assert.equal(store.customers[0].name,'An đã sửa');
    await page.locator('#toggleCustomerForm').click();await page.locator('#customerNameInput').fill('Bình');await page.locator('#customerPhoneInput').fill('0987');
    await page.locator('#customerForm [type="submit"]').click();await page.waitForFunction(()=>els.customerForm.hidden);
    assert.equal(store.customers.length,2);assert.equal(await page.locator('[data-delete-customer]').count(),0);
    await page.evaluate(()=>openCustomerById('customer0'));await page.locator('#customerNameInput').fill('Không được lưu');user.profile.permissions.sales.customerManage=false;
    await page.locator('#customerForm [type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#customerForm [type="submit"]').disabled);
    assert.equal(store.customers[0].name,'An đã sửa');assert.equal(await page.locator('#customerForm').isVisible(),true);assert.equal(await page.locator('#customerNameInput').inputValue(),'Không được lưu');
    assert.ok(alerts.some(text=>text.includes('PERMISSION_DENIED')));assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden');
    assert.equal(await page.evaluate(()=>els.customersPage.scrollWidth>innerWidth+1),false);
    await page.close();console.log(`Employee rights, export, customer add/edit, revoked rights and layout ${width}x${height}: OK`);
  }} finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
