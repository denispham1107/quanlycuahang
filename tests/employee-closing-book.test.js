const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../closing-book-core');
const {applyClosingBookMutation}=require('../functions/closing-book-mutation');
const user={uid:'employee-a',profile:{storeId:'a',displayName:'Nhân viên A',permissions:{closingBook:{manage:true}}}};
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture() {return {id:'a',name:'Store A',categories:{income:[{id:'i',name:'Thu'}],expense:[{id:'e',name:'Chi'}]},closingMonths:[],entries:[{id:'manual',note:'Không xóa',type:'expense',amount:100}],activityHistory:[]};}
function mutation(store,months) {return {baseClosingMonths:clone(store.closingMonths),closingMonths:months,categories:clone(store.categories)};}
function month() {return [{month:'2026-09',days:[{date:'2026-09-01',shifts:[{...core.emptyShift(),income:[{id:'ri',note:'Thu thử',amount:200,createdAt:'2026-09-01T07:00:00Z',categoryId:'i'}],expense:[{id:'re',note:'Chi thử',amount:50,createdAt:'2026-09-01T08:00:00Z',categoryId:'e'}]}],updatedAt:'2026-10-07T08:00:00Z'}]}];}
test('frontend and Firebase package use the same closing-book validation core',()=> {
  assert.equal(fs.readFileSync('closing-book-core.js','utf8').replace(/\r\n/g,'\n').trim(),fs.readFileSync('functions/closing-book-core.js','utf8').replace(/\r\n/g,'\n').trim());
});
test('employee book permission defaults off and matches server normalization',()=> {
  for(const file of ['app.js','functions/index.js']) {
    const source=fs.readFileSync(file,'utf8'),start=source.indexOf('const DEFAULT_EMPLOYEE_PERMISSIONS ='),end=source.indexOf('\nfunction ',source.indexOf('function normalizeEmployeePermissions',start)+10);
    const context={};vm.runInNewContext(source.slice(start,end),context);
    assert.equal(context.normalizeEmployeePermissions({}).closingBook.manage,false);
    assert.equal(context.normalizeEmployeePermissions({permissions:{closingBook:{manage:true}}}).closingBook.manage,true);
    assert.equal(context.normalizeEmployeePermissions({permissions:{closingBook:{manage:'true'}}}).closingBook.manage,false);
  }
});
test('authorized staff can save, classify, transfer both types and cascade delete without touching direct entries',()=> {
  const store=fixture();let change=mutation(store,month());
  applyClosingBookMutation(store,change,user,()=> 'log1');
  assert.equal(store.entries.length,1);
  change=mutation(store,clone(store.closingMonths));
  change.closingMonths[0].days[0].shifts[0].income[0].transferredEntryId='ei';
  change.closingMonths[0].days[0].shifts[0].expense[0].transferredEntryId='ee';
  change.entries=[{id:'malicious',type:'income',amount:99999}];
  applyClosingBookMutation(store,change,user,()=> 'log2');
  assert.deepEqual(store.entries.map(e=>e.id),['manual','ei','ee']);
  assert.equal(store.entries[1].date,'2026-09-01');assert.equal(store.entries[1].createdAt,'2026-09-01T07:00:00Z');
  assert.equal(store.entries[2].actorUid,user.uid);
  applyClosingBookMutation(store,mutation(store,[{month:'2026-09',days:[]}]),user,()=> 'log3');
  assert.deepEqual(store.entries,[fixture().entries[0]]);
  assert.equal(store.activityHistory[0].action,'delete');
});
test('missing/revoked permissions and other stores are rejected without mutation',()=> {
  for(const profile of [{storeId:'a',permissions:{}},{...user.profile,storeId:'b'},{...user.profile,active:false}]) {
    const store=fixture(),before=clone(store);
    assert.throws(()=>applyClosingBookMutation(store,mutation(store,month()),{...user,profile},()=> 'log'),error=>error.status===403);
    assert.deepEqual(store,before);
  }
});
test('concurrent updates and malformed dates/categories are rejected atomically',()=> {
  const store=fixture(),before=clone(store);
  let change=mutation(store,month());change.baseClosingMonths=[{month:'2020-01',days:[]}];
  assert.throws(()=>applyClosingBookMutation(store,change,user,()=> 'log'),error=>error.status===409);
  change=mutation(store,month());change.closingMonths[0].days[0].date='2026-09-31';
  assert.throws(()=>applyClosingBookMutation(store,change,user,()=> 'log'),/INVALID_CLOSING_DAY/);
  change=mutation(store,month());change.categories.expense[0].name='Sửa mục cũ';
  assert.throws(()=>applyClosingBookMutation(store,change,user,()=> 'log'),/CATEGORY_EDIT_FORBIDDEN/);
  assert.deepEqual(store,before);
});
test('unclassified transfers, duplicate entry IDs and edits to transferred rows cannot mutate real entries',()=> {
  const store=fixture();applyClosingBookMutation(store,mutation(store,month()),user,()=> 'log');
  let change=mutation(store,clone(store.closingMonths));const row=change.closingMonths[0].days[0].shifts[0].income[0];
  row.transferredEntryId='new';row.categoryId='missing';
  assert.throws(()=>applyClosingBookMutation(store,change,user,()=> 'log'),/chọn Mục/);
  row.categoryId='i';row.transferredEntryId='manual';
  assert.throws(()=>applyClosingBookMutation(store,change,user,()=> 'log'),/DUPLICATE_ENTRY/);
  row.transferredEntryId='new';applyClosingBookMutation(store,change,user,()=> 'log');
  const before=clone(store);change=mutation(store,clone(store.closingMonths));change.closingMonths[0].days[0].shifts[0].income[0].amount=500;
  assert.throws(()=>applyClosingBookMutation(store,change,user,()=> 'log'),/TRANSFERRED_ROW_EDIT_FORBIDDEN/);
  assert.deepEqual(store,before);
});
test('new months preserve untouched historical sheets with legacy rows lacking IDs',()=> {
  const store=fixture();store.closingMonths=[{month:'2026-08',days:[{date:'2026-08-01',shifts:[{income1:[{note:'Thu cũ',amount:5}]}]}]}];
  const change=mutation(store,[...clone(store.closingMonths),{month:'2026-09',days:[]}]);
  applyClosingBookMutation(store,change,user,()=> 'log');
  assert.deepEqual(store.closingMonths[0],change.baseClosingMonths[0]);
});
