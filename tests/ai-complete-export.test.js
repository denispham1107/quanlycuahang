const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {COMPLETE_EXPORT_SOURCE:source,MAX_COMPLETE_EXPORT_BYTES,normalizeGeneralFileAttachments:normalize}=require('../functions/ai-export-attachment');
const app=fs.readFileSync('app.js','utf8'),server=fs.readFileSync('functions/index.js','utf8');
test('complete exports preserve all stores and JSON bytes beyond former file preview limits',()=>{
 const data={activeStoreId:'a',stores:[{id:'a',notes:'a'.repeat(180000),closingBook:{history:[1,2]}},{id:'b',customers:[{name:'Khách cuối',phone:'0123'}],orders:[{id:'last-sentinel'}]}]};
 const text=JSON.stringify(data,null,2),files=normalize([{name:'du-lieu.json',text,source,truncated:false}]);
 assert.equal(files[0].text,text);assert.deepEqual(JSON.parse(files[0].text),data);assert.equal(files[0].truncated,false);assert.equal(files[0].kind,'json');assert.equal(files[0].size,Buffer.byteLength(text));
});
test('the model input retains the complete validated JSON, including its final records',()=>{
 const text=JSON.stringify({stores:[{id:'a',notes:'z'.repeat(180000)},{id:'last',name:'LAST_RECORD_IN_MODEL_INPUT'}]}),files=normalize([{name:'export.json',source,text}]),ctx={};vm.createContext(ctx);vm.runInContext(server.slice(server.indexOf('function buildGeneralInput('),server.indexOf('async function isModerationFlagged(')),ctx);
 const input=ctx.buildGeneralInput('Đọc tệp',[],files);assert.equal(input.length,1);assert.ok(input[0].content.includes(text));assert.match(input[0].content,/LAST_RECORD_IN_MODEL_INPUT/);assert.doesNotMatch(input[0].content,/đã rút gọn/);
});
test('oversize, malformed, truncated and duplicate complete exports reject instead of silently clipping',()=>{
 for(const file of [{text:'bad'},{text:'[]'},{text:'{}'},{text:'{"stores":[]}',truncated:true}])assert.throws(()=>normalize([{...file,source}]),e=>e.status===400);
 assert.throws(()=>normalize([{source,text:JSON.stringify({stores:[],notes:'x'.repeat(MAX_COMPLETE_EXPORT_BYTES)})}]),e=>e.status===413);
 assert.throws(()=>normalize([{source,text:'{"stores":[]}'},{source,text:'{"stores":[]}'}]),e=>e.status===400);
});
test('ordinary attachments retain bounded preview behavior alongside one full export',()=>{
 const files=normalize([{name:'manual',text:'m'.repeat(200)},{name:'export',source,text:'{"stores":[]}'},{name:'later',text:'z'}],{maxManualChars:100,maxCount:5});
 assert.equal(files.length,2);assert.equal(files[0].source,source);assert.equal(files[0].truncated,false);assert.equal(files[1].text.length,100);assert.equal(files[1].truncated,true);
});
test('AI and download use exactly the same full export document without modifying state',()=>{
 const state={stores:[{id:'a',entries:[{amount:10}]},{id:'b',inventory:[{quantity:2}]}],activeStoreId:'b'},before=JSON.stringify(state),ctx={state,defaultData:{},today:'2026-10-15',Blob,ClosingBookCore:require('../closing-book-core'),ClosingBookExport:require('../closing-book-export'),buildClosingBookAuditReports:()=>[]};vm.createContext(ctx);
 vm.runInContext(app.slice(app.indexOf('function createStateExportPayload('),app.indexOf('function createAIClientStateSnapshot(')),ctx);
 const doc=ctx.createStateExportDocument(),data=JSON.parse(doc.text);assert.ok(data.stores.every(store=>store.closingBookReport.complete));data.stores.forEach(store=>delete store.closingBookReport);assert.deepEqual(data,state);assert.equal(doc.name,'du-lieu-thu-chi-2026-10-15.json');assert.equal(doc.size,new Blob([doc.text]).size);assert.equal(JSON.stringify(state),before);
 assert.match(app,/els\.exportData\.addEventListener\("click", \(\) => \{\s*const exported = createStateExportDocument\(\)/);
});
function sender(fetchImpl){const state={attachments:[{source,name:'export.json',text:JSON.stringify({stores:[{notes:'x'.repeat(140000)}]}),truncated:false}],messages:[],pending:false,requestGeneration:0};const calls=[];const ctx={aiChatState:state,authState:{user:{uid:'admin',getIdToken:async()=> 'TOKEN'}},AI_COMPLETE_EXPORT_SOURCE:source,AI_COMPLETE_EXPORT_MAX_BYTES:MAX_COMPLETE_EXPORT_BYTES,isAdminUser:()=>true,getAISelectedMode:()=> 'general',getAIEndpoint:()=>'/mock',getAIHistoryForRequest:()=>[],addAIMessage:(role,content)=>state.messages.push({role,content}),els:{aiChatInput:{value:''},aiAdminPin:{value:''}},renderAIChat:()=>{},renderAIFileStatus:()=>{},Blob,AbortController,setTimeout:()=>1,clearTimeout:()=>{},fetch:async(...args)=>{calls.push(args);return fetchImpl?fetchImpl(...args):{ok:true,json:async()=>({reply:'Đã nhận'})};}};vm.createContext(ctx);vm.runInContext(app.slice(app.indexOf('async function sendAIChatMessage('),app.indexOf('\nif (els.aiChatMessages)',app.indexOf('async function sendAIChatMessage('))),ctx);return{ctx,state,calls};}
test('general requests carry complete JSON and verified-token header, not client-state previews',async()=>{
 const h=sender();await h.ctx.sendAIChatMessage('Đọc dữ liệu',{automaticExport:true});assert.equal(h.calls.length,1);const options=h.calls[0][1],body=JSON.parse(options.body);assert.equal(options.headers.Authorization,'Bearer TOKEN');assert.equal(body.mode,'general');assert.equal(body.attachments[0].text,h.state.attachments[0].text);assert.equal(body.clientState,undefined);assert.equal(h.state.pending,false);assert.equal(h.state.messages.at(-1).content,'Đã nhận');
});
test('automatic file upload preserves the question draft already typed by the user',async()=>{
 const h=sender();h.ctx.els.aiChatInput.value='Câu hỏi đang soạn';await h.ctx.sendAIChatMessage('Đọc dữ liệu',{automaticExport:true});assert.equal(h.ctx.els.aiChatInput.value,'Câu hỏi đang soạn');await h.ctx.sendAIChatMessage('Câu hỏi đang soạn');assert.equal(h.ctx.els.aiChatInput.value,'');
});
test('late responses cannot add exported data after session switch; failed auto sends retain retryable full file',async()=>{
 let resolve;const h=sender(()=>new Promise(r=>resolve=r));const pending=h.ctx.sendAIChatMessage('Đọc dữ liệu',{automaticExport:true});await new Promise(r=>setImmediate(r));h.ctx.authState.user={uid:'other'};resolve({ok:true,json:async()=>({reply:'STALE_SECRET'})});await pending;assert.ok(!h.state.messages.some(m=>m.content==='STALE_SECRET'));
 const failed=sender(async()=>({ok:false,json:async()=>({error:'Offline'})}));await failed.ctx.sendAIChatMessage('Đọc dữ liệu',{automaticExport:true});assert.equal(failed.state.autoExportError,true);assert.ok(failed.state.attachments[0].text.length>120000);assert.equal(failed.state.pending,false);
});
test('complete exports require active admin authentication before normalization or model use',()=>{
 const code=server.slice(server.indexOf('async function handleGeneralChatRequest('),server.indexOf('async function getEmployeeManagementStores('));assert.match(code,/if \(hasCompleteExport\)[\s\S]*?await requireUserProfile\(req, "admin"\)/);assert.ok(code.indexOf('requireUserProfile')<code.indexOf('normalizeGeneralAttachments'));assert.match(code,/general-export:\$\{exportUser\.uid\}/);assert.match(code,/!hasCompleteExport && shouldUseWebSearch/);assert.match(app,/window\.resetAIChatSession\?\.\(\)/);assert.match(app,/ownerUid: aiChatState\.ownerUid/);
});
test('the server rejects unauthenticated, employee and disabled-account full exports',async()=>{
 let profile={role:'admin',active:true};const ctx={admin:{auth:()=>({verifyIdToken:async token=>{assert.equal(token,'VERIFIED_TOKEN');return{uid:'admin'}}})},db:{collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>profile})})})}};vm.createContext(ctx);vm.runInContext(server.slice(server.indexOf('async function requireUserProfile('),server.indexOf('function employeeId(')),ctx);
 await assert.rejects(()=>ctx.requireUserProfile({headers:{}},'admin'),e=>e.status===401);
 profile={role:'employee',active:true};await assert.rejects(()=>ctx.requireUserProfile({headers:{authorization:'Bearer VERIFIED_TOKEN'}},'admin'),e=>e.status===403);
 profile={role:'admin',active:false};await assert.rejects(()=>ctx.requireUserProfile({headers:{authorization:'Bearer VERIFIED_TOKEN'}},'admin'),e=>e.status===403);
 profile={role:'admin',active:true};assert.equal((await ctx.requireUserProfile({headers:{authorization:'Bearer VERIFIED_TOKEN'}},'admin')).uid,'admin');
});
test('chat caches are UID-scoped, preserve owned history and do not reuse unowned legacy messages',()=>{
 const data=new Map([['chat',JSON.stringify({messages:[{content:'UNOWNED'}]})],['chat:a',JSON.stringify({ownerUid:'a',conversationId:'owned',messages:[{role:'assistant',content:'OWNED_A'}]})]]),ctx={AI_CHAT_STORAGE_KEY:'chat',localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},createId:()=> 'new',aiChatState:{ownerUid:'a',conversationId:'owned',messages:[{role:'user',content:'file name only'}],attachments:[{text:'RAW_EXPORT_NOT_CACHEABLE'}]}};
 vm.createContext(ctx);vm.runInContext(app.slice(app.indexOf('function loadAIOwnedCache('),app.indexOf('function getAIEndpoint(')),ctx);
 assert.equal(ctx.loadAIChatMessages('a')[0].content,'OWNED_A');assert.equal(ctx.loadAIChatMessages('b').length,0);assert.equal(ctx.loadAIChatMessages('').length,0);ctx.saveAIChatMessages();assert.ok(data.get('chat:a').includes('file name only'));assert.ok(!data.get('chat:a').includes('RAW_EXPORT_NOT_CACHEABLE'));assert.equal(data.get('chat').includes('UNOWNED'),true,'unattributed legacy history is preserved on disk, not exposed or deleted');
});
test('oversized full request is rejected locally without any partial upload',async()=>{
 const h=sender();h.state.attachments[0].text=JSON.stringify({stores:[],notes:'x'.repeat(MAX_COMPLETE_EXPORT_BYTES)});await h.ctx.sendAIChatMessage('Đọc dữ liệu',{automaticExport:true});assert.equal(h.calls.length,0);assert.equal(h.state.autoExportError,true);assert.match(h.state.messages.at(-1).content,/không bị cắt bớt/);
});
test('a stalled AI request times out honestly and keeps the full file for explicit retry',async()=>{
 const h=sender((_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('Aborted')))));
 h.ctx.setTimeout=fn=>{h.ctx.timeoutFn=fn;return 1;};const pending=h.ctx.sendAIChatMessage('Đọc dữ liệu',{automaticExport:true});await new Promise(r=>setImmediate(r));h.ctx.timeoutFn();await pending;assert.equal(h.state.pending,false);assert.equal(h.state.autoExportError,true);assert.match(h.state.messages.at(-1).content,/phản hồi quá lâu/);assert.ok(h.state.attachments[0].text.length>120000);
});
