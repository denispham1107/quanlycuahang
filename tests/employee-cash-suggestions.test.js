const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {getCashEntrySuggestions}=require('../functions/cash-entry-suggestions');
const {getEmployeeOverviewSales}=require('../functions/employee-overview');
const app=fs.readFileSync('app.js','utf8'),server=fs.readFileSync('functions/index.js','utf8');
const store={id:'a',categories:{income:[{id:'i',name:'Thu khác'}],expense:[{id:'e',name:'Lương NV'}]},entries:[
  {id:'admin-old',type:'expense',note:'Tại nhà Ngọc',amount:10000,categoryId:'e',createdAt:'2026-09-01T00:00:00Z'},
  {id:'admin-new',type:'expense',note:'Tại nhà Ngọc',amount:125000,categoryId:'e',createdAt:'2026-10-01T00:00:00Z',actorUid:'admin'},
  {id:'admin-cancel',type:'expense',note:'Tại nhà Ngọc',amount:999999,categoryId:'e',createdAt:'2026-10-02T00:00:00Z',status:'cancelled'},
  {id:'admin-income',type:'income',note:'Anh thêm',amount:200000,categoryId:'i',createdAt:'2026-10-01T00:00:00Z'}
]};
function sanitize(manage,assigned='a',visible=[assigned]) {
  const ctx={getCashEntrySuggestions,getEmployeeOverviewSales,normalizeEmployeeStoreSalesBills:()=>{},getEmployeeStoreIds:()=>visible,normalizeEmployeePermissions:()=>({closingBook:{manage},sales:{view:false,draft:false},purchase:{view:false},history:{viewOwn:false}})};
  const start=server.indexOf('function sanitizeEmployeeState('),end=server.indexOf('function createEmployeeActivity(');
  vm.runInNewContext(server.slice(start,end),ctx);
  return ctx.sanitizeEmployeeState({stores:[store,{...store,id:'b',entries:[{type:'expense',note:'Other store secret',amount:1}]}]},{uid:'employee',profile:{storeId:assigned}});
}
test('authorized staff get latest admin-entered reusable values without receiving financial history',()=> {
  const result=sanitize(true);
  assert.equal(result.stores.length,1);assert.equal(result.stores[0].entries.length,0);
  const suggestion=result.stores[0].cashEntrySuggestions.expense[0];
  assert.deepEqual(suggestion,{note:'Tại nhà Ngọc',amount:125000,categoryId:'e'});
  assert.deepEqual(Object.keys(suggestion).sort(),['amount','categoryId','note']);
  assert.equal(result.stores[0].cashEntrySuggestions.income[0].amount,200000);
  assert.equal(sanitize(false).stores[0].cashEntrySuggestions.expense.length,0);
  assert.equal(sanitize(true,'',['a']).stores[0].cashEntrySuggestions.expense.length,0,'Missing assignment cannot reveal fallback store suggestions');
  assert.equal(sanitize(true,'b').stores[0].cashEntrySuggestions.expense[0].note,'Other store secret');
});
test('employee payload keeps the shared suggestions through state normalization with no admin entry fallback',()=> {
  const source=app.slice(app.indexOf('function normalizeState('),app.indexOf('function saveAndRender('));
  const ctx={normalizeStoreSalesBills:s=>({orders:s.orders||[],salesBillSequences:{}}),normalizeExportReasons:()=>[],getEarliestEntryDate:()=>null,today:'2026-10-07'};
  vm.runInNewContext(source,ctx);
  const normalized=ctx.normalizeState(sanitize(true));
  const start=app.indexOf('function getEntrySuggestions('),end=app.indexOf('function matchEntrySuggestion(');
  vm.runInNewContext(app.slice(start,end),ctx);
  assert.equal(ctx.getEntrySuggestions(normalized.stores[0],'expense')[0].amount,125000);
  assert.equal(normalized.stores[0].entries.length,0);
});
test('server suggestion values match admin suggestions and omit deleted categories',()=> {
  const ctx={isCancelledEntry:e=>e.status==='cancelled'};
  vm.runInNewContext(app.slice(app.indexOf('function getEntrySuggestions('),app.indexOf('function matchEntrySuggestion(')),ctx);
  assert.equal(JSON.stringify(ctx.getEntrySuggestions(store,'expense')),JSON.stringify(getCashEntrySuggestions(store).expense));
  assert.equal(getCashEntrySuggestions({...store,categories:{income:[],expense:[]}}).expense[0].categoryId,'');
});
test('partial closing-book search handles Vietnamese with or without accents',()=> {
  const book=fs.readFileSync('closing-book.js','utf8'),start=book.indexOf('function closingBookSuggestionSearch('),end=book.indexOf('function hideClosingBookNoteSuggestions(');
  const ctx={};vm.runInNewContext(book.slice(start,end),ctx);
  assert.ok(ctx.closingBookSuggestionSearch('Tại nhà Ngọc').includes(ctx.closingBookSuggestionSearch('tai nha')));
});

