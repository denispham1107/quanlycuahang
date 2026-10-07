const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../closing-book-core');
const root=path.join(__dirname,'..');
test('closing book preserves every source formula and does not subtract cancelled bills twice',()=> {
  const shift={opening:500000,pos:500000,vcb:250000,momo:80000,zalop:0,cash:200000,cancelled:999,ending:0,
    income1:[{note:'Thu',amount:200000}],expense1:[{note:'Chi',amount:525000}],expense2:[{note:'Chi 2',amount:125000}]};
  const result=core.calculate(core.validateShift(shift));
  assert.deepEqual(result,{income:200000,expense:650000,actualPos:530000,bookCash:250000,difference:-250000,posDifference:30000,vcbDifference:-250000,momoDifference:-80000,zalopDifference:0});
});
test('closing book validates real calendar months including leap years',()=> {
  assert.equal(core.monthDays('2026-09'),30);
  assert.equal(core.monthDays('2024-02'),29);
  assert.equal(core.monthDays('2026-02'),28);
  assert.equal(core.monthDays('2026-12'),31);
  for(const month of ['2026-00','2026-13','2026-9','0000-01']) assert.equal(core.validMonth(month),false);
});
test('money validation distinguishes blank/zero and blocks malformed, negative or unsafe amounts',()=> {
  assert.equal(core.parseMoney('1.234.567'),1234567);
  assert.equal(core.parseMoney(''),0);
  assert.equal(core.parseMoney('0'),0);
  for(const value of ['12.3','-5','1,000','abc','9007199254740992']) assert.throws(()=>core.parseMoney(value));
  assert.throws(()=>core.calculate({...core.emptyShift(),opening:Number.MAX_SAFE_INTEGER,cash:1}));
});
test('both detail columns retain zero entries and reject incomplete rows before saving',()=> {
  const blank=core.validateShift(core.emptyShift());
  core.groups.forEach(key=>assert.deepEqual(blank[key],[]));
  for(const key of core.groups) {
    assert.throws(()=>core.validateShift({...core.emptyShift(),[key]:[{note:'',amount:'500'}]}));
    assert.throws(()=>core.validateShift({...core.emptyShift(),[key]:[{note:'Có tên',amount:''}]}));
    assert.equal(core.validateShift({...core.emptyShift(),[key]:[{note:'Zero',amount:'0'}]})[key][0].amount,0);
    assert.throws(()=>core.validateShift({...core.emptyShift(),[key]:Array.from({length:43},()=>({note:'x',amount:1}))}));
  }
});

test('legacy groups merge without losing rows, notes or metadata and never merge twice',()=> {
  const rows=prefix=>Array.from({length:21},(_,i)=>({note:prefix+i,amount:i}));
  const legacy={name:'Ca cũ',result:'Kết quả cũ',recheck:'Ghi chú cũ',cancelled:12,
    income1:rows('Thu A'),income2:rows('Thu B'),expense1:rows('Chi A'),expense2:rows('Chi B')};
  const before=JSON.stringify(legacy);
  const shift=core.validateShift(legacy);
  assert.equal(shift.income.length,42);
  assert.equal(shift.expense.length,42);
  assert.equal(shift.income[21].note,'Thu B0');
  assert.equal(shift.expense[21].note,'Chi B0');
  assert.equal(shift.recheck,'Ghi chú cũ');
  assert.equal(shift.cancelled,12);
  assert.equal(JSON.stringify(legacy),before);
  assert.equal('income1' in shift,false);
  assert.deepEqual(core.validateShift(shift),shift);
  assert.equal(core.calculate(shift).income,420);
  assert.deepEqual(core.normalizeShift({...legacy,income:[],expense:[]}).income,[]);
});
test('closing book page is admin-only, isolated by store, protected on logout and cached offline',()=> {
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const ui=fs.readFileSync(path.join(root,'closing-book.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  assert.match(ui,/isAdminUser\(\) && els.authScreen.hidden/);
  assert.match(ui,/store.id!==closingBook.storeId/);
  assert.match(app,/closingMonths: Array.isArray\(store.closingMonths\)/);
  assert.match(app,/function showLoginScreen[^]*hideClosingBookPage/);
  assert.match(ui,/beforeunload/);
  assert.match(ui,/closingBookDiscard/);
  assert.doesNotMatch(ui,/store\.entries\s*=|entries\.push\(|orders\.push\(/);
  assert.match(html,/id="openClosingBookDesktop"[^>]*aria-label="Chốt sổ"/);
  assert.match(html,/id="openClosingBookMobile"[^>]*aria-label="Chốt sổ"/);
  assert.match(worker,/closing-book-core\.js/);
  assert.match(worker,/closing-book\.js/);
  assert.doesNotMatch(ui,/name="cancelled"|'cash','cancelled'/);
  assert.match(html,/Các bill đã hủy<textarea name="recheck"/);
  assert.doesNotMatch(ui,/· Nhóm|Tổng nhóm/);
});
