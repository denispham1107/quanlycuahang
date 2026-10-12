const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {applyEmployeeInventoryTypeChange:changeType}=require('../functions/employee-managed-mutations');
const app=fs.readFileSync('app.js','utf8'),server=fs.readFileSync('functions/index.js','utf8'),html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('styles.css','utf8');
const user=()=>({uid:'worker',profile:{role:'employee',active:true,storeId:'a',permissions:{purchase:{inventoryTypeManage:true}}}});
const store=()=>({id:'a',inventory:[{id:'i',name:'Cát',groupName:'A',quantity:4,totalCost:35,lastPrice:10,salePrice:20,updatedAt:'t'},{id:'j',name:'Cát',groupName:'B',quantity:2,totalCost:20,lastPrice:10,salePrice:20,updatedAt:'t'}],inventoryLogs:[],activityHistory:[]});
function request(s,type='service') {return {type:'inventory-type-change',storeId:'a',requestId:'r',inventoryId:'i',itemType:type,date:'2026-10-12',typeChanges:s.inventory.filter(i=>(i.itemType||'goods')!==type).map(i=>({inventoryId:i.id,name:i.name,groupName:i.groupName,fromType:i.itemType||'goods',toType:type,quantity:i.quantity,totalCost:i.totalCost,lastPrice:i.lastPrice,salePrice:i.salePrice,updatedAt:i.updatedAt}))};}
let id=0;const activity=(u,area,message,target)=>({area,message,actorUid:u.uid,...target});
const apply=(s,r,u=user())=>changeType(s,r,u,()=>String(++id),activity);
function reject(s,r,u,status){const before=JSON.stringify(s);assert.throws(()=>apply(s,r,u),e=>e.status===status);assert.equal(JSON.stringify(s),before);}
test('inventory kind permission is separate, defaults off, and only enables dependent views on both sides',()=>{
 for(const source of [app,server]){const start=source.indexOf('const DEFAULT_EMPLOYEE_PERMISSIONS ='),end=source.indexOf('\nfunction ',source.indexOf('function normalizeEmployeePermissions',start)+10),ctx={};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);for(const profile of [{},{permissions:{}},{permissions:{purchase:{inventoryTypeManage:'true'}}}])assert.equal(ctx.normalizeEmployeePermissions(profile).purchase.inventoryTypeManage,false);const p=ctx.normalizeEmployeePermissions({permissions:{purchase:{inventoryTypeManage:true}}});assert.equal(p.purchase.inventoryView,true);assert.equal(p.purchase.view,true);assert.equal(p.purchase.create,false);assert.equal(p.purchase.inventoryExport,false);}
 assert.match(html,/name="purchaseInventoryTypeManage" type="checkbox"/);assert.match(app,/field\("purchaseInventoryTypeManage"/);assert.match(server,/hasEmployeePermission\(user, "purchase", "inventoryTypeManage"\)/);
});
test('employee changes all same-name groups only after current snapshots, keeping prices/name/group and actor history',()=>{
 const s=store(),r=request(s);apply(s,r);assert.ok(s.inventory.every(i=>i.itemType==='service'&&i.quantity===0&&i.totalCost===0));assert.equal(s.inventory[0].lastPrice,10);assert.equal(s.inventory[0].salePrice,20);assert.equal(s.inventory[0].name,'Cát');assert.equal(s.inventory[0].groupName,'A');assert.equal(s.inventoryLogs.length,2);assert.equal(s.inventoryLogs.find(l=>l.inventoryId==='i').oldTotalCost,35);assert.ok(s.inventoryLogs.every(l=>l.type==='type-change'&&l.createdByUid==='worker'));
 apply(s,r);assert.equal(s.inventoryLogs.length,2,'retry does not add logs');assert.equal(s.activityHistory.length,1);
 const reverse=request(s,'goods');reverse.requestId='r2';apply(s,reverse);assert.ok(s.inventory.every(i=>i.itemType==='goods'&&i.quantity===0&&i.totalCost===0));assert.equal(s.inventory[0].salePrice,20);
});
test('view/create/export do not imply kind-change rights and revoked/foreign-store profiles are rejected without writes',()=>{
 for(const mutate of [u=>u.profile.permissions.purchase={view:true,create:true,inventoryExport:true},u=>u.profile.permissions.purchase.inventoryTypeManage=false,u=>u.profile.active=false,u=>u.profile.role='admin',u=>u.profile.storeId='b']){const s=store(),u=user();mutate(u);reject(s,request(s),u,403);}
});
test('forged amounts, name, prices, quantities or omitted snapshots cannot pass kind-only endpoint',()=>{
 for(const field of ['quantity','totalCost','name','groupName','lastPrice','salePrice']){const s=store();reject(s,{...request(s),[field]:999},user(),400);}
 for(const field of ['inventoryId','name','groupName','fromType','toType','quantity','totalCost','lastPrice','salePrice','updatedAt']){const s=store(),r=request(s);r.typeChanges[0][field]='forged';reject(s,r,user(),409);}
 for(const snapshots of [[],true,null]){const s=store();reject(s,{...request(s),typeChanges:snapshots},user(),409);}
});
test('concurrent changes and new same-name groups invalidate confirmations atomically',()=>{
 const s=store(),r=request(s);s.inventory[0].quantity++;reject(s,r,user(),409);
 const s2=store(),r2=request(s2);s2.inventory.push({...s2.inventory[0],id:'new'});reject(s2,r2,user(),409);
 const s3=store(),r3=request(s3);r3.typeChanges=[r3.typeChanges[0],r3.typeChanges[0]];reject(s3,r3,user(),409);
});
test('invalid kind/date, missing inventory and mismatched retry are rejected',()=>{
 for(const patch of [{itemType:'fake'},{date:'2026-02-30'},{inventoryId:'missing'}]){const s=store();reject(s,{...request(s),...patch},user(),patch.inventoryId?404:400);}
 const s=store(),r=request(s);apply(s,r);reject(s,{...r,itemType:'goods'},user(),409);
});
test('mobile dialog skin is scoped, keeps all controls and uses accessible titles/44px inputs',()=>{
 for(const id of ['editInventoryForm','editInventoryLogForm','inventoryHistoryTitle'])assert.ok(html.includes(id));
 assert.match(css,/html\.mobile-app-theme \.inventory-pastel-card/);assert.match(css,/\.inventory-dialog-icon \{ display: none; \}/);assert.match(css,/inventory-pastel-card input[^}]*min-height: 44px[^}]*font-size: 16px/);
 assert.match(app,/input\.readOnly = isEmployeeUser\(\)/);assert.match(app,/saveEmployeeManagedMutation\(\{ type: "inventory-type-change"/);assert.match(app,/const typeChanges = confirmPurchaseTypeChanges\(store, \[\{ name: item\.name, itemType \}\]\)/);
 for(const id of ['deleteInventoryLog','cancelEditInventoryLog','cancelEditInventory','inventoryHistorySearch','inventoryHistoryDate','closeInventoryHistory'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
});
