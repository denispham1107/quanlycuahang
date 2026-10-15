const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

function restHarness(fetch) {
  const context = {window:{},fetch,AbortController,setTimeout,clearTimeout};
  vm.runInNewContext(source('cloud-sync-core.js'), context);
  return context.window.CloudSyncCore;
}
test('fallback reads use the signed-in ID token and never cache data or write documents', async () => {
  let request;
  const core = restHarness(async (url, options) => {
    request = {url, options};
    return {ok:true,json:async()=>({name:'document',fields:{state:{mapValue:{fields:{stores:{arrayValue:{}}}}}}})};
  });
  const snapshot = await core.readDocument({projectId:'test-project'}, {getIdToken:async()=> 'fake-id-token'}, 'shared', 'state');
  assert.equal(snapshot.metadata.fromCache, false);
  assert.equal(snapshot.data().state.stores.length, 0);
  assert.equal(request.options.headers.Authorization, 'Bearer fake-id-token');
  assert.equal(request.options.cache, 'no-store');
  assert.equal(request.options.method, undefined); // Default GET; no external mutation.
  assert.match(request.url, /test-project\/databases\/\(default\)\/documents\/shared\/state$/);
});
test('missing documents and denied reads remain distinct, and body/token stalls are bounded', async () => {
  const user = {getIdToken:async()=> 'fake'};
  const missing = restHarness(async()=>({status:404}));
  assert.equal((await missing.readDocument({projectId:'p'},user,'c','d')).exists,false);
  for (const [status,code] of [[401,'unauthenticated'],[403,'permission-denied'],[503,'unavailable']]) {
    const core = restHarness(async()=>({status,ok:false,json:async()=>({error:{message:'test'}})}));
    await assert.rejects(core.readDocument({projectId:'p'},user,'c','d'),error=>error.code===code);
  }
  for (const hang of ['token','body']) {
    const core = restHarness(async()=>({ok:true,json:()=>new Promise(()=>{})}));
    await assert.rejects(core.readDocument({projectId:'p'}, hang==='token'?{getIdToken:()=>new Promise(()=>{})}:user,'c','d',5),error=>error.code==='deadline-exceeded');
  }
});

test('an expired ID token is renewed once, but forbidden reads are never bypassed or retried', async () => {
  let requests=0,renewals=0;
  const user={getIdToken:async force=>{if(force)renewals++;return force?'new-token':'old-token';}};
  const core=restHarness(async(_url,options)=>{
    requests++;return options.headers.Authorization==='Bearer old-token'?{status:401,ok:false,json:async()=>({})}:{ok:true,json:async()=>({name:'test',fields:{ok:{booleanValue:true}}})};
  });
  assert.equal((await core.readDocument({projectId:'p'},user,'c','d')).data().ok,true);
  assert.equal(requests,2);assert.equal(renewals,1);
  requests=0;renewals=0;
  const denied=restHarness(async()=>{requests++;return{status:403,ok:false,json:async()=>({})};});
  await assert.rejects(denied.readDocument({projectId:'p'},user,'c','d'),e=>e.code==='permission-denied');
  assert.equal(requests,1);assert.equal(renewals,0);
});

test('SDK loading is non-blocking, coalesced, bounded and retryable after CDN failures', async () => {
  const scripts=[],timers=new Map();let id=0;
  const context={window:{},setTimeout:(fn)=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),document:{createElement:()=>({remove(){this.removed=true;}}),head:{append:s=>scripts.push(s)}}};
  vm.runInNewContext(source('firebase-loader.js'),context);
  const first=context.window.ensureFirebaseSdk(), second=context.window.ensureFirebaseSdk();
  assert.equal(first,second);
  assert.equal(scripts.length,1);
  assert.equal(scripts[0].async,true);
  const rejection=assert.rejects(first,/quá thời gian/);
  [...timers.values()][0]();await rejection;
  assert.equal(scripts[0].removed,true);
  const retry=context.window.ensureFirebaseSdk();
  assert.equal(scripts.length,2);
  assert.match(scripts[1].src,/\?retry=2$/);
  context.window.firebase={initializeApp(){}};scripts[1].onload();
  await Promise.resolve();await Promise.resolve();
  assert.equal(scripts.length,4);
  context.window.firebase.auth=()=>{};context.window.firebase.firestore=()=>{};
  scripts[2].onload();scripts[3].onload();await retry;
  assert.equal(timers.size,0);
  await context.window.ensureFirebaseSdk();assert.equal(scripts.length,4);
  const html=source('index.html');
  assert.doesNotMatch(html,/<script[^>]+src="https:\/\/www\.gstatic\.com\/firebasejs/);
});

test('PWA updates migrate and retain Firebase SDK downloads instead of redownloading every release', async () => {
  const sdkUrl='https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js';
  const response={ok:true};
  const currentCache=source('service-worker.js').match(/const CACHE_VERSION = "([^"]+)"/)[1];
  const buckets=new Map([['unrelated-app-cache',new Map()],['quanlycuahang-pwa-v165',new Map([[sdkUrl,response],['https://app.test/app.js',{}]])],[currentCache,new Map()]]);
  const events={};let claimed=false;
  const caches={keys:async()=>[...buckets.keys()],delete:async key=>buckets.delete(key),open:async key=>{
    if(!buckets.has(key))buckets.set(key,new Map());const b=buckets.get(key);
    return {keys:async()=>[...b.keys()].map(url=>({url})),match:async req=>b.get(req.url),put:async(req,res)=>b.set(req.url,res)};
  }};
  vm.runInNewContext(source('service-worker.js'),{caches,URL,Response,self:{addEventListener:(name,fn)=>events[name]=fn,clients:{claim:async()=>{claimed=true;}}}});
  let pending;events.activate({waitUntil:p=>pending=p});await pending;
  assert.equal(claimed,true);
  assert.equal(buckets.has('quanlycuahang-pwa-v165'),false);
  assert.equal(buckets.get('quanlycuahang-firebase-sdk-10.12.5').get(sdkUrl),response);
  assert.equal(buckets.has(currentCache),true);
  assert.equal(buckets.has('unrelated-app-cache'),true);
  events.activate({waitUntil:p=>pending=p});await pending;
  assert.equal(buckets.get('quanlycuahang-firebase-sdk-10.12.5').get(sdkUrl),response);
});
