const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main(){
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
  try{for(const [width,height,platform='ios'] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900],[375,900,'android']]){
    const mobile=width<700,ua=platform==='android'?'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
    const page=await browser.newPage({viewport:{width,height},...(mobile?{userAgent:ua}:{})}),errors=[],alerts=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>{alerts.push(dialog.message());return dialog.accept();});
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.hostname!=='activity.test')return route.abort();
      if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});
      const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
      return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
    });
    await page.goto('http://activity.test/');
    await page.evaluate(()=>{
      const entries=['income','expense'].flatMap(type=>Array.from({length:24},(_,i)=>({id:type+i,type,note:`Khoản ${type==='income'?'thu':'chi'} ${i}`,amount:10000+i,categoryId:i%2?'c2':'c1',date:'2026-10-07',createdAt:`2026-10-07T${String(i).padStart(2,'0')}:00:00Z`,...(i===17?{status:'cancelled'}:{})})));
      const activityHistory=['income','expense'].flatMap(type=>[...Array.from({length:3},(_,i)=>({id:type+'activity'+i,area:type==='income'?'Thu':'Chi',action:i===2?'cancel':'create',message:`Kiểm thử lịch sử ${type} ${i}`,tab:type,targetType:'entry',targetId:type+(i===2?17:18),targetDate:'2026-10-07',createdAt:'2026-10-08T02:00:00Z',actorUid:'admin'})),{id:type+'deleted',area:type==='income'?'Thu':'Chi',tab:type,targetType:'entry',targetId:'deleted',targetDate:'2026-10-07',createdAt:'2026-10-08T02:00:00Z',actorUid:'admin',message:'Khoản đã xóa'},{id:type+'legacy',area:type==='income'?'Thu':'Chi',createdAt:'2026-10-07T18:00:00Z',actorUid:'admin',message:'Nhật ký cũ không có targetId'}]);
      state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng thử',entries,activityHistory,categories:{income:[{id:'c1',name:'Mục 1'},{id:'c2',name:'Mục 2'}],expense:[{id:'c1',name:'Mục 1'},{id:'c2',name:'Mục 2'}]}}]});
      authState.role='admin';authState.ready=true;authState.profile={role:'admin'};authState.user={uid:'admin'};cloudStore.enabled=false;
      els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();
    });
    for(const type of ['income','expense'])for(const [i,view] of ['','manage','report'].entries()){
      await page.evaluate(({type,view})=>{
        document.querySelector(`[data-tab-panel="${type}"]`).dataset.mobileFlowView=view;
        uiState.rangeMode='day';els.rangeMode.value='day';els.singleDate.value='2026-10-08';
        (type==='income'?els.incomeHistorySearch:els.expenseHistorySearch).value='không khớp';
        (type==='income'?els.incomeHistoryFilter:els.expenseHistoryFilter).value='c1';render();openActivityHistoryPage();
      },{type,view});
      const activity=page.locator(`[data-activity-id="${type}activity${i}"]`);
      if(i===1){await activity.focus();await page.keyboard.press('Enter');}else await activity.click();
      const targetId=type+(i===2?17:18),target=page.locator(`[data-tab-panel="${type}"] [data-entry-id="${targetId}"]`);
      await page.waitForFunction(id=>!!document.querySelector(`[data-entry-id="${id}"].activity-target-highlight`),targetId);
      assert.equal(await target.isVisible(),true,`${platform} ${width} ${type} ${view}: target history is expanded`);
      assert.equal(await page.locator('#activityHistoryPage').isVisible(),false);assert.equal(await page.evaluate(()=>els.appShell.inert),false);
      assert.equal(await page.evaluate(()=>els.singleDate.value),'2026-10-07');assert.equal(await page.locator(`#${type}HistorySearch`).inputValue(),'');assert.equal(await page.locator(`#${type}HistoryFilter`).inputValue(),'all');
      if(mobile)assert.equal(await page.locator(`[data-tab-panel="${type}"]`).getAttribute('data-mobile-flow-view'),view==='report'?'report-history':'history');
      if(mobile&&view==='report')assert.equal(await page.locator(`[data-tab-panel="${type}"] [data-mobile-flow-panel="report"]`).isVisible(),true);
      await page.waitForFunction(id=>{
        const r=document.querySelector(`[data-entry-id="${id}"]`).getBoundingClientRect();
        const mobile=document.documentElement.classList.contains('mobile-app-theme'),dock=document.querySelector('#tabBar').getBoundingClientRect();
        const filter=document.querySelector('#timeFilterToggle'),top=mobile&&!filter.hidden?filter.getBoundingClientRect().bottom:0;
        const now=performance.now(),last=window.__activityRowPosition;
        if(!last||last.id!==id||Math.abs(last.top-r.top)>0.5){window.__activityRowPosition={id,top:r.top,since:now};return false;}
        const bottom=mobile?dock.top-1:innerHeight-12,tooTall=r.height>bottom-top-2;
        return now-last.since>120&&r.top>=top+1&&(tooTall?r.top<=top+4:r.bottom<=bottom);
      },targetId);
      if(process.env.ACTIVITY_TEST_SHOTS&&i===0&&type==='expense'&&[375,1440].includes(width)&&[400,900].includes(height))await page.screenshot({path:path.join(process.env.ACTIVITY_TEST_SHOTS,`activity-cash-${platform}-${width}-${height}.png`)});
    }
    for(const type of ['income','expense']){
      await page.evaluate(type=>{document.querySelector(`[data-tab-panel="${type}"]`).dataset.mobileFlowView='';openActivityHistoryPage();},type);
      await page.locator(`[data-activity-id="${type}legacy"]`).focus();await page.keyboard.press('Space');
      await page.waitForFunction(type=>{const row=document.querySelector(`[data-entry-id="${type}18"]`);return row?.classList.contains('activity-target-highlight')&&row.getBoundingClientRect().height>0;},type);
      await page.evaluate(()=>openActivityHistoryPage());await page.locator(`[data-activity-id="${type}deleted"]`).click();
      await page.waitForFunction(()=>document.querySelector('.activity-navigation-notice')?.textContent.includes('có thể đã bị xóa'));
      assert.equal(await page.locator(`[data-tab-panel="${type}"] [data-mobile-flow-panel="history"]`).isVisible(),true);
    }
    await page.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',storeId:'a',permissions:{history:{viewOwn:true}}};openActivityHistoryPage();});
    // Employees' activity rows are scoped to their UID; invoke the same handler to check the access guard.
    await page.evaluate(()=>navigateToActivity('incomeactivity0'));
    assert.equal(await page.locator('#activityHistoryPage').isVisible(),true);assert.ok(alerts.includes('Bạn chưa được phân quyền'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
    await page.close();console.log(`Activity cash navigation, collapsed/report views, cancelled/deleted, legacy, keyboard and permission guard ${platform} ${width}x${height}: OK`);
  }}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
