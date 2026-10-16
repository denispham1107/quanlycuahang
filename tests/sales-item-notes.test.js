const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8'),server=fs.readFileSync('functions/index.js','utf8'),css=fs.readFileSync('styles.css','utf8');
function fn(s,name){const i=s.indexOf(`function ${name}(`),j=s.indexOf('\nfunction ',i+1);return s.slice(i,j<0?s.length:j);}
test('sales notes collect separately for complete and incomplete draft rows',()=>{
 const row=note=>({querySelector:s=>({value:s.includes('"name"')?'Cát nhật':s.includes('"note"')?note:s.includes('"quantity"')?'2':''})});
 const ctx={els:{salesItems:{querySelectorAll:()=>[row('  Dòng 1\nDòng 2  '),row('Riêng món thứ hai')]}},getSalesRowPricing:()=>({price:20,originalPrice:20}),getSalesItemType:()=> 'goods',getActiveStore:()=>({})};
 for(const name of ['getSalesOrderItems','getSalesDraftItems'])vm.runInNewContext(fn(app,name),ctx);
 for(const get of [ctx.getSalesOrderItems,ctx.getSalesDraftItems]){const a=get();assert.equal(a[0].note,'Dòng 1\nDòng 2');assert.equal(a[1].note,'Riêng món thứ hai');assert.equal(a[0].total,40);}
});
test('detail puts escaped note directly under the product name and omits old empty notes',()=>{
 const ctx={escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),formatCurrency:String};vm.runInNewContext(fn(app,'renderSalesOrderItemLine'),ctx);
 const html=ctx.renderSalesOrderItemLine({name:'Cát',note:'<img src=x>\nMón riêng',quantity:1,price:20,total:20});assert.match(html,/Cát<span class="order-detail-product-note">&lt;img src=x&gt;\nMón riêng<\/span><\/strong>/);assert.doesNotMatch(html,/<img/);
 assert.doesNotMatch(ctx.renderSalesOrderItemLine({name:'Cũ'}),/class="order-detail-product-note"/);
});
test('employee order and draft transactions preserve separate notes without affecting totals or stock',()=>{
 const ctx={employeeText:(s,n)=>String(s||'').trim().slice(0,n),employeeNumber:Number,employeeDate:s=>s,employeeKey:s=>String(s||''),employeeId:()=> 'id',allocateEmployeeSalesBillCode:()=>({billCode:'HD01'}),createEmployeeActivity:()=>({})};for(const name of ['applyEmployeeSalesMutation','applyEmployeeSalesDraftMutation'])vm.runInNewContext(fn(server,name),ctx);
 const store={inventory:[{name:'Cát',quantity:5,totalCost:50}],orders:[],customers:[],activityHistory:[],draftOrders:[]},user={uid:'worker',profile:{displayName:'NV'}},items=[{name:'Cát',quantity:1,price:20,note:'Món thứ nhất\nGói riêng'},{name:'Cát',quantity:1,price:20,note:'Món thứ hai'}];
 ctx.applyEmployeeSalesDraftMutation(store,{id:'draft',date:'2026-10-16',items},user);assert.equal(store.draftOrders[0].items[0].note,items[0].note);assert.equal(store.draftOrders[0].items[1].note,items[1].note);assert.equal(store.inventory[0].quantity,5);
 ctx.applyEmployeeSalesMutation(store,{id:'order',date:'2026-10-16',customerName:'Khách',items},user);assert.equal(store.orders[0].items[0].note,items[0].note);assert.equal(store.orders[0].items[1].note,items[1].note);assert.equal(store.orders[0].total,40);assert.equal(store.inventory[0].quantity,3);
});
test('desktop disclosure has accessible controls and Mobile always shows notes below the quantity',()=>{
 assert.match(app,/aria-controls="\$\{noteId\}" aria-expanded=/);assert.match(app,/placeholder="Ghi chú" aria-label="Ghi chú hàng hóa"/);
 const block=css.slice(css.indexOf('/* Per-item sales notes:'),css.indexOf('/* End per-item sales notes. */'));
 assert.match(block,/grid-column: 1 \/ -1/);assert.match(block,/data-note-open="true"/);assert.match(block,/html\.mobile-app-theme[^{}]+\.sales-note-toggle \{ display: none/);assert.match(block,/html\.mobile-app-theme[^{}]+\.sales-item-note \{ display: block; font-size: 16px/);assert.match(block,/white-space: pre-wrap/);
});
