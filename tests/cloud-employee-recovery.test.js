const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../cloud-sync-core'),{createCloudHarness}=require('./helpers/cloud-sync-harness');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
function employeeHarness(request){
 const h=createCloudHarness();h.context.isEmployeeUser=()=>true;h.context.callEmployeeFunction=request;
 h.context.getFirstEmployeeTab=()=> 'purchase';h.context.activateTab=()=>{};
 vm.runInContext(source.slice(source.indexOf('async function loadEmployeeState('),source.indexOf('async function saveStateToCloud(')),h.context);
 return h;
}
test('employee reads ignore old-account and pre-mutation responses without exposing their stores',async()=>{
 for(const change of ['logout','mutation']){
  let resolve;const h=employeeHarness(()=>new Promise(r=>resolve=r));h.context.initCloudStorage();const pending=h.context.cloudStore.readPromise;
  if(change==='logout')h.context.stopCloudStorage();else++h.context.cloudMutationVersion;
  resolve({state:{stores:[{id:'old-employee-data'}]}});await pending;
  assert.equal(h.context.state.stores.length,0);
  if(change==='mutation')assert.ok([...h.timers.values()].some(t=>t.ms===1000));
 }
});
test('employee function deadlines apply to reads only; mutations are never automatically replayed',async()=>{
 let deadlines=0,calls=0;
 const context={authState:{user:{getIdToken:async()=> 'test-token'}},getEmployeeFunctionUrl:()=> 'https://fake.test',fetch:async()=>{calls++;return{ok:true,json:async()=>({ok:true})};},window:{CloudSyncCore:{withDeadline:async fn=>{deadlines++;return Core.withDeadline(fn,10);}}}};
 vm.runInNewContext(source.slice(source.indexOf('async function callEmployeeFunction('),source.indexOf('const employeeManagerState =')),context);
 assert.equal((await context.callEmployeeFunction('getStateUrl')).ok,true);
 assert.equal((await context.callEmployeeFunction('saveMutationUrl',{mutation:{type:'test'}})).ok,true);
 assert.equal(deadlines,1);assert.equal(calls,2);
 context.fetch=()=>new Promise(()=>{});
 await assert.rejects(context.callEmployeeFunction('getStateUrl'),e=>e.code==='deadline-exceeded');
});
test('a late employee mutation acknowledgement cannot repopulate state after logout',async()=>{
 let resolve;const context={authState:{user:{uid:'employee'}},cloudStore:{enabled:true,docRef:{}},cloudMutationVersion:0,updateSyncStatus:()=>{},isEmployeeUser:()=>true,callEmployeeFunction:()=>new Promise(r=>resolve=r),state:{stores:[]}};
 vm.runInNewContext(source.slice(source.indexOf('async function saveStateToCloud('),source.indexOf('function updateSyncStatus(')),context);
 const pending=context.saveStateToCloud({type:'test'});context.cloudStore={enabled:false};context.authState.user=null;
 resolve({state:{stores:[{id:'private'}]}});assert.equal(await pending,false);assert.equal(context.state.stores.length,0);
});
