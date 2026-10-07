const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {applyEmployeeInventoryExport:exportStock,applyEmployeeCustomerSave:saveCustomer}=require('../functions/employee-managed-mutations');
const app=fs.readFileSync('app.js','utf8'),server=fs.readFileSync('functions/index.js','utf8'),html=fs.readFileSync('index.html','utf8');
const user=()=>({uid:'worker',profile:{role:'employee',storeId:'a',displayName:'NV',permissions:{purchase:{inventoryExport:true},sales:{customerManage:true}}}});
const stock=()=>({id:'a',inventory:[{id:'item',name:'Cát',groupName:'Nhóm',quantity:5,totalCost:50000,lastPrice:12000,salePrice:16000}],customers:[],inventoryLogs:[],activityHistory:[]});
const activity=(user,area,message,target)=>({id:'act',actorUid:user.uid,area,message,...target});
const request=()=>({requestId:'request-1',inventoryId:'item',date:'2026-10-07',quantity:2,reason:'Hỏng',totalCost:1});
const customer=()=>({newId:'customer-1',customerId:'',name:'An',phone:'0123',memberTier:'Thường',createdAt:'2026-10-07T01:00:00.000Z'});
function rejectedWithoutChange(store,fn,status) {const before=JSON.stringify(store);assert.throws(fn,error=>error.status===status);assert.equal(JSON.stringify(store),before);}
test('new permissions are opt-in and dependent views agree in browser and server',()=> {
  for(const source of [app,server]) {
    const start=source.indexOf('const DEFAULT_EMPLOYEE_PERMISSIONS ='),end=source.indexOf('\nfunction ',source.indexOf('function normalizeEmployeePermissions',start)+10);
    const ctx={};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
    for(const profile of [{},{permissions:{}},{permissions:{purchase:{inventoryExport:'true'},sales:{customerManage:1}}}]) {
      const p=ctx.normalizeEmployeePermissions(profile);assert.equal(p.purchase.inventoryExport,false);assert.equal(p.sales.customerManage,false);
    }
    const p=ctx.normalizeEmployeePermissions({permissions:{purchase:{inventoryExport:true},sales:{customerManage:true}}});
    assert.equal(p.purchase.inventoryView,true);assert.equal(p.purchase.view,true);assert.equal(p.sales.view,true);assert.equal(p.sales.create,false);
  }
  for(const name of ['purchaseInventoryExport','salesCustomerManage']) {assert.match(html,new RegExp(`name="${name}" type="checkbox" \/>`));assert.ok(app.includes(`field("${name}"`));}
});
test('export computes stock/cost on server, records actor and deduplicates retry',()=> {
  const s=stock(),u=user(),r=request();const log=exportStock(s,r,u,()=> 'log',activity);
  assert.equal(s.inventory[0].quantity,3);assert.equal(s.inventory[0].totalCost,30000);assert.equal(s.inventory[0].lastPrice,12000);
  assert.equal(log.oldQuantity,5);assert.equal(log.newQuantity,3);assert.equal(log.createdByUid,'worker');assert.equal(log.exportReason,'Hỏng');
  exportStock(s,r,u,()=> 'log',activity);assert.equal(s.inventory[0].quantity,3);assert.equal(s.inventoryLogs.length,1);assert.equal(s.activityHistory.length,1);
  rejectedWithoutChange(s,()=>exportStock(s,{...r,quantity:3},u,()=> 'log',activity),409);
});
test('export rejects ungranted, revoked, other-store, bad date, fractional and oversold requests',()=> {
  for(const modify of [u=>u.profile.permissions.purchase.inventoryExport=false,u=>u.profile.active=false,u=>u.profile.storeId='b',u=>u.profile.role='admin']) {
    const s=stock(),u=user();modify(u);rejectedWithoutChange(s,()=>exportStock(s,request(),u,()=> 'log',activity),403);
  }
  for(const change of [{quantity:0},{quantity:1.2},{quantity:6},{date:'2026-02-30'},{quantity:Number.MAX_SAFE_INTEGER+1}]) {
    const s=stock();rejectedWithoutChange(s,()=>exportStock(s,{...request(),...change},user(),()=> 'log',activity),change.quantity===6?409:400);
  }
});
test('customers can be added and edited with concurrency guards; retries do not duplicate',()=> {
  const s=stock(),u=user(),r=customer();const saved=saveCustomer(s,{...r,actorUid:'admin'},u,()=> 'id',activity);
  assert.equal(saved.createdByUid,'worker');assert.equal(s.customers.length,1);
  saveCustomer(s,r,u,()=> 'id',activity);assert.equal(s.customers.length,1);assert.equal(s.activityHistory.length,1);
  saveCustomer(s,{...r,customerId:saved.id,baseUpdatedAt:saved.updatedAt,name:'An mới',memberTier:'VIP'},u,()=> 'id',activity);
  assert.equal(s.customers[0].name,'An mới');assert.ok(s.customers[0].memberTierStartedAt);assert.equal(s.activityHistory[0].action,'update');
  rejectedWithoutChange(s,()=>saveCustomer(s,{...r,customerId:saved.id,baseUpdatedAt:'stale'},u,()=> 'id',activity),409);
  s.customers.push({id:'other',name:'Bình',phone:'0987'});
  rejectedWithoutChange(s,()=>saveCustomer(s,{...r,customerId:saved.id,name:'Bình',phone:'0987',baseUpdatedAt:s.customers[0].updatedAt},u,()=> 'id',activity),409);
});
test('customer rights cannot delete, target other stores or pass invalid data',()=> {
  for(const modify of [u=>u.profile.permissions.sales.customerManage=false,u=>u.profile.storeId='b',u=>u.profile.active=false]) {
    const s=stock(),u=user();modify(u);rejectedWithoutChange(s,()=>saveCustomer(s,customer(),u,()=> 'id',activity),403);
  }
  for(const change of [{delete:true},{name:''},{createdAt:'2026-02-30T01:00:00Z'}]) {
    const s=stock();rejectedWithoutChange(s,()=>saveCustomer(s,{...customer(),...change},user(),()=> 'id',activity),400);
  }
  const allowed=server.match(/if \(!\[([^\]]+)\]\.includes\(type\)\)/)[1];assert.ok(allowed.includes('"inventory-export"'));assert.ok(allowed.includes('"customer-save"'));assert.ok(!allowed.includes('"customer-delete"'));
  assert.match(server,/hasEmployeePermission\(user, "purchase", "inventoryExport"\)/);assert.match(server,/hasEmployeePermission\(user, "sales", "customerManage"\)/);
  assert.match(server,/transaction\.set\(stateRef/);assert.match(fs.readFileSync('firestore.rules','utf8'),/match \/quanlycuahang\/shared-state \{\s*allow read, write: if isAdmin\(\);/);
  assert.match(app,/const canManageInventory = !isEmployeeUser\(\);/);assert.match(app,/canExportInventory\s*\? `<button class="inventory-export-button"/);
});
