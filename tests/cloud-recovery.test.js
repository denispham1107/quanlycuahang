const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../cloud-sync-core'),{createCloudHarness,snapshot}=require('./helpers/cloud-sync-harness');
test('a completely stalled realtime listener is bypassed by a bounded server read',async()=>{const h=createCloudHarness();h.context.initCloudStorage();assert.equal(h.context.cloudStore.initialLoadPending,true);await h.fire(1200);assert.equal(h.context.state.stores[0].id,'remote');assert.equal(h.context.cloudStore.ready,true);assert.equal(h.writes.length,0);});
test('late cache and older realtime events cannot replace a newer REST result',async()=>{const h=createCloudHarness();h.context.initCloudStorage();await h.fire(1200);h.listeners[0].next(snapshot({stores:[]},{cached:true}));h.listeners[0].next(snapshot({stores:[]},{revision:'2026-10-13T00:00:00Z'}));assert.equal(h.context.state.stores[0].id,'remote');});
test('logout, account switches and mutations invalidate a pending recovery read',async()=>{for(const change of ['logout','mutation']){let resolve;const h=createCloudHarness({read:()=>new Promise(r=>resolve=r)});h.context.initCloudStorage();const read=h.context.refreshCloudFromServer(true);if(change==='logout')h.context.stopCloudStorage();else++h.context.cloudMutationVersion;resolve(snapshot({stores:[{id:'stale'}]}));await read;assert.equal(h.context.state.stores.length,0);}});
test('offline/timeout states keep cached data and offer automatic finite retries',async()=>{const h=createCloudHarness({state:{stores:[{id:'cached'}]},read:async()=>{throw Object.assign(Error('timeout'),{code:'deadline-exceeded'})}});h.context.initCloudStorage();await h.fire(1200);assert.equal(h.context.state.stores[0].id,'cached');assert.equal(h.context.cloudStore.initialLoadPending,true);assert.ok([...h.timers.values()].some(t=>t.ms===3000));h.context.navigator.onLine=false;await h.context.refreshCloudFromServer(true);assert.ok([...h.timers.values()].some(t=>t.ms===15000));});
test('permission denial does not loop or unlock writes; initial mutations are stopped before handlers',async()=>{const h=createCloudHarness({read:async()=>{throw Object.assign(Error('denied'),{code:'permission-denied'})}});h.context.initCloudStorage();let blocked=0;h.events.submit({preventDefault:()=>blocked++,stopImmediatePropagation:()=>blocked++});assert.equal(blocked,2);await h.fire(1200);assert.equal(h.context.cloudStore.ready,false);assert.equal(h.timers.size,0);});
test('deadline covers promises that never settle and aborts the underlying HTTP request',async()=>{let signal;await assert.rejects(Core.withDeadline(s=>{signal=s;return new Promise(()=>{})},5),e=>e.code==='deadline-exceeded');assert.equal(signal.aborted,true);});
test('a stalled SDK read uses an independent fallback, while access denial is never bypassed',async()=>{const s=snapshot({stores:[]});assert.equal(await Core.readWithFallback(()=>new Promise(()=>{}),async()=>s,{delay:1,timeout:40}),s);let used=false;await assert.rejects(Core.readWithFallback(async()=>{throw Object.assign(Error('denied'),{code:'permission-denied'})},()=>{used=true},{delay:20,timeout:40}));assert.equal(used,false);});
test('REST decoding preserves nested business data, zero quantities and services',()=>{assert.deepEqual(Core.decodeFields({stores:{arrayValue:{values:[{mapValue:{fields:{id:{stringValue:'s'},quantity:{integerValue:'0'},price:{doubleValue:7.5},active:{booleanValue:false},itemType:{stringValue:'service'}}}}]}}}),{stores:[{id:'s',quantity:0,price:7.5,active:false,itemType:'service'}]});});

test('a fresh realtime result wins over a pending fallback, including late fallback errors',async()=>{
 for(const fail of [false,true]){
  let resolve,reject;const h=createCloudHarness({read:()=>new Promise((r,j)=>{resolve=r;reject=j;})});
  h.context.initCloudStorage();const pending=h.context.refreshCloudFromServer(true);
  h.listeners[0].next(snapshot({stores:[{id:'realtime'}]}));
  if(fail)reject(Error('stale failure'));else resolve(snapshot({stores:[{id:'stale'}]}));
  await pending;assert.equal(h.context.state.stores[0].id,'realtime');
  assert.equal(h.messages.at(-1)[1],'ok');assert.equal(h.timers.size,0);
 }
});
test('malformed cloud data never replaces cached data or enables writes',async()=>{
 const h=createCloudHarness({state:{stores:[{id:'cached'}]},read:async()=>snapshot({stores:null})});
 h.context.initCloudStorage();await h.fire(1200);
 assert.equal(h.context.state.stores[0].id,'cached');assert.equal(h.context.cloudStore.initialLoadPending,true);assert.equal(h.writes.length,0);assert.equal(h.timers.size,0);
});

test('a synchronous listener failure still leaves independent startup recovery scheduled',async()=>{
 const h=createCloudHarness();
 h.context.getConfiguredFirestore=()=>({collection:()=>({doc:()=>({onSnapshot(){throw Error('SDK subscribe failed');}})})});
 h.context.initCloudStorage();await h.fire(1200);
 assert.equal(h.context.state.stores[0].id,'remote');assert.equal(h.context.cloudStore.ready,true);
});
