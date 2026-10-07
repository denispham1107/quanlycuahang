const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {getCashEntrySuggestions}=require('../functions/cash-entry-suggestions');
const {getEmployeeOverviewSales}=require('../functions/employee-overview');
const {applyClosingBookMutation}=require('../functions/closing-book-mutation');
const permissions={closingBook:{manage:true},sales:{view:false,draft:false},purchase:{view:false},history:{viewOwn:false}};
const user={uid:'staff-test',profile:{role:'employee',active:true,storeId:'a',displayName:'Nhân viên thử',permissions}};
const source=fs.readFileSync(path.join(__dirname,'../functions/index.js'),'utf8');
const context={getCashEntrySuggestions,getEmployeeOverviewSales,normalizeEmployeeStoreSalesBills:()=>{},getEmployeeStoreIds:(_,profile)=>[profile.storeId],normalizeEmployeePermissions:()=>permissions};
vm.runInNewContext(source.slice(source.indexOf('function sanitizeEmployeeState('),source.indexOf('function createEmployeeActivity(')),context);
async function main() {
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
  try {
    for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
      const store={id:'a',name:'Cửa hàng được gán',categories:{income:[{id:'i',name:'Thu khác'}],expense:[{id:'e',name:'Lương NV'}]},closingMonths:[],entries:[
        {id:'admin-i',type:'income',note:'Anh thêm',amount:200000,categoryId:'i',date:'2026-10-01',createdAt:'2026-10-01T00:00:00Z'},
        {id:'admin-e',type:'expense',note:'Tại nhà Ngọc',amount:125000,categoryId:'e',date:'2026-10-01',createdAt:'2026-10-01T00:00:00Z'}
      ]};
      const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.exposeFunction('staffFixtureRequest',(name,mutation)=> {
        if(name==='saveMutationUrl')applyClosingBookMutation(store,mutation,user,()=>String(Date.now()));
        return {state:context.sanitizeEmployeeState({stores:[store]},user),profile:user.profile};
      });
      await page.route('**/*',route=> {
        const url=new URL(route.request().url());if(url.hostname!=='staff-suggestions.test')return route.abort();
        if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});
        const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
        return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
      });
      await page.goto('http://staff-suggestions.test/');
      await page.evaluate(async()=> {
        const result=await staffFixtureRequest('getStateUrl');authState.role='employee';authState.ready=true;authState.user={uid:'staff-test'};authState.profile=result.profile;
        callEmployeeFunction=(name,body={})=>staffFixtureRequest(name,body.mutation);
        cloudStore.enabled=true;cloudStore.docRef={set:()=>{throw new Error('Staff cannot write state directly');}};
        state=normalizeState(result.state);els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();
      });
      assert.equal(await page.evaluate(()=>getActiveStore().entries.length),0,'Admin financial history is not exposed');
      await page.locator('#openClosingBookEmployee').click();
      await page.locator('#closingBookNewMonth').fill('09/2026');await page.locator('#closingBookCreateMonth button').click();await page.waitForFunction(()=>!closingBook.page.inert);
      for(const [type,partial,note,amount,category] of [['income','Anh','Anh thêm','200.000','i'],['expense','tai nha','Tại nhà Ngọc','125.000','e']]) {
        const input=page.locator(`[data-book-note="${type}"]`);await input.fill(partial);
        const button=page.locator(`[data-book-group="${type}"] [data-book-suggestion]`).first();
        assert.equal(await button.isVisible(),true,`Staff partial suggestion ${type}`);
        await page.waitForTimeout(400);
        assert.match(await button.innerText(),new RegExp(amount.replace('.','\\.')));
        const boxes=await page.locator('.book-note-suggestions:not([hidden]) button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));
        assert.ok(boxes.every(r=>r.left>=0&&r.right<=width+1),`Suggestion fits ${width}x${height}`);
        assert.ok(boxes.every(r=>r.top>=0&&r.bottom<=height+1),`Suggestion is visible above the keyboard ${width}x${height}: ${JSON.stringify(boxes)}`);
        if(process.env.INVENTORY_TEST_SHOTS&&type==='expense'&&[375,1440].includes(width)&&height===900) await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`staff-cash-suggestions-${width}.png`)});
        if(type==='expense') {await input.press('ArrowDown');await page.keyboard.press('Enter');} else await button.click();
        assert.equal(await input.inputValue(),note);assert.equal(await page.locator(`[data-book-amount="${type}"]`).inputValue(),amount);assert.equal(await page.locator(`[data-book-category="${type}"]`).inputValue(),category);
      }
      await page.locator('#closingBookForm button[type="submit"]').click();await page.waitForFunction(()=>!closingBook.page.inert);
      for(const type of ['income','expense']) {
        await page.locator(`[data-book-details="${type}"]`).click();await page.waitForFunction(()=>!closingBook.page.inert);
        await page.locator('[data-detail-transfer]').first().click();await page.waitForFunction(()=>!closingBook.page.inert);
        await page.locator('#closeClosingBookDetail').click();
      }
      assert.equal(store.entries.length,4,'Both suggested rows transfer through the real employee mutation validator');
      assert.equal(store.entries.find(e=>e.closingBookRowId&&e.type==='expense').categoryId,'e');
      assert.equal(store.entries[0].id,'admin-i','Original admin entries remain unchanged');
      assert.deepEqual(errors,[]);await page.close();console.log(`Staff shared admin suggestions, keyboard/pointer selection and transfer ${width}x${height}: OK`);
    }
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
