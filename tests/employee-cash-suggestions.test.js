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
