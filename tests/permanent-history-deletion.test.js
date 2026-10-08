const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function harness({employee=false,offline=false,fail=false,confirm=true,remote}={}){
  const local={activeStoreId:'a',stores:[{id:'a',entries:[{id:'e',type:'income',note:'Khoản thử',status:'cancelled'}],orders:[],inventoryLogs:[],activityHistory:[]}]};
  let saved=clone(remote||local),transactions=0,inventoryCalls=0;const alerts=[],surface={inert:false};
  const context={state:local,authState:{user:{uid:'admin'}},pendingAdminCloudWrites:new Set(),isAdminUser:()=>!employee,getActiveStore:()=>context.state.stores[0],isCancelledEntry:r=>r.status==='cancelled',escapeHtml:s=>String(s),syncInventoryItemAfterLogDelete:()=>inventoryCalls++,normalizeState:x=>x,saveStateToCache:()=>{},render:()=>{},updateSyncStatus:()=>{},closeSalesOrderDetailModal:()=>{},closeCustomerHistoryModal:()=>{},document:{body:{children:[surface]},querySelectorAll:()=>[]},window:{confirm:()=>confirm,alert:x=>alerts.push(x),firebase:{firestore:{FieldValue:{serverTimestamp:()=>123}}}}};
  context.cloudStore={enabled:!offline,docRef:{},db:{runTransaction:async callback=>{transactions++;if(fail)throw Error('Mất mạng');let update;const result=await callback({get:async()=>({exists:true,data:()=>({state:clone(saved)})}),update:(_,value)=>update=value,set:(_,value)=>update=value});saved=clone(update.state);return result;}}};
  Object.assign(context.window,{setTimeout,clearTimeout});
  vm.createContext(context);vm.runInContext(app.slice(app.indexOf('let historyPurgePending = false;'),app.indexOf('function deleteEntry(entryId) {')),context);
  return {context,alerts,surface,get remote(){return saved},get transactions(){return transactions},get inventoryCalls(){return inventoryCalls}};
}
test('permanent receipt deletion removes only exact ID and retains closing-book source',()=>{
  const {context:c}=harness();const store=c.state.stores[0];store.entries.push({id:'other',status:'cancelled'});
  store.closingMonths=[{days:[{shifts:[{income:[{id:'source',transferredEntryId:'e',amount:123}],expense1:[{id:'legacy',transferredEntryId:'e'}]}]}]}];
  assert.equal(c.applyPermanentHistoryDeletion(store,'entry','e'),true);assert.deepEqual(store.entries.map(x=>x.id),['other']);
  const shift=store.closingMonths[0].days[0].shifts[0];assert.equal(shift.income[0].amount,123);assert.equal(shift.income[0].transferredEntryId,undefined);assert.equal(shift.expense1[0].transferredEntryId,undefined);
  assert.equal(c.applyPermanentHistoryDeletion(store,'entry','e'),false);
});
test('active financial records cannot be purged and no mutation occurs',()=>{
  for(const type of ['entry','sales-order']){const {context:c}=harness(),store=c.state.stores[0];store[type==='entry'?'entries':'orders']=[{id:'active'}];const before=clone(store);assert.throws(()=>c.applyPermanentHistoryDeletion(store,type,'active'),/Hãy hủy/);assert.deepEqual(store,before);}
});
test('sales purge cascades linked receipts but never restores stock a second time',()=>{
  const {context:c}=harness(),store=c.state.stores[0];store.orders=[{id:'order',status:'cancelled',inventoryDeducted:false},{id:'keep'}];store.entries=[{id:'linked',orderId:'order',status:'cancelled'},{id:'keep'}];store.inventory=[{id:'stock',quantity:7}];
  assert.throws(()=>c.applyPermanentHistoryDeletion(store,'entry','linked'),/Lịch sử bán hàng/);
  c.applyPermanentHistoryDeletion(store,'sales-order','order');assert.deepEqual(store.orders.map(x=>x.id),['keep']);assert.deepEqual(store.entries.map(x=>x.id),['keep']);assert.equal(store.inventory[0].quantity,7);
});
test('activity purge removes only journal; inventory purge uses existing recalculation',()=>{
  const h=harness(),c=h.context,store=c.state.stores[0];store.activityHistory=[{id:'a',targetId:'e'}];store.inventoryLogs=[{id:'l'}];c.applyPermanentHistoryDeletion(store,'activity','a');assert.equal(store.entries.length,1);c.applyPermanentHistoryDeletion(store,'inventory-log','l');assert.equal(h.inventoryCalls,1);assert.equal(store.inventoryLogs.length,0);
  for(const type of ['stores','__proto__','constructor'])assert.throws(()=>c.applyPermanentHistoryDeletion(store,type,'e'),/không hợp lệ/);
});
test('transaction deletes from latest server snapshot, preserves concurrent additions and other stores',async()=>{
  const remote={activeStoreId:'a',stores:[{id:'a',entries:[{id:'e',status:'cancelled'},{id:'concurrent',amount:5}]},{id:'b',entries:[{id:'e',amount:9}]}]};const h=harness({remote});assert.equal(await h.context.purgeHistoryRecord('entry','e'),true);assert.deepEqual(h.remote.stores[0].entries.map(x=>x.id),['concurrent']);assert.equal(h.remote.stores[1].entries[0].amount,9);assert.equal(h.context.state.stores[0].entries[0].id,'concurrent');assert.equal(h.surface.inert,false);
});
test('permission denial, dismissed confirmation, offline and Firebase failures keep rows intact',async()=>{
  for(const options of [{employee:true},{confirm:false},{offline:true},{fail:true}]){const h=harness(options);assert.equal(await h.context.purgeHistoryRecord('entry','e'),false);assert.equal(h.context.state.stores[0].entries.length,1);assert.equal(h.remote.stores[0].entries.length,1);assert.equal(h.surface.inert,false);}
  assert.equal(harness({employee:true}).context.renderHistoryPurgeButton('entry','e'),'');
});
test('remote reactivation blocks deletion even when local row was cancelled',async()=>{
  const h=harness({remote:{stores:[{id:'a',entries:[{id:'e',status:'active'}]}]}});assert.equal(await h.context.purgeHistoryRecord('entry','e'),false);assert.equal(h.remote.stores[0].entries.length,1);assert.match(h.alerts[0],/Hãy hủy/);
});
test('queued older cloud saves finish before permanent deletion',async()=>{
  const h=harness();let resolve;h.context.pendingAdminCloudWrites.add(new Promise(r=>resolve=r));const deletion=h.context.purgeHistoryRecord('entry','e');await Promise.resolve();assert.equal(h.transactions,0);assert.equal(h.surface.inert,true);resolve();assert.equal(await deletion,true);assert.equal(h.transactions,1);
});
test('legacy inventory logs without ID require unambiguous content',async()=>{
  for(const count of [1,2]){const h=harness({remote:{stores:[{id:'a',inventoryLogs:Array.from({length:count},()=>({itemName:'Hàng',date:'2026-10-08'}))}]}});h.context.state.stores[0].inventoryLogs=[{id:'legacy',itemName:'Hàng',date:'2026-10-08'}];assert.equal(await h.context.purgeHistoryRecord('inventory-log','legacy'),count===1);assert.equal(h.remote.stores[0].inventoryLogs.length,count===1?0:2);}
});
