const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main(){
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
 try{for(const [width,height,platform='ios'] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900],[375,900,'android']]){
  const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:platform==='android'?'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='audit.test')return route.abort();if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});});
  await page.goto('http://audit.test/');
  await page.evaluate(()=>{
   const make=extra=>({...ClosingBookCore.emptyShift(),...extra});
   const days=Array.from({length:28},(_,i)=>({date:'2026-09-'+String(i+1).padStart(2,'0'),shifts:[make({name:'Ca sáng kiểm thử',opening:100,vcb:100,momo:100,zalop:100,pos:1000}),make({name:'Ca chiều',ending:20,actualVcb:20,actualMomo:20,actualZalop:20,cash:20})]}));
   state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng kiểm thử',categories:{income:[],expense:[]},closingMonths:[{month:'2026-09',days},{month:'2026-08',days:[]}]}]});
   authState.role='admin';authState.ready=true;authState.profile={role:'admin'};authState.user={uid:'admin'};cloudStore.enabled=false;
   els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();openClosingBookPage();
  });
  const button=page.locator('#openClosingBookAudit');assert.equal(await button.isVisible(),true);
  await page.evaluate(()=>{closingBook.draft.name='Nháp chưa lưu';closingBook.dirty=true;window.__saved=JSON.stringify(state.stores[0].closingMonths);});
  await button.click();assert.equal(await page.locator('#closingBookMain').isVisible(),false);assert.equal(await page.locator('#closingBookAuditPage').isVisible(),true);assert.equal(await page.locator('#closingBookAuditDraftNotice').isVisible(),true);
  for(const metric of ['difference','posDifference','vcbDifference','momoDifference','zalopDifference'])for(const direction of ['shortage','surplus']){
   await page.locator('#closingBookAuditMetric').selectOption(metric);await page.locator('#closingBookAuditDirection').selectOption(direction);
   const expected=await page.evaluate(({metric,direction})=>{const r=buildClosingBookAudit(closingBookMonthData(),metric,direction);return {count:r.rows.length,total:formatCurrency(r.total)};},{metric,direction});
   assert.equal(await page.locator('[data-audit-date]').count(),expected.count);assert.equal(await page.locator('#closingBookAuditSummary > div:first-child strong').textContent(),expected.total);
  }
  await page.locator('#closingBookAuditDirection').selectOption('shortage');
  for(const selector of ['#closingBookAuditMetric','#closingBookAuditDirection','#closeClosingBookAudit','#closingBookAuditSummary']){await page.locator(selector).scrollIntoViewIfNeeded();const b=await page.locator(selector).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=height+1,`${width}: ${selector} bounds`);}
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden');
  await page.locator('.book-audit-day details').first().locator('summary').click();assert.equal(await page.locator('.book-audit-shifts').first().isVisible(),true);
  await page.evaluate(()=>{closingBook.page.scrollTop=0;});
  if(process.env.AUDIT_TEST_SHOTS&&[375,1440].includes(width)&&height===900)await page.screenshot({path:path.join(process.env.AUDIT_TEST_SHOTS,`closing-audit-${platform}-${width}.png`)});
  assert.equal(await page.evaluate(()=>JSON.stringify(state.stores[0].closingMonths)===window.__saved),true);
  await page.locator('#closeClosingBookAudit').click();await page.waitForFunction(()=>!closingBook.auditOpen);assert.equal(await page.evaluate(()=>closingBook.draft.name),'Nháp chưa lưu');assert.equal(await page.evaluate(()=>closingBook.dirty),true);
  await page.goForward();await page.waitForFunction(()=>closingBook.auditOpen);
  await page.evaluate(()=>{getActiveStore().closingMonths[0].days[0].shifts[0].actualZalop=1000;render();});assert.equal(await page.locator('[data-audit-date]').count(),27,'cloud refresh updates report');
  await page.goBack();await page.waitForFunction(()=>!closingBook.auditOpen);
  await page.evaluate(()=>{closingBook.dirty=false;closingBook.month.value='2026-08';loadClosingBookMonth();openClosingBookAudit();});assert.equal(await page.locator('[data-audit-date]').count(),0);assert.match(await page.locator('#closingBookAuditContext').textContent(),/08\/2026/);
  await page.evaluate(()=>{hideClosingBookPage({force:true});authState.role='employee';authState.profile={role:'employee',storeId:'a',permissions:{closingBook:{manage:true}}};render();openClosingBookPage();openClosingBookAudit();});assert.equal(await page.locator('#openClosingBookAudit').isVisible(),false);assert.equal(await page.locator('#closingBookAuditPage').isVisible(),false);
  await page.evaluate(()=>hideClosingBookPage({force:true}));assert.notEqual(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY),'hidden');assert.deepEqual(errors,[]);await page.close();console.log(`Kiểm kê ${platform} ${width}x${height}: filters, sums, saved-only, draft, Back, cloud refresh, permissions and bounds OK`);
 }}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