test('saved untransferred closing rows feed both directions, with latest amount/category and legacy groups',()=> {
  const saved={...store,closingMonths:[{month:'2026-09',days:[{date:'2026-09-01',updatedAt:'2026-10-05T00:00:00Z',shifts:[{
    income:[{id:'book-i',note:'Thu trong ca',amount:35000,categoryId:'i',createdAt:'2026-10-04T01:00:00Z'}],
    expense:[{id:'book-e',note:'Rác',amount:450000,categoryId:'e'}, {id:'book-new',note:'Tại nhà Ngọc',amount:150000,categoryId:'e'}, {note:'Không còn Mục',amount:12,categoryId:'removed'}]
  }]},{date:'2026-09-02',updatedAt:'2026-10-06T00:00:00Z',shifts:[{income1:[{note:'Thu cũ',amount:25,categoryId:'i'}],expense2:[{note:'Rác',amount:460000,categoryId:'e'}]}]}]}]};
  const before=JSON.stringify(saved), ctx={};
  vm.runInNewContext(app.slice(app.indexOf('function getEntrySuggestions('),app.indexOf('function matchEntrySuggestion(')),ctx);
  for(const type of ['income','expense']) assert.equal(JSON.stringify(ctx.getEntrySuggestions(saved,type)),JSON.stringify(getCashEntrySuggestions(saved)[type]));
  const templates=getCashEntrySuggestions(saved);
  assert.equal(templates.expense.find(s=>s.note==='Rác').amount,460000);
  assert.equal(templates.expense.find(s=>s.note==='Tại nhà Ngọc').amount,150000);
  assert.equal(templates.expense.find(s=>s.note==='Không còn Mục').categoryId,'');
  assert.equal(templates.income.find(s=>s.note==='Thu trong ca').categoryId,'i');
  assert.equal(templates.income.find(s=>s.note==='Thu cũ').amount,25);
  assert.equal(JSON.stringify(saved),before,'Suggestion generation never creates transactions or changes saved rows');
  assert.equal(saved.entries.length,4,'No Chuyển operation is needed');
});

test('transferred closing rows cannot resurrect cancelled or outdated transaction suggestions',()=> {
  const saved={categories:store.categories,entries:[{id:'actual',closingBookRowId:'row',type:'expense',note:'Đã sửa',amount:2,categoryId:'e',createdAt:'2026-10-01'},{id:'cancelled',type:'expense',note:'Đã hủy',amount:5,status:'cancelled'}],closingMonths:[{days:[{updatedAt:'2026-10-07',shifts:[{expense:[{id:'row',transferredEntryId:'actual',note:'Tên cũ',amount:1},{id:'row2',transferredEntryId:'cancelled',note:'Đã hủy',amount:5},{note:'Không hợp lệ',amount:-1},{note:'Quá lớn',amount:1e30}]}]}]}]};
  assert.deepEqual(getCashEntrySuggestions(saved).expense,[{note:'Đã sửa',amount:2,categoryId:'e'}]);
});

test('employee suggestion refresh changes templates only, preserving drafts, state and manual inputs',async()=> {
  const local={id:'a',entries:[],closingMonths:[],categories:{income:[],expense:[]},cashEntrySuggestions:{income:[],expense:[]}};
  const ctx={isEmployeeUser:()=>true,employeeCan:()=>true,cloudStore:{enabled:true},getActiveStore:()=>local,authState:{user:{uid:'staff-b'},profile:{storeId:'a'}},document:{addEventListener(){},querySelectorAll:()=>[]},els:{quickEntryModal:{hidden:true}},window:{},renderEntrySuggestions(){},saveStateToCache(){},normalizeState:x=>x,Date,console};
  let calls=0;
  ctx.callEmployeeFunction=async()=> {calls++;return {state:{stores:[{...local,entries:[{id:'private'}],closingMonths:[{month:'private'}],categories:store.categories,cashEntrySuggestions:{income:[{note:'Thu từ nhân viên A',amount:35,categoryId:'i'}],expense:[{note:'Rác',amount:450000,categoryId:'e'}]}}]}};};
  vm.runInNewContext(app.slice(app.indexOf('let employeeSuggestionRefresh ='),app.indexOf('async function loadEmployeeState(')),ctx);
  assert.equal(await ctx.refreshEmployeeCashSuggestions(),true);
  assert.equal(local.cashEntrySuggestions.expense[0].note,'Rác');
  assert.equal(local.entries.length,0);assert.equal(local.closingMonths.length,0,'Background read does not replace financial data or drafts');
  assert.equal(await ctx.refreshEmployeeCashSuggestions(),false);assert.equal(calls,1,'Repeated focus is throttled');
  ctx.callEmployeeFunction=async()=>{throw new Error('offline');};ctx.console={warn(){}};
  assert.equal(await ctx.refreshEmployeeCashSuggestions(true),false);assert.equal(local.cashEntrySuggestions.expense[0].amount,450000);
  let resolve;ctx.callEmployeeFunction=()=>new Promise(r=>{resolve=r;});
  const request=ctx.refreshEmployeeCashSuggestions(true);ctx.authState.user={uid:'other'};resolve({state:{stores:[]}});
  assert.equal(await request,false,'Late responses from a previous login are discarded');
});
