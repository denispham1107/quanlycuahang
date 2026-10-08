const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ClosingBookCore=require('../closing-book-core.js'),ui=fs.readFileSync(path.join(__dirname,'../closing-book.js'),'utf8'),context={ClosingBookCore};
vm.runInNewContext(ui.slice(ui.indexOf('function buildClosingBookAudit('),ui.indexOf('function openClosingBookAudit(')),context);
const report=(month,metric='difference',direction='shortage')=>JSON.parse(JSON.stringify(context.buildClosingBookAudit(month,metric,direction)));
const shift=(extra={})=>({...ClosingBookCore.emptyShift(),...extra});
test('all five discrepancies use existing closing-book calculations and both signs',()=>{
  const fields={posDifference:[{cash:10},{pos:10}],vcbDifference:[{actualVcb:10},{vcb:10}],momoDifference:[{actualMomo:10},{momo:10}],zalopDifference:[{actualZalop:10},{zalop:10}],difference:[{ending:10},{opening:10}]};
  for(const [metric,[positive,negative]] of Object.entries(fields)){
    const month={month:'2026-09',days:[{date:'2026-09-02',shifts:[shift(negative)]},{date:'2026-09-01',shifts:[shift(positive)]},{date:'2026-09-03',shifts:[shift()]}]};
    assert.equal(report(month,metric,'surplus').rows[0].date,'2026-09-01');const r=report(month,metric);assert.equal(r.rows[0].date,'2026-09-02');assert.equal(r.total,10);assert.equal(r.signedTotal,-10);assert.equal(r.savedDays,3);
  }
});
test('sum shifts per day before filtering; do not count offsetting shifts or zero days',()=>{
  const month={month:'2026-09',days:[{date:'2026-09-03',shifts:[shift({opening:100}),shift({ending:40})]},{date:'2026-09-01',shifts:[shift({ending:100}),shift({opening:100})]},{date:'2026-09-02',shifts:[shift({opening:20})]}]},before=JSON.stringify(month);
  const r=report(month);assert.deepEqual(r.rows.map(x=>x.date),['2026-09-02','2026-09-03']);assert.equal(r.total,80);assert.deepEqual(r.rows[1].shifts.map(x=>x.value),[-100,40]);assert.equal(report(month,'difference','surplus').total,0);assert.equal(JSON.stringify(month),before);
});
test('legacy closing-book rows and leap-year month remain supported',()=>{
  const old={...shift({ending:20}),income1:[{amount:30}],income2:[{amount:10}],expense1:[{amount:5}],expense2:[]};delete old.income;delete old.expense;
  const r=report({month:'2024-02',days:[{date:'2024-02-29',shifts:[old]}]});assert.equal(r.total,15);
  assert.throws(()=>report({month:'2026-02',days:[{date:'2026-02-29',shifts:[shift()]}]}),/Ngày/);
});
test('invalid data and unsafe sums fail visibly instead of reporting a partial total',()=>{
  const month={month:'2026-09',days:[{date:'2026-09-01',shifts:[shift({opening:Number.MAX_SAFE_INTEGER}),shift({opening:1})]}]};assert.throws(()=>report(month),/quá lớn/);
  assert.throws(()=>report({month:'2026-09',days:[{date:'2026-09-01',shifts:[shift({opening:Number.MAX_SAFE_INTEGER})]},{date:'2026-09-02',shifts:[shift({opening:1})]}]}),/quá lớn/);
  month.days[0].shifts=[shift({opening:'abc'})];assert.throws(()=>report(month),/ca 1/);
  month.days=[{date:'2026-10-01',shifts:[]}];assert.throws(()=>report(month),/Ngày/);
  month.days=[{date:'2026-09-01',shifts:[]},{date:'2026-09-01',shifts:[]}];assert.throws(()=>report(month),/trùng/);
  assert.throws(()=>report(month,'unknown'),/Bộ lọc/);assert.throws(()=>report(month,'difference','all'),/Bộ lọc/);
  assert.deepEqual(report({month:'2026-09',days:[]}),{rows:[],signedTotal:0,total:0,savedDays:0});
});
