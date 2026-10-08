const test=require('node:test'),assert=require('node:assert/strict'),core=require('../closing-book-core');
const {applyClosingBookMutation}=require('../functions/closing-book-mutation');
const clone=value=>JSON.parse(JSON.stringify(value));
const source={id:'pos-source',note:'Doanh thu POS',amount:9049000,categoryId:'i',createdAt:'2026-10-08T02:00:00Z',transferredEntryId:'pos-entry'};
function fixture(){const shift=core.validateShift({...core.emptyShift(),vcb:7283000,cash:1766000,pos:9049000,posTransfer:source});return {id:'a',closingMonths:[{month:'2026-10',days:[{date:'2026-10-01',shifts:[shift],updatedAt:'2026-10-08T02:00:00Z'}]}],categories:{income:[{id:'i',name:'Doanh thu'}],expense:[]},entries:[{id:'pos-entry',closingBookRowId:'pos-source',type:'income',amount:9049000},{id:'keep',type:'income',amount:1}],activityHistory:[]};}
const user={uid:'employee',profile:{storeId:'a',permissions:{closingBook:{manage:true}}}};
const mutation=(store,months)=>({baseClosingMonths:clone(store.closingMonths),closingMonths:months,categories:clone(store.categories)});
test('POS transfer metadata survives validation but never changes closing cash formulas',()=>{
  const store=fixture(),shift=store.closingMonths[0].days[0].shifts[0],without={...shift};delete without.posTransfer;
  assert.deepEqual(core.calculate(shift),core.calculate(without));assert.deepEqual(shift.posTransfer,source);assert.equal(core.calculate(shift).actualPos,9049000);
  assert.throws(()=>core.validateShift({...shift,posTransfer:{...source,amount:0}}),/lớn hơn 0/);
});
test('deleting a shift cascades its POS receipt and keeps other receipts',()=>{
  const store=fixture(),plan=core.deleteShift(store.closingMonths,'2026-10-01',0,store.entries);assert.deepEqual(plan.entries.map(x=>x.id),['keep']);assert.equal(plan.months[0].days.length,0);
});
test('employees can preserve admin POS metadata during normal book saves and delete it with the shift',()=>{
  const store=fixture(),months=clone(store.closingMonths);months[0].days[0].shifts[0].name='Ca nhân viên';applyClosingBookMutation(store,mutation(store,months),user,()=> 'activity');assert.deepEqual(store.closingMonths[0].days[0].shifts[0].posTransfer,source);assert.equal(store.entries.length,2);
  applyClosingBookMutation(store,mutation(store,[{month:'2026-10',days:[]}]),user,()=> 'delete');assert.deepEqual(store.entries.map(x=>x.id),['keep']);
});
test('employees cannot forge, edit or disguise a POS transfer as a normal cash row',()=>{
  for(const mode of ['forge','edit','disguise']){const store=fixture();if(mode==='forge'){delete store.closingMonths[0].days[0].shifts[0].posTransfer;store.entries=[];}const before=clone(store),months=clone(store.closingMonths),shift=months[0].days[0].shifts[0];if(mode==='forge')shift.posTransfer=source;if(mode==='edit')shift.posTransfer.amount=10;if(mode==='disguise'){shift.income=[shift.posTransfer];delete shift.posTransfer;}assert.throws(()=>applyClosingBookMutation(store,mutation(store,months),user,()=> 'log'),/POS_TRANSFER_ADMIN_ONLY/);assert.deepEqual(store,before);}
});
