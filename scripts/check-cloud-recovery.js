// Synthetic auth/network only: this script never accesses real accounts or writes real data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const sample={activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng kiểm thử đồng bộ',categories:{income:[],expense:[]},inventory:[],orders:[],draftOrders:[],entries:[],customers:[]}]};
function encode(value){
 if(value===null)return{nullValue:null};
 if(Array.isArray(value))return{arrayValue:{values:value.map(encode)}};
 if(typeof value==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
 if(typeof value==='boolean')return{booleanValue:value};
 if(typeof value==='number')return{doubleValue:value};
 return{stringValue:String(value)};
}
async function setup(page,{role='admin',profileStalled=false,realtime=false,cached=false,hash='',networkMode='ok'}={}){
 const control={mode:networkMode,reads:0,profileReads:0,employeeReads:0,held:[],errors:[]};
 page.on('pageerror',e=>control.errors.push(e.message));page.on('dialog',d=>d.accept());
 const profile={role,active:true,displayName:role==='admin'?'Admin thử':'Nhân viên thử',storeId:'a',storeIds:['a'],permissions:{purchase:{view:true},sales:{view:true}}};
 await page.addInitScript(({profile,sample,profileStalled,realtime,cached})=>{
   if(cached){localStorage.setItem('store-cashbook-v1',JSON.stringify(sample));localStorage.setItem('store-cashbook-v1-owner','fake-user');}
   window.__fake={writes:0,settings:[],reset:0,listener:null,authCallback:null};
   const user={uid:'fake-user',email:'fake@example.test',getIdToken:async()=> 'fake-test-token'};
   const snapshot=data=>({exists:true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>data});
   const db={settings:value=>window.__fake.settings.push(value),disableNetwork:async()=>{window.__fake.reset++;},enableNetwork:async()=>{},collection:name=>({doc:()=>({
     get:()=>name==='users'?(profileStalled?new Promise(()=>{}):Promise.resolve(snapshot(profile))):new Promise(()=>{}),
     onSnapshot:(_options,next,error)=>{window.__fake.listener={next,error};if(realtime)setTimeout(()=>next(snapshot({state:sample,updatedAt:'2026-10-14T00:00:00Z'})),0);return()=>{window.__fake.listener=null;};},
     set:async()=>{window.__fake.writes++;}
   })})};
   const auth={currentUser:user,onAuthStateChanged:callback=>{window.__fake.authCallback=callback;setTimeout(()=>callback(user),0);return()=>{};},signOut:async()=>{auth.currentUser=null;window.__fake.authCallback(null);}};
   const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=> 'fake-timestamp'};
   window.firebase={apps:[],initializeApp:()=>({}),app:()=>({}),auth:()=>auth,firestore};
 },{profile,sample,profileStalled,realtime,cached});
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='firestore.googleapis.com'){
     assert.equal(route.request().method(),'GET');assert.equal(route.request().headers().authorization,'Bearer fake-test-token');
     const isProfile=url.pathname.includes('/documents/users/');
     if(isProfile)control.profileReads++;else{assert.equal(role,'admin','employees must not read shared-state');control.reads++;}
     if(!isProfile&&control.mode==='hang'){control.held.push(route);return;}
     if(!isProfile&&control.mode==='error')return route.fulfill({status:503,json:{error:{message:'Synthetic unavailable'}}});
     if(!isProfile&&control.mode==='denied')return route.fulfill({status:403,json:{error:{message:'Synthetic permission denial'}}});
     const data=isProfile?profile:{state:sample,updatedAt:'2026-10-14T00:00:00Z'};
     return route.fulfill({json:{name:'projects/test/documents/test',fields:encode(data).mapValue.fields}});
   }
   if(url.hostname==='employee.test'){
     assert.equal(role,'employee');assert.equal(route.request().method(),'POST');control.employeeReads++;
     if(control.mode==='hang'){control.held.push(route);return;}
     if(control.mode==='error')return route.fulfill({status:503,json:{error:'Synthetic unavailable'}});
     return route.fulfill({json:{state:sample,profile}});
   }
   if(url.hostname!=='cloud-recovery.test')return route.abort();
   if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={apiKey:"fake",projectId:"fake-project",authDomain:"fake.test"};window.employeeFunctionConfig={getStateUrl:"https://employee.test/state"};'});
   const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
   return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
 });
 await page.goto('http://cloud-recovery.test/'+hash);
 await page.waitForFunction(()=>typeof cloudStore!=='undefined'&&cloudStore.enabled);
 return control;
}
const ready=page=>page.waitForFunction(()=>cloudStore.ready&&state.stores[0]?.id==='a');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.BULK_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
   for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]){
     const page=await browser.newPage({viewport:{width,height},...(width<700?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
     const c=await setup(page,{profileStalled:width===375&&height===900,cached:true});
     assert.equal(await page.evaluate(()=>state.stores[0]?.id),'a','own cached data shown before recovery');
     await page.evaluate(()=>{els.storeName.value='Must not save';els.storeForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
     assert.equal(await page.evaluate(()=>state.stores.length),1,'initial pending submit is blocked before changing local data');
     await ready(page);assert.ok(c.reads>=1);assert.equal(await page.evaluate(()=>window.__fake.writes),0);
     assert.equal(await page.locator('#syncRetryButton').isVisible(),false);
     if(width<700)assert.equal(await page.evaluate(()=>window.__fake.settings[0].experimentalForceLongPolling),true);
     c.mode='error';await page.evaluate(()=>refreshCloudFromServer(true));
     assert.equal(await page.locator('#syncRetryButton').isVisible(),true);
     assert.equal(await page.evaluate(()=>state.stores[0].id),'a','failure preserves trusted data');
     const b=await page.locator('#syncRetryButton').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.height>=36);
     if(process.env.SYNC_SHOTS)await page.screenshot({path:path.join(process.env.SYNC_SHOTS,`cloud-retry-${width}-${height}.png`)});
     c.mode='ok';await page.locator('#syncRetryButton').click();await ready(page);
     await page.waitForFunction(()=>document.getElementById('syncStatus').dataset.status==='ok');
     const previous=c.reads;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(n=>cloudStore.lastServerAt>n,await page.evaluate(()=>cloudStore.lastServerAt-1));
     await page.waitForTimeout(80);assert.ok(c.reads>previous,'online triggers a read without restart');
     await page.waitForFunction(()=>cloudStore.readPromise===null);let count=c.reads;
     await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForFunction(()=>cloudStore.readPromise===null);assert.ok(c.reads>count,'restoring from back/forward cache refreshes data');
     count=c.reads;await page.evaluate(()=>{cloudStore.lastServerAt-=11000;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>cloudStore.readPromise===null);assert.ok(c.reads>count,'returning from background refreshes data');
     assert.deepEqual(c.errors,[]);await page.close();console.log(`Sync ${width}x${height}: cached startup, REST recovery, retry, reconnect, no writes/overflow/errors OK`);
   }
   const normal=await browser.newPage();const nc=await setup(normal,{realtime:true});await ready(normal);await normal.waitForTimeout(1500);assert.equal(nc.reads,0,'healthy realtime startup does not poll REST');await normal.close();
   const timeout=await browser.newPage({viewport:{width:375,height:900}});const tc=await setup(timeout);tc.mode='hang';await timeout.waitForFunction(()=>document.getElementById('syncStatus').dataset.status==='warning',null,{timeout:16000});assert.equal(await timeout.evaluate(()=>cloudStore.initialLoadPending),true);tc.mode='ok';await timeout.locator('#syncRetryButton').click();await ready(timeout);assert.equal(await timeout.evaluate(()=>window.__fake.writes),0);await timeout.close();console.log('Hung HTTP request: bounded timeout and same-session manual retry OK');
   const stale=await browser.newPage();const sc=await setup(stale,{realtime:true});await ready(stale);sc.mode='hang';const read=stale.evaluate(()=>refreshCloudFromServer(true));await stale.waitForTimeout(100);assert.equal(sc.held.length,1);await stale.locator('#signOutButton').click();await sc.held[0].fulfill({json:{name:'test',fields:encode({state:sample}).mapValue.fields}});await read;assert.equal(await stale.evaluate(()=>state.stores.length),0);assert.equal(await stale.locator('#loginForm').isVisible(),true);await stale.close();console.log('Late server response after logout cannot expose old data OK');
   const employee=await browser.newPage();const ec=await setup(employee,{role:'employee',cached:true});await ready(employee);assert.equal(ec.reads,0);assert.ok(ec.employeeReads>=1);await employee.evaluate(()=>activateTab('sales'));await employee.evaluate(()=>refreshCloudFromServer(true));assert.equal(await employee.evaluate(()=>document.body.dataset.activeTab),'sales','periodic reads preserve active tab');assert.deepEqual(ec.errors,[]);await employee.close();console.log('Employee uses filtered endpoint only and preserves active page OK');
   const hash=await browser.newPage();const hc=await setup(hash,{cached:true,hash:'#customers',networkMode:'error'});assert.equal(await hash.locator('#customersPage').isVisible(),true);await hash.locator('#closeCustomersTop').click();assert.equal(await hash.locator('#customersPage').isVisible(),false);await hash.waitForFunction(()=>document.getElementById('syncStatus').dataset.status==='warning');hc.mode='ok';await hash.locator('#syncRetryButton').click();await ready(hash);await hash.close();console.log('Cached hash page can close while startup is pending; no inert-page trap OK');
   const denied=await browser.newPage();const dc=await setup(denied,{cached:true,networkMode:'denied'});await denied.waitForFunction(()=>!document.getElementById('authStartupRetry').hidden);assert.equal(await denied.locator('#appShell').isVisible(),false);assert.equal(await denied.evaluate(()=>cloudStore.initialLoadPending),true);assert.equal(await denied.evaluate(()=>window.__fake.writes),0);assert.equal(dc.reads,1);await denied.close();console.log('Denied shared-state read hides data and does not bypass permissions or loop OK');
   const sdk=await browser.newPage();let sdkMode='hang',sdkRequests=0;const sdkErrors=[];sdk.on('pageerror',e=>sdkErrors.push(e.message));
   await sdk.route('**/*',route=>{
     const url=new URL(route.request().url());
     if(url.hostname==='www.gstatic.com'){
       sdkRequests++;if(sdkMode==='hang')return;
       const body=url.pathname.includes('firebase-app-compat')?'window.firebase={apps:[],initializeApp:()=>({}),app:()=>({})};':url.pathname.includes('firebase-auth-compat')?'window.firebase.auth=()=>({currentUser:null,onAuthStateChanged:callback=>{queueMicrotask(()=>callback(null));return()=>{};}});':'window.firebase.firestore=()=>({settings(){}});';
       return route.fulfill({contentType:'application/javascript',body});
     }
     if(url.hostname!=='cloud-recovery.test')return route.abort();
     if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={apiKey:"fake",projectId:"fake-project"};'});
     const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
     return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
   });
   await sdk.goto('http://cloud-recovery.test/',{waitUntil:'domcontentloaded'});await sdk.waitForFunction(()=>typeof window.retryAuthStartup==='function');await sdk.waitForFunction(()=>!document.getElementById('authStartupRetry').hidden,null,{timeout:12000});assert.match(await sdk.locator('#authStartupMessage').textContent(),/Firebase.*quá thời gian/);sdkMode='ok';await sdk.locator('#authStartupRetry').click();await sdk.waitForFunction(()=>!document.getElementById('loginForm').hidden);assert.ok(sdkRequests>=4);assert.deepEqual(sdkErrors,[]);await sdk.close();console.log('Stalled CDN does not block app code; deadline and retry recover without reloading OK');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
