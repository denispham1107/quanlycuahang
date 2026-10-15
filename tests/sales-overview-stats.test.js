const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
function harness(){const context={isCancelledEntry:o=>o.status==='cancelled',desktopUi:{insights:{innerHTML:''}},getDateRange:()=>({start:'2026-10-15',end:'2026-10-15'}),getActiveTabName:()=> 'sales',formatCurrency:v=>v+' đ',escapeHtml:v=>String(v)};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function getSalesOverviewStats('),app.indexOf('function getMobileTimeFilterLabel(')),context);return context;}
test('sales overview counts completed/cancelled orders separately and sums sold quantities, not item rows',()=>{
 const c=harness(),orders=[{total:100,items:[{name:'A',quantity:3},{name:'B',quantity:2.5}]},{total:200,items:[{name:'A',quantity:'4'},{name:'Dịch vụ',itemType:'service',quantity:2}]},{status:'cancelled',total:9999,items:[{quantity:1000}]}];
 const before=JSON.stringify(orders),s=c.getSalesOverviewStats(orders);
 assert.equal(s.totalAmount,300);assert.equal(s.soldCount,2);assert.equal(s.cancelledCount,1);assert.equal(s.goodsQuantity,11.5);assert.equal(JSON.stringify(orders),before);
});
test('empty/cancelled-only and malformed quantities never create phantom sales',()=>{
 const c=harness();for(const orders of [[],[{status:'cancelled',total:900,items:[{quantity:2}]}]]){const s=c.getSalesOverviewStats(orders);assert.equal(s.totalAmount,0);assert.equal(s.soldCount,0);assert.equal(s.goodsQuantity,0);assert.equal(s.cancelledCount,orders.length);}
 const s=c.getSalesOverviewStats([{total:NaN,items:[{quantity:NaN},{quantity:Infinity},{quantity:-2},{quantity:0},{}]}]);assert.equal(s.totalAmount,0);assert.equal(s.goodsQuantity,0);
});
test('desktop uses the same date-scoped data and puts cancellation after sold goods',()=>{
 const c=harness(),date='2026-10-15';
 c.renderDesktopInsights({orders:[{date,total:100,items:[{quantity:7}]},{date,status:'cancelled',total:800,items:[{quantity:20}]},{date:'2026-10-14',total:500,items:[{quantity:100}]}],draftOrders:[{date,total:900}]});
 const output=c.desktopUi.insights.innerHTML;
 assert.match(output,/100 đ/);assert.match(output,/category-one[\s\S]*?<strong>1<\/strong>/);assert.match(output,/category-two[\s\S]*?<strong>7<\/strong>/);assert.match(output,/cancelled[\s\S]*?<strong>1<\/strong>/);
 assert.ok(output.indexOf('Hàng hóa đã bán')<output.indexOf('Đơn hàng đã hủy'));assert.doesNotMatch(output,/800 đ|500 đ|900 đ/);
 c.renderDesktopInsights({orders:[]});assert.equal((c.desktopUi.insights.innerHTML.match(/<strong>0(?: đ)?<\/strong>/g)||[]).length,4);
});
test('mobile hero contains exactly one value for each new metric and no desktop-wide card changes',()=>{
 const hero=html.match(/<article class="mobile-sales-report[\s\S]*?<\/article>/)[0];
 for(const id of ['mobileSalesReportTotal','mobileSalesReportCount','mobileSalesCancelledCount','mobileSalesGoodsCount'])assert.equal((hero.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id);
 assert.match(css,/html\.mobile-app-theme \.mobile-sales-report-stats[^}]*grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/body\[data-active-tab="sales"\] \.desktop-insights[^}]*repeat\(4,minmax\(0,1fr\)\)/);
});
test('new metric labels and values keep readable contrast on their pastel surfaces',()=>{
 const rgb=h=>h.match(/[a-f\d]{2}/gi).slice(0,3).map(v=>parseInt(v,16)/255);
 const luminance=c=>c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 for(const [kind,bg,fg] of [['sold','f0fbf5','24695f'],['cancelled','fff2f7','98416e'],['goods','f7f0ff','67509b']]){
  assert.match(css,new RegExp(`mobile-sales-report-stat\\.${kind} \\{ background: #${bg}d9;`));
  for(const under of ['e0d7f8','cbe6ff']){const surface=rgb(bg).map((v,i)=>v*(217/255)+rgb(under)[i]*(38/255));for(const color of [fg,'4f617d'])assert.ok(contrast(rgb(color),surface)>=4.5,`${kind} ${color}`);}
 }
 for(const bg of ['fff1f5','fbf4ff','fbe2eb'])assert.ok(contrast(rgb('98416e'),rgb(bg))>=4.5);
});
