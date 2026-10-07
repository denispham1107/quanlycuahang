const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {deleteManagedEmployees}=require('../functions/employee-account-deletion');
const {createDeletionFixture}=require('./employee-deletion-fixture');
async function main(){
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
  try{for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]){
    const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
    const errors=[],dialogs=[];let accept=false,networkFailure=false,calls=0;
    page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>{dialogs.push(dialog.message());return accept?dialog.accept():dialog.dismiss();});
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.hostname!=='deletion.test')return route.abort();
      if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});
      const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
      return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
    });
    const fixture=createDeletionFixture([{uid:'a',displayName:'An'},{uid:'b',displayName:'Bình có tên dài để kiểm tra bố cục trên điện thoại'}]),business=structuredClone(fixture.business);
    await page.exposeFunction('__deleteFixture',async body=>{calls++;assert.equal(body.action,'delete');if(networkFailure)throw new Error('Không kết nối được Firebase thử nghiệm');await new Promise(resolve=>setTimeout(resolve,100));return {ok:true,...await deleteManagedEmployees({...fixture,uids:body.uids}),...fixture.list()};});
    await page.goto('http://deletion.test/');await page.evaluate(payload=>{
      state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng kiểm thử',categories:{income:[],expense:[]}}]});
      authState.role='admin';authState.ready=true;authState.profile={role:'admin'};authState.user={uid:'admin'};cloudStore.enabled=false;
      loadEmployeeAccounts=async()=>{};callEmployeeFunction=async(name,body)=>window.__deleteFixture(body);
      els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');render();openEmployeeManagerPage();renderEmployeeAccounts(payload);
    },fixture.list());
    const selected=uid=>page.locator(`[data-select-employee][value="${uid}"]`);
    assert.equal(await page.locator('#deleteSelectedEmployees').isDisabled(),true);
    await selected('b').check();assert.equal(await page.locator('#employeeSelectionCount').textContent(),'Đã chọn 1 nhân viên');
    assert.equal(await page.locator('#employeeSelectAll').evaluate(input=>input.indeterminate),true);
    await page.locator('#deleteSelectedEmployees').click();assert.equal(calls,0);assert.equal(fixture.profiles.size,2);assert.equal(await selected('b').isChecked(),true);
    assert.ok(dialogs[0].includes('không thể hoàn tác'));assert.ok(dialogs[0].includes('Giao dịch và lịch sử cũ'));
    await page.locator('#employeeSelectAll').check();assert.equal(await selected('a').isChecked(),true);
    await selected('a').uncheck();await selected('a').check();
    if(process.env.EMPLOYEE_TEST_SHOTS&&[375,1440].includes(width)&&height===900){
      await page.locator('#employeeDeleteToolbar').evaluate(toolbar=>toolbar.closest('.settings-detail-page').scrollTop+=toolbar.getBoundingClientRect().top-100);
      await page.screenshot({path:path.join(process.env.EMPLOYEE_TEST_SHOTS,`employee-deletion-${width}.png`)});
    }
    const bounds=await page.evaluate(()=>{
      const page=els.employeeManagerPage;
      const controls=[...page.querySelectorAll('#employeeDeleteToolbar input,#employeeDeleteToolbar button,#employeeSelectionCount,.employee-card-select-row input')].map(element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};});
      const checkboxSizes=[...page.querySelectorAll('.employee-select-control input')].map(input=>({width:input.getBoundingClientRect().width,height:input.getBoundingClientRect().height}));
      return {overflow:page.scrollWidth>innerWidth+1,rootOverflow:getComputedStyle(document.documentElement).overflowY,controls,checkboxSizes,width:innerWidth};
    });assert.equal(bounds.overflow,false);assert.equal(bounds.rootOverflow,'hidden');for(const r of bounds.controls){assert.ok(r.left>=0&&r.right<=bounds.width+1,JSON.stringify({width,height,r}));assert.ok(r.width>=19);}
    for(const size of bounds.checkboxSizes){assert.equal(size.width,20);assert.equal(size.height,20);}
    await page.locator('[data-employee-uid="a"] [name="displayName"]').fill('An đang sửa');networkFailure=true;accept=true;
    await page.locator('#deleteSelectedEmployees').click();await page.waitForFunction(()=>!employeeManagerState.deleting);
    assert.equal(await page.locator('[data-employee-uid="a"] [name="displayName"]').inputValue(),'An đang sửa');assert.equal(await selected('a').isChecked(),true);assert.equal(fixture.profiles.size,2);
    networkFailure=false;fixture.authFailures.add('b');await page.locator('#deleteSelectedEmployees').click();await page.waitForFunction(()=>!employeeManagerState.deleting);
    assert.equal(await selected('a').count(),0);assert.equal(await selected('b').isChecked(),true);assert.equal(await page.locator('[data-employee-uid="b"] [data-save-employee]').isDisabled(),true);
    assert.ok((await page.locator('#employeeDeleteStatus').textContent()).includes('Bình có tên dài'));assert.equal(fixture.profiles.get('b').active,false);
    fixture.authFailures.clear();await page.locator('#deleteSelectedEmployees').click();await page.waitForFunction(()=>!employeeManagerState.deleting);
    assert.equal(fixture.accounts.size,0);assert.equal(fixture.profiles.size,0);assert.deepEqual(fixture.business,business);assert.equal(await page.locator('#employeeDeleteToolbar').isVisible(),false);
    assert.equal(await page.locator('#employeeAccountList .empty-list').count(),1);
    const before=calls;await page.evaluate(async()=>{hideEmployeeManagerPage({restoreFocus:false});authState.role='employee';authState.profile={role:'employee'};openEmployeeManagerPage();await deleteSelectedEmployeeAccounts();});
    assert.equal(calls,before);assert.equal(await page.locator('#employeeManagerPage').isVisible(),false);assert.deepEqual(errors,[]);
    await page.close();console.log(`Employee selection, cancellation, partial failure, retry, admin-only and layout ${width}x${height}: OK`);
  }}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
