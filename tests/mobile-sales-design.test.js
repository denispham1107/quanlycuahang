const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
test('approved sales mobile additions are hidden on desktop and history remains last',()=>{
 const tab=html.slice(html.indexOf('<section class="tab-panel" data-tab-panel="sales"'),html.indexOf('<section class="tab-panel" data-tab-panel="purchase"'));
 const positions=['mobile-sales-heading','mobile-sales-report','sales-main-panel','sales-goods-panel','sales-history-panel'].map(c=>tab.indexOf(c));
 assert.ok(positions.every((n,i)=>n>=0&&(!i||n>positions[i-1])));
 assert.match(css,/\.mobile-sales-heading, \.mobile-sales-report \{ display: none; \}/);
 const newCSS=css.slice(css.indexOf('/* Approved "Nổi bật gradient"'));
 for(const selector of newCSS.split('{').slice(0,-1).map(x=>x.split('}').at(-1).trim())){
  if(selector.startsWith('/*')||selector.startsWith('.mobile-sales-heading')||selector.startsWith('@media'))continue;
  assert.ok(selector.includes('html.mobile-app-theme'),selector);
 }
 for(const id of ['salesGoodsFilter','salesOrderTable','salesDraftList','openCustomers'])assert.ok(tab.includes(`id="${id}"`));
 assert.match(app,/if \(USE_MOBILE_APP_THEME && !els\.quickEntryButton\.hidden\) els\.quickEntryButton\.click\(\)/);
 assert.match(app,/mobileSalesCreate\.hidden = !\(showButton && type === "sales"\)/);
});
test('mobile report shares selected-range totals and excludes cancelled orders and drafts',()=>{
 const start=app.indexOf('  const salesOrders = (store.orders || [])',app.indexOf('function renderReports(store)'));
 const end=app.indexOf('  renderSalesDraftList(',start);const code=app.slice(start,end);
 const els=new Proxy({}, {get:(o,k)=>o[k]||(o[k]={textContent:'',innerHTML:''})});
 const ctx={els,store:{orders:[{date:'2026-10-11',total:53000},{date:'2026-10-11',total:200500},{date:'2026-10-11',total:999000,status:'cancelled'},{date:'2026-10-10',total:500000}],draftOrders:[{total:900000}]},range:{start:'2026-10-11',end:'2026-10-11',label:'11/10/2026'},totalIncome:0,totalExpense:0,isCancelledEntry:o=>o.status==='cancelled',formatCurrency:n=>`${n} ₫`,renderDesktopOverviewBreakdown:()=>{},renderOverviewExpenseCategories:()=>{},renderOverviewCharts:()=>{}};
 vm.runInNewContext(code,ctx);assert.equal(els.mobileSalesReportTotal.textContent,'253500 ₫');assert.equal(els.mobileSalesReportRange.textContent,'11/10/2026');assert.equal(els.mobileSalesReportCount.textContent,'2 đơn');assert.equal(els.mobileSalesHeadingCount.textContent,'3 đơn');
 ctx.store.orders=[];vm.runInNewContext(code,{...ctx});assert.equal(els.mobileSalesReportTotal.textContent,'0 ₫');assert.equal(els.mobileSalesReportCount.textContent,'0 đơn');
});
