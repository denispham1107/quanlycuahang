const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {getEmployeeOverviewSales} = require('../functions/employee-overview');

async function main() {
  const root = path.resolve(__dirname,'..');
  const browser = await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME ? {executablePath:process.env.BULK_TEST_CHROME} : {})});
  try {
    for (const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
      const page = await browser.newPage({viewport:{width,height},...(width<700 ? {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'} : {})});
      await page.clock.setFixedTime(new Date('2026-10-07T12:00:00'));
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=> {
        const url=new URL(route.request().url());
        if(url.hostname!=='overview.test') return route.abort();
        if(url.pathname==='/firebase-config.js') return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});
        const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file)) return route.abort();
        return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
      });
      await page.goto('http://overview.test/');
      const data=getEmployeeOverviewSales({orders:[
        {date:'2026-09-01',total:10000},{date:'2026-09-01',total:25000},
        {date:'2026-09-02',total:50000},{date:'2026-09-02',total:999999,status:'cancelled'},
        {date:'2026-10-07',total:150000}
      ]});
      await page.evaluate(data=> {
        authState.role='employee';authState.ready=true;authState.user={uid:'overview-staff'};
        authState.profile={role:'employee',storeId:'a',displayName:'Nhân viên thử',permissions:{sales:{view:false},closingBook:{manage:false}}};
        state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng được gán cho nhân viên',createdAt:'2026-10-01',overviewSales:data,orders:[],entries:[],categories:{income:[],expense:[]}}]});
        els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();
      },data);
      const check=async(total,count)=> {
        const value=(await page.locator('#employeeSalesTotal').innerText()).replace(/\D/g,'');
        assert.equal(value,String(total),`Total ${width}`);
        assert.match(await page.locator('#employeeSalesCount').innerText(),new RegExp(`^${count} đơn`));
      };
      assert.equal(await page.locator('#employeeOverviewSales').isVisible(),true);
      assert.equal(await page.locator('.overview-charts').isVisible(),false);
      assert.equal(await page.locator('#totalIncome').isVisible(),false);
      assert.equal(await page.locator('[data-tab="sales"]').isVisible(),false,'No ungranted order access');
      if(width>=700) {
        assert.equal(await page.locator('#desktopFilterRail').isVisible(),true);
        for(const id of ['rangeMode','singleDate','monthDate','fromDate','toDate','desktopFilterApply','desktopFilterReset']) assert.equal(await page.locator('#'+id).isVisible(),true,id);
      } else {
        assert.equal(await page.locator('#timeFilterToggle').isVisible(),true);
        await page.locator('#timeFilterToggle').click();
      }
      // Trigger the actual controls' registered handlers even after mobile auto-collapse.
      const select=async mode=>page.locator('#rangeMode').evaluate((el,mode)=>{el.value=mode;el.dispatchEvent(new Event('change',{bubbles:true}));},mode);
      const fill=async(id,value)=>page.locator('#'+id).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},value);
      for(const [mode,total,count] of [['today',150000,1],['yesterday',0,0],['this-month',150000,1],['last-month',85000,3]]) {
        await select(mode);await check(total,count);
      }
      await fill('singleDate','2026-09-01');await check(35000,2);
      await fill('monthDate','2026-09');await check(85000,3);
      await fill('fromDate','2026-09-02');await fill('toDate','2026-10-07');await check(200000,2);
      await fill('fromDate','2026-10-07');await fill('toDate','2026-09-02');await check(200000,2);
      await select('all');await check(235000,4);
      await fill('singleDate','2026-08-01');await check(0,0);
      await fill('monthDate','2026-09');
      await select('week');await fill('singleDate','2026-09-01');await select('week');await check(85000,3);
      if(width>=700) {
        await page.locator('#desktopFilterApply').click();await check(85000,3);
        await page.locator('#desktopFilterCollapse').click();assert.equal(await page.locator('#desktopFilterBody').isVisible(),false);
        await page.locator('#desktopFilterCollapse').click();assert.equal(await page.locator('#desktopFilterBody').isVisible(),true);
        await page.locator('#desktopFilterReset').click();
        assert.equal(await page.locator('#rangeMode').inputValue(),'today');
      }
      await fill('monthDate','2026-09');
      await page.evaluate(()=>window.scrollTo(0,0));
      const overflow=await page.locator('#employeeOverviewAccess h2,#openClosingBookEmployee,#employeeOverviewSales,#employeeOverviewSales strong,#timeFilters input,#timeFilters select,#desktopFilterRail button').evaluateAll(els=>els.filter(el=> {
        const r=el.getBoundingClientRect();return r.width>0 && (r.left < -1 || r.right > innerWidth+1);
      }).map(el=>el.id));
      assert.deepEqual(overflow,[],`Controls stay within ${width}x${height}`);
      if(width<700) {
        await page.evaluate(()=>{uiState.timeFiltersExpanded=false;updateTimeFiltersVisibility();});
        await page.waitForTimeout(300);
      }
      if(process.env.INVENTORY_TEST_SHOTS && [375,1440].includes(width)&&height===900) await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`employee-overview-sales-${width}.png`)});
      // Changing store immediately clears totals from the prior store.
      await page.evaluate(()=>{state.stores.push(normalizeState({stores:[{id:'b',name:'Cửa hàng trống',overviewSales:[]}]}).stores[0]);state.activeStoreId='b';render();});
      await check(0,0);
      assert.match(await page.locator('#employeeOverviewStoreName').innerText(),/Cửa hàng trống/);
      // Thu/Chi must alert before changing the selected page or any filter state.
      await page.evaluate(()=>{authState.profile.permissions={purchase:{view:true},sales:{view:true}};render();});
      const alerts=[];
      page.on('dialog',async dialog=>{assert.equal(dialog.type(),'alert');alerts.push(dialog.message());await dialog.accept();});
      const navigationSnapshot=()=>page.evaluate(()=>({tab:getActiveTabName(),panels:[...els.tabPanels].map(p=>[p.dataset.tabPanel,p.hidden]),hash:location.hash,mode:els.rangeMode.value,month:els.monthDate.value,expanded:uiState.timeFiltersExpanded,secondary:document.body.classList.contains('mobile-secondary-tab')}));
      for(const current of ['stores','overview','purchase','sales']) {
        await page.locator(`[data-tab="${current}"]`).click();
        const before=await navigationSnapshot();
        for(const blocked of ['income','expense']) {
          const count=alerts.length;
          await page.locator(`[data-tab="${blocked}"]`).click();
          assert.equal(alerts.length,count+1);
          assert.equal(alerts.at(-1),'Bạn chưa được phân quyền');
          assert.deepEqual(await navigationSnapshot(),before,`${current} remains open after ${blocked} OK`);
        }
      }
      await page.evaluate(()=>{authState.role='admin';authState.profile={role:'admin'};render();});
      const count=alerts.length;
      for(const tab of ['income','expense']) {
        await page.locator(`[data-tab="${tab}"]`).click();
        assert.equal(await page.evaluate(()=>getActiveTabName()),tab);
      }
      assert.equal(alerts.length,count,'Admin navigation is unchanged');
      await page.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',storeId:'a',permissions:{}};render();});
      await page.evaluate(()=>{state.stores=[];state.activeStoreId=null;render();activateTab('overview');});
      assert.equal(await page.locator('#employeeOverviewSales').isVisible(),false,'Removed assignment does not retain stale sales totals');
      assert.deepEqual(errors,[]);
      await page.close();
      console.log(`Employee overview filters/totals/layout and blocked Thu/Chi navigation: ${width}x${height} OK`);
    }
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
