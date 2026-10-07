const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
function fn(source,name) {const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\nfunction ',start+1));}
function fixture() {return {categories:{income:[{id:'i',name:'Thu'}],expense:[{id:'e',name:'Chi'},{id:'e2',name:'Chi khác'}]},entries:[
  {type:'expense',note:'Tiền điện',amount:10000,categoryId:'e2',createdAt:'2026-09-01T00:00:00Z'},
  {type:'expense',note:'Tiền điện',amount:30000,categoryId:'e',createdAt:'2026-10-01T00:00:00Z'},
  {type:'expense',note:'Tiền điện',amount:999999,categoryId:'e2',createdAt:'2026-10-02T00:00:00Z',status:'cancelled'},
  {type:'income',note:'Tiền điện',amount:50000,categoryId:'i',createdAt:'2026-10-03T00:00:00Z'},
  {type:'expense',note:'Mục đã xóa',amount:20000,categoryId:'deleted',createdAt:'2026-10-04T00:00:00Z'}
]};}
function context(store=fixture()) {const ctx={getActiveStore:()=>store};vm.runInNewContext(['isCancelledEntry','formatAmountInput','getEntrySuggestions','matchEntrySuggestion','applyEntrySuggestion','applyQuickEntrySuggestion'].map(name=>fn(app,name)).join('\n'),ctx);return ctx;}
test('latest suggestion pairs amount and existing category, excluding cancelled entries and other types',()=> {
  const ctx=context();
  const expense=ctx.getEntrySuggestions(fixture(),'expense').find(s=>s.note==='Tiền điện');
  assert.equal(expense.amount,30000);assert.equal(expense.categoryId,'e');
  assert.equal(ctx.getEntrySuggestions(fixture(),'income')[0].categoryId,'i');
  assert.equal(ctx.getEntrySuggestions(fixture(),'expense').find(s=>s.note==='Mục đã xóa').categoryId,'');
  assert.equal(ctx.getEntrySuggestions({...fixture(),entries:[]},'expense').length,0);
});
test('inline forms and quick modal auto-select the matching category with the latest amount',()=> {
  const ctx=context(),note={value:'  tiền điện  ',dataset:{}},amount={value:''},category={value:'e2'};
  const form={dataset:{type:'expense'},querySelector:selector=>selector.includes('note')?note:selector.includes('amount')?amount:category};
  ctx.applyEntrySuggestion(form);assert.equal(amount.value,'30.000');assert.equal(category.value,'e');
  category.value='e2';amount.value='12.345';ctx.applyEntrySuggestion(form);
  assert.equal(category.value,'e2');assert.equal(amount.value,'12.345','Blur/change must not overwrite manual edits');
  category.value='e2';amount.value='12.345';note.value='Không có';ctx.applyEntrySuggestion(form);
  assert.equal(category.value,'e2');assert.equal(amount.value,'12.345','Unknown names preserve manual values');
  ctx.els={quickEntryForm:{dataset:{type:'income'}},quickEntryNote:{value:'Tiền điện',dataset:{}},quickEntryAmount:amount,quickEntryCategory:category};
  ctx.applyQuickEntrySuggestion();assert.equal(amount.value,'50.000');assert.equal(category.value,'i');
  form.dataset.type='expense';note.value='Mục đã xóa';ctx.applyEntrySuggestion(form);assert.equal(category.value,'');
});
test('closing-book suggestion uses the same source and never changes transferred rows',()=> {
  const book=fs.readFileSync('closing-book.js','utf8'),ctx=context();
  ctx.closingBook={draft:{expense:[{note:'Tiền điện',amount:'',categoryId:''}]}};
  ctx.escapeHtml=value=>String(value);
  vm.runInNewContext(fn(book,'formatClosingBookMoney')+'\n'+fn(book,'applyClosingBookEntrySuggestion'),ctx);
  const amount={value:'',dataset:{}},category={value:''};
  const target={value:'Tiền điện',dataset:{bookNote:'expense',row:'0'},closest:()=>({querySelector:s=>s.includes('amount')?amount:category})};
  ctx.applyClosingBookEntrySuggestion(target);
  assert.equal(amount.value,'30.000');assert.equal(category.value,'e');assert.equal(ctx.closingBook.draft.expense[0].amount,'30000');
  ctx.closingBook.draft.expense[0].transferredEntryId='done';ctx.closingBook.draft.expense[0].amount=123;
  ctx.applyClosingBookEntrySuggestion(target);assert.equal(ctx.closingBook.draft.expense[0].amount,123);
});
