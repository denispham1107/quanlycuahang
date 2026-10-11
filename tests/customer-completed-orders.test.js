const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const source=app.slice(app.indexOf('function getCustomerSalesOrders('),app.indexOf('function openCustomerHistory('));
const ctx={getCustomerKey:(name,phone)=>`${String(name).trim().toLowerCase()}::${String(phone).trim()}`,isCancelledEntry:order=>order.status==='cancelled'};
vm.runInNewContext(source,ctx);
test('completed customer orders are exact customer matches, exclude cancellations, sort newest first, ignore drafts and date filters',()=>{
 const customer={name:'Khách',phone:'0123'},store={orders:[{id:'old',customerName:'Khách',customerPhone:'0123',date:'2025-01-01'},{id:'cancelled',customerName:'Khách',customerPhone:'0123',status:'cancelled',date:'2026-10-11'},{id:'new',customerName:' KHÁCH ',customerPhone:'0123',createdAt:'2026-10-11T10:00:00Z'},{id:'other-phone',customerName:'Khách',customerPhone:'0999'},{id:'other-name',customerName:'Người khác',customerPhone:'0123'}],draftOrders:[{id:'draft',customerName:'Khách',customerPhone:'0123'}]};
 const before=JSON.stringify(store);assert.deepEqual(Array.from(ctx.getCustomerSalesOrders(store,customer,{completedOnly:true}),o=>o.id),['new','old']);assert.equal(JSON.stringify(store),before,'view does not mutate data');
 assert.deepEqual(Array.from(ctx.getCustomerSalesOrders({orders:[]},customer,{completedOnly:true})),[]);
});
test('full LS history retains cancelled orders for existing admin purge workflow',()=>{
 const customer={name:'Khách',phone:'0123'},store={orders:[{customerName:'Khách',customerPhone:'0123',status:'cancelled'}]};assert.equal(ctx.getCustomerSalesOrders(store,customer).length,1);assert.equal(ctx.getCustomerSalesOrders(store,customer,{completedOnly:true}).length,0);
});
test('customer card click and keyboard show completed orders while explicit edit and LS stay separate',()=>{
 const listeners=app.slice(app.indexOf('els.customersList.addEventListener("click"'),app.indexOf('els.salesOrderTable.addEventListener("click"'));const handlers={},calls=[];
 vm.runInNewContext(listeners,{els:{customersList:{addEventListener:(type,handler)=>handlers[type]=handler}},openCustomerHistory:(...args)=>calls.push(['history',...args]),openCustomerById:id=>calls.push(['edit',id]),openMemberTierInfo:id=>calls.push(['tier',id])});
 const card={dataset:{openCustomerOrders:'c'}},event=(targets,key)=>({key,preventDefault(){},stopPropagation(){},target:{closest:selector=>targets[selector]||null}});
 handlers.click(event({'[data-open-customer-orders]':card}));assert.equal(calls[0][0],'history');assert.equal(calls[0][2].completedOnly,true);
 handlers.click(event({'[data-edit-customer]':{dataset:{editCustomer:'c'}},'[data-open-customer-orders]':card}));assert.deepEqual(calls[1],['edit','c']);
 handlers.click(event({'[data-customer-history]':{dataset:{customerHistory:'c'}},'[data-open-customer-orders]':card}));assert.deepEqual(calls[2],['history','c']);
 for(const key of ['Enter',' ']){handlers.keydown({key,target:{...card,closest(){return this}},preventDefault(){}});assert.equal(calls.at(-1)[2].completedOnly,true);}
 handlers.click(event({'[data-member-tier-customer]':{dataset:{memberTierCustomer:'c'}},'[data-open-customer-orders]':card}));assert.deepEqual(calls.at(-1),['tier','c']);
});
test('completed-order view uses true count/total, escaped content and honest empty state without writing',()=>{
 const customer={id:'c',name:'<Khách>',phone:'0123'},store={orders:[{id:'one',total:25},{id:'two',total:75}]},els={customerHistoryStatus:{},customerHistoryContent:{},customerHistoryModal:{hidden:true}},title={},view={getActiveStore:()=>store,getStoreCustomers:()=>[customer],getCustomerSalesOrders:()=>store.orders,isCancelledEntry:()=>false,els,document:{querySelector:()=>title},escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),formatCurrency:n=>`${n} đ`,renderCustomerHistoryOrder:o=>`<article>${o.id}</article>`};
 vm.runInNewContext(app.slice(app.indexOf('function openCustomerHistory('),app.indexOf('function closeCustomerHistoryModal(')),view);view.openCustomerHistory('c',{completedOnly:true});assert.equal(title.textContent,'Đơn hàng đã hoàn thành');assert.equal(els.customerHistoryStatus.textContent,'2 đơn');assert.match(els.customerHistoryContent.innerHTML,/100 đ/);assert.match(els.customerHistoryContent.innerHTML,/&lt;Khách&gt;/);assert.equal(els.customerHistoryModal.hidden,false);
 store.orders=[];view.openCustomerHistory('c',{completedOnly:true});assert.match(els.customerHistoryContent.innerHTML,/chưa có đơn hàng đã hoàn thành/);assert.equal(els.customerHistoryStatus.textContent,'0 đơn');
});
