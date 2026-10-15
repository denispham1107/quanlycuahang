const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
test('mobile sales uses distinct soft section accents without changing cancelled orders or the shared hero',()=>{
 const accents=css.slice(css.indexOf('/* Soft section accents for Mobile sales;'),css.indexOf('@media (max-width: 360px)',css.indexOf('/* Soft section accents for Mobile sales;')));
 for(const selector of accents.split('{').slice(0,-1).map(x=>x.split('}').at(-1).replace(/\/\*[\s\S]*?\*\//g,'').trim()))assert.ok(selector.startsWith('html.mobile-app-theme'),selector);
 assert.match(accents,/sales-goods-panel[^}]*#f2fbf8/);assert.match(accents,/sales-history-panel[^}]*#fff5fa/);
 for(const n of ['3n+1','3n+2','3n'])assert.ok(accents.includes(`nth-child(${n})`));
 assert.match(accents,/tr:not\(\.entry-cancelled\):not\(:has\(\.empty-list\)\)/);
 assert.doesNotMatch(accents,/\.mobile-sales-report\s*\{|\.mobile-flow-hero\s*\{/);
 const lum=hex=>hex.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 for(const [fg,bgs] of [['24695f',['f2fbf8','fbfdff']],['955173',['fff5fa','fcfbff']],['285f56',['dcf2e9','e8f3fb']],['286c60',['dcf2e9','e8f3fb','f2fbf8']],['824361',['f8e3ee','eee8fa']],['69509a',['fcf7ff','f7f9ff']],['67509b',['ede5fa']],['176992',['fff5fa','f5f0fb']]])for(const bg of bgs)assert.ok((lum(bg)+.05)/(lum(fg)+.05)>=4.5,`${fg} on ${bg}`);
});
test('mobile sales report and header add reuse the approved cash-flow design',()=>{
 assert.match(html,/<article class="mobile-sales-report mobile-flow-hero"/);
 assert.match(html,/<button class="mobile-flow-add" id="mobileSalesCreate"/);
 assert.match(html,/<span class="mobile-sales-report-heading">Tổng bán hàng<\/span>/);
 assert.doesNotMatch(html,/mobile-sales-report-symbol/);
 assert.doesNotMatch(css,/html\.mobile-app-theme #mobileSalesCreate \{|mobile-sales-report::before|mobile-sales-report::after/);
 const rule=css.match(/html\.mobile-app-theme \.mobile-flow-hero \{([^}]+)\}/)[1];
 assert.match(rule,/linear-gradient\(115deg, rgba\(246, 222, 255, 0\.94\), rgba\(217, 239, 255, 0\.95\)\)/);
 assert.match(rule,/border: 1\.5px solid rgba\(255, 255, 255, 0\.91\)/);
 const luminance=hex=>{const rgb=hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 for(const foreground of ['18377a','4f617d'])for(const background of ['f6deff','d9efff'])assert.ok((luminance(background)+.05)/(luminance(foreground)+.05)>=4.5,`${foreground} on ${background} is readable`);
});
test('approved sales mobile additions are hidden on desktop and history remains last',()=>{
 const tab=html.slice(html.indexOf('<section class="tab-panel" data-tab-panel="sales"'),html.indexOf('<section class="tab-panel" data-tab-panel="purchase"'));
 const positions=['mobile-sales-heading','mobile-sales-report','sales-main-panel','sales-goods-panel','sales-history-panel'].map(c=>tab.indexOf(c));
 assert.ok(positions.every((n,i)=>n>=0&&(!i||n>positions[i-1])));
 assert.match(css,/\.mobile-sales-heading, \.mobile-sales-report \{ display: none; \}/);
 const newCSS=css.slice(css.indexOf('/* Approved "Nổi bật gradient"'));
 for(const selector of newCSS.split('{').slice(0,-1).map(x=>x.split('}').at(-1).trim())){
  if(selector.startsWith('/*')||selector.startsWith('.mobile-sales-heading')||selector.startsWith('@media'))continue;
  if(/^html #(quickEntryButton|aiButton)(?:$|[\s:])/.test(selector))continue; // Approved shared floating actions on Desktop/Mobile.
  assert.ok(selector.includes('html.mobile-app-theme'),selector);
 }
 for(const id of ['salesGoodsFilter','salesOrderTable','salesDraftList','openCustomers'])assert.ok(tab.includes(`id="${id}"`));
 assert.match(app,/if \(USE_MOBILE_APP_THEME && !els\.quickEntryButton\.hidden\) els\.quickEntryButton\.click\(\)/);
 assert.match(app,/mobileSalesCreate\.hidden = !\(showButton && type === "sales"\)/);
 assert.doesNotMatch(css,/body:has\(\[data-tab-panel="sales"\]:not\(\[hidden\]\)\) #quickEntryButton \{ display: none/,'sales must keep the shared circular quick-entry FAB');
});
test('mobile report shares selected-range totals and excludes cancelled orders and drafts',()=>{
 const start=app.indexOf('  const salesOrders = (store.orders || [])',app.indexOf('function renderReports(store)'));
 const end=app.indexOf('  renderSalesDraftList(',start);const code=app.slice(start,end);
 const els=new Proxy({}, {get:(o,k)=>o[k]||(o[k]={textContent:'',innerHTML:''})});
 const ctx={els,store:{orders:[{date:'2026-10-11',total:53000},{date:'2026-10-11',total:200500},{date:'2026-10-11',total:999000,status:'cancelled'},{date:'2026-10-10',total:500000}],draftOrders:[{total:900000}]},range:{start:'2026-10-11',end:'2026-10-11',label:'11/10/2026'},totalIncome:0,totalExpense:0,isCancelledEntry:o=>o.status==='cancelled',formatCurrency:n=>`${n} ₫`,renderDesktopOverviewBreakdown:()=>{},renderOverviewExpenseCategories:()=>{},renderOverviewCharts:()=>{}};
 vm.createContext(ctx);vm.runInContext(app.slice(app.indexOf('function getSalesOverviewStats('),app.indexOf('function renderDesktopInsights(')),ctx);
 vm.runInContext(code,ctx);assert.equal(els.mobileSalesReportTotal.textContent,'253500 ₫');assert.equal(els.mobileSalesReportRange.textContent,'11/10/2026');assert.equal(els.mobileSalesReportCount.textContent,'2');assert.equal(els.mobileSalesCancelledCount.textContent,'1');assert.equal(els.mobileSalesHeadingCount.textContent,'3 đơn');
 ctx.store.orders=[];vm.runInNewContext(code,{...ctx});assert.equal(els.mobileSalesReportTotal.textContent,'0 ₫');assert.equal(els.mobileSalesReportCount.textContent,'0');assert.equal(els.mobileSalesCancelledCount.textContent,'0');
});
test('mobile customer icon precedes create in heading, removes helper row and keeps existing permission/handler',()=>{
 const header=html.match(/<header class="mobile-sales-heading">[\s\S]*?<\/header>/)[0];
 assert.ok(header.indexOf('id="mobileSalesCustomers"')<header.indexOf('id="mobileSalesCreate"'));
 assert.match(header,/id="mobileSalesCustomers"[^>]*aria-label="Khách hàng"/);assert.match(header,/<svg class="sales-customers-icon" aria-hidden="true" viewBox="0 0 32 32"/);
 for(const id of ['salesCustomerBody','salesCustomerFace','salesCustomerCompanion'])assert.match(header,new RegExp(`linearGradient id="${id}"`));
 assert.match(css,/html\.mobile-app-theme #mobileSalesCustomers svg \{ width: 32px; height: 32px;/);
 assert.match(css,/html\.mobile-app-theme \.sales-main-panel > \.empty-list,\s*html\.mobile-app-theme #openCustomers \{ display: none; \}/);
 assert.match(app,/if \(USE_MOBILE_APP_THEME && !els\.openCustomers\.disabled\) els\.openCustomers\.click\(\)/);
 assert.match(app,/mobileSalesCustomers\.disabled = els\.openCustomers\.disabled/);
 assert.match(app,/mobileSalesCustomers\.dataset\.roleHidden = els\.openCustomers\.dataset\.roleHidden/);
 assert.match(app,/els\.mobileSalesCustomers\.focus\(\{ preventScroll: true \}\)/);
});
