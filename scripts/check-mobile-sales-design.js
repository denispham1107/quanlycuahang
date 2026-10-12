const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const before=Object.fromEntries(['index.html','styles.css','app.js'].map(file=>[file,execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'show',`HEAD:${file}`],{cwd:root})]));
async function setup(page,baseline=false){
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='sales-design.test')return route.abort();if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});const name=url.pathname==='/'?'index.html':url.pathname.slice(1),file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:baseline&&before[name]?before[name]:fs.readFileSync(file)});});
 await page.goto('http://sales-design.test/');await page.evaluate(()=>{
  const base={date:today,createdAt:today+'T14:08:00',customerName:'BIN BIN',customerPhone:'012345698',createdByName:'Bán Hàng',subtotal:53000};
  state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng thử',categories:{income:[],expense:[]},orders:[{...base,id:'one',billCode:'HD02-11102026',total:53000,items:[{name:'Cát nhật',groupName:'Cát vệ sinh',quantity:1,price:53000,total:53000}]},{...base,id:'two',billCode:'HD01-11102026',total:200500,items:[{name:'Tắm VS 3kg',groupName:'Spa',quantity:1,price:142500,total:142500},{name:'Cát nhật',groupName:'Cát vệ sinh',quantity:1,price:58000,total:58000}]},{...base,id:'cancelled',total:999000,status:'cancelled',items:[]}],draftOrders:[{id:'draft',date:today,customerName:'THINH',customerPhone:'0123456789',createdAt:today+'T06:24:00',total:0,items:[]}],inventory:[{id:'stock',name:'Cát nhật',groupName:'Cát vệ sinh',quantity:20,salePrice:58000,lastPrice:44000,totalCost:880000}]},{id:'b',name:'Khác',categories:{income:[],expense:[]},orders:[],draftOrders:[]}]});
  getActiveStore().categories.income=[{id:'cash-test',name:'Mục thu thử'}];getActiveStore().categories.expense=[{id:'expense-test',name:'Mục chi thử'}];
  authState.role='admin';authState.ready=true;authState.profile={role:'admin',displayName:'Admin'};authState.user={uid:'admin'};cloudStore.enabled=false;els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');els.rangeMode.value='today';uiState.rangeMode='today';activateTab('sales');render();
 });await page.waitForTimeout(250);
}
async function main(){const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
try{
for(const width of [800,1024,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});await setup(page,true);const baseline=await page.locator('.layout').screenshot();await page.evaluate(()=>{activateTab('overview');render();});const baselineAI=await page.locator('#aiButton').screenshot();await page.close();
 const updated=await browser.newPage({viewport:{width,height:1000}});await setup(updated);assert.equal(await updated.locator('.mobile-sales-report').isVisible(),false);assert.equal(await updated.locator('.mobile-sales-heading').isVisible(),false);assert.deepEqual(await updated.locator('.layout').screenshot(),baseline,`desktop ${width} unchanged pixels`);await updated.evaluate(()=>{activateTab('overview');render();});assert.equal(await updated.locator('#aiButton .ai-fab-robot').isVisible(),false);assert.equal(await updated.locator('#aiButton .ai-fab-label').isVisible(),true);assert.deepEqual(await updated.locator('#aiButton').screenshot(),baselineAI,`desktop ${width} AI unchanged pixels`);await updated.close();console.log(`Desktop ${width}: exact layout and AI button screenshot unchanged`);
}
for(const [width,height,platform='ios'] of [[320,700],[375,900],[430,900],[667,375],[375,400],[375,900,'android']]){
 const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,userAgent:platform==='android'?'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());await setup(page);
 assert.equal(await page.locator('.mobile-sales-report').isVisible(),true);assert.match(await page.locator('#mobileSalesReportTotal').textContent(),/253.500/);assert.equal(await page.locator('#mobileSalesReportCount').textContent(),'2 đơn');assert.equal(await page.locator('[data-tab-panel="sales"]').evaluate(el=>el.lastElementChild.classList.contains('sales-history-panel')),true);
 await page.evaluate(()=>{const styles=(selector,props)=>{const s=getComputedStyle(document.querySelector(selector));return props.map(p=>s[p]);};const same=(a,b,props)=>{if(JSON.stringify(styles(a,props))!==JSON.stringify(styles(b,props)))throw new Error(`${a} must share expense design`);};same('#mobileSalesCreate','[data-flow-type="expense"].mobile-flow-add',['width','height','border','borderRadius','backgroundImage','color','fontSize','boxShadow']);same('.mobile-sales-report','[data-mobile-flow="expense"] .mobile-flow-hero',['padding','border','borderRadius','backgroundImage','boxShadow','gap']);same('#mobileSalesReportTotal','#mobileExpenseFlowTotal',['fontSize','color','fontWeight','lineHeight']);});
 assert.equal(await page.locator('#quickEntryButton').isVisible(),true);
 const fabStyle=await page.locator('#quickEntryButton').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,stroke:getComputedStyle(el.querySelector('svg')).stroke,disc:getComputedStyle(el,'::before').backgroundImage}));
 assert.ok(Math.abs(fabStyle.width-45.9)<.1&&fabStyle.width===fabStyle.height);assert.equal(fabStyle.stroke,'rgb(255, 255, 255)');assert.ok(fabStyle.disc.includes('linear-gradient'));
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
 const fab=await page.locator('#quickEntryButton').boundingBox(),dock=await page.locator('#tabBar').boundingBox();
 assert.ok(fab.x>=0&&fab.x+fab.width<=width+1&&fab.y>=0&&fab.y+fab.height<=dock.y,'round add button stays visible above dock at the end of history');
 await page.locator('#quickEntryButton').click();assert.equal(await page.locator('#quickEntryModal').isVisible(),true);await page.locator('#cancelQuickEntry').click();
 await page.evaluate(()=>scrollTo(0,0));
 for(const amount of await page.locator('#salesGoodsReport .report-amount').all())assert.ok(await amount.evaluate(el=>el.clientHeight<32),'normal amounts remain on one line');
 assert.equal(await page.locator('#rangeMode option').count(),9);assert.equal(await page.locator('[data-time-preset]').count(),6);
 await page.locator('#salesGoodsFilter').selectOption({label:'Spa'});assert.match(await page.locator('#salesGoodsReport').textContent(),/142.500/);assert.match(await page.locator('#mobileSalesReportTotal').textContent(),/253.500/);
 await page.locator('#mobileSalesCreate').click();assert.equal(await page.locator('#quickEntryModal').isVisible(),true);assert.equal(await page.locator('.mobile-time-filter-shell').isVisible(),false);await page.locator('#cancelQuickEntry').click();
 await page.locator('[data-open-sales-draft="draft"]').click();assert.equal(await page.locator('#salesCustomerName').inputValue(),'THINH');await page.locator('#cancelQuickEntry').click();
 await page.locator('[data-open-sales-order="one"] .sales-bill-code').click();assert.equal(await page.locator('#salesOrderDetailModal').isVisible(),true);await page.locator('#closeSalesOrderDetail').click();
 assert.equal(await page.locator('#openCustomers').isVisible(),false);assert.equal(await page.locator('.sales-main-panel > .empty-list').isVisible(),false);
 const customerBounds=await page.locator('#mobileSalesCustomers').boundingBox(),createBounds=await page.locator('#mobileSalesCreate').boundingBox();assert.ok(customerBounds.x+customerBounds.width<=createBounds.x&&customerBounds.width>=44&&customerBounds.x>=0,'customer icon is left of create, with a 44px touch target');
 await page.locator('#mobileSalesCustomers').click();assert.equal(await page.locator('#customersPage').isVisible(),true);await page.locator('#closeCustomersTop').click();await page.waitForFunction(()=>els.customersPage.hidden);assert.equal(await page.evaluate(()=>document.activeElement.id),'mobileSalesCustomers');
 await page.evaluate(()=>{getActiveStore().orders[0].createdByName='Tên rất dài '+ 'NhânViên'.repeat(15);getActiveStore().orders[0].customerName='Khách dài '+ 'KháchHàng'.repeat(14);getActiveStore().orders[0].total=12345678901234;render();});
 for(const cell of await page.locator('#salesOrderTable td,#salesDraftList td').all()){const m=await cell.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,text:el.textContent}));assert.ok(m.scroll<=m.width+1,`${width} ${JSON.stringify(m)}`);}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.evaluate(()=>{state.activeStoreId='b';render();});assert.match(await page.locator('#mobileSalesReportTotal').textContent(),/^0/);assert.equal(await page.locator('#mobileSalesReportCount').textContent(),'0 đơn');
 await page.evaluate(()=>{state.activeStoreId='a';getActiveStore().orders[0].createdByName='Bán Hàng';getActiveStore().orders[0].customerName='BIN BIN';getActiveStore().orders[0].total=53000;uiState.salesGoodsFilter='all';render();});
 for(const tab of ['income','expense','purchase','sales']){
  await page.evaluate(tab=>activateTab(tab),tab);assert.equal(await page.locator('#quickEntryButton').isVisible(),true);
  await page.locator('#quickEntryButton').click();assert.equal(await page.locator('#quickEntryModal').isVisible(),true);assert.equal(await page.locator('#quickEntryForm').getAttribute('data-type'),tab);await page.locator('#cancelQuickEntry').click();
 }
 const plusDimensions=await page.locator('#quickEntryButton').boundingBox();
 const plusBackground=await page.locator('#quickEntryButton').evaluate(el=>getComputedStyle(el).backgroundImage);
 await page.evaluate(()=>{activateTab('overview');render();});
 assert.equal(await page.locator('#aiButton').isVisible(),true);assert.equal(await page.locator('#aiButton .ai-fab-label').isVisible(),false);assert.equal(await page.locator('#aiButton .ai-fab-robot').isVisible(),true);
 const aiDimensions=await page.locator('#aiButton').boundingBox();assert.equal(aiDimensions.width,plusDimensions.width);assert.equal(aiDimensions.height,plusDimensions.height);
 assert.equal(await page.locator('#aiButton').evaluate(el=>getComputedStyle(el).backgroundImage),plusBackground);
 if(width===375&&height===900&&process.env.SALES_DESIGN_SHOTS)await page.locator('#aiButton').screenshot({path:path.join(process.env.SALES_DESIGN_SHOTS,`ai-robot-${platform}.png`)});
 await page.locator('#aiButton').click();assert.equal(await page.locator('#aiChatModal').isVisible(),true);await page.waitForTimeout(100);await page.locator('#aiChatClose').click();assert.equal(await page.locator('#aiChatModal').isVisible(),false);
 await page.evaluate(()=>activateTab('sales'));
 if(width===375&&height===900&&process.env.SALES_DESIGN_SHOTS){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.SALES_DESIGN_SHOTS,`sales-live-${platform}.png`),fullPage:true});}
 await page.evaluate(()=>{authState.role='employee';authState.profile={role:'employee',displayName:'Viewer',storeId:'a',permissions:{sales:{view:true,create:false,draft:false,customerManage:false}}};render();updateQuickEntryButton();});assert.equal(await page.locator('#mobileSalesCreate').isVisible(),false);assert.equal(await page.locator('#quickEntryButton').isVisible(),false);assert.equal(await page.locator('[data-delete-order]').count(),0);
 assert.equal(await page.locator('#mobileSalesCustomers').isVisible(),false);
 await page.evaluate(()=>{authState.profile.permissions.sales.customerManage=true;render();updateQuickEntryButton();});assert.equal(await page.locator('#mobileSalesCustomers').isVisible(),true);assert.equal(await page.locator('#mobileSalesCreate').isVisible(),false);await page.locator('#mobileSalesCustomers').click();assert.equal(await page.locator('#customersPage').isVisible(),true);await page.locator('#closeCustomersTop').click();await page.waitForFunction(()=>els.customersPage.hidden);
 assert.deepEqual(errors,[]);await page.close();console.log(`${platform} ${width}x${height}: reports, filters, permissions, draft/detail/customer actions and long names/amounts OK`);
}
}finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1});
