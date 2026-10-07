const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../closing-book-core');
const root=path.join(__dirname,'..');
test('closing cash rows have a single full-width separator with spacing on both platforms',()=> {
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/\.closing-book-row \+ \.closing-book-row\s*\{[^}]*padding-top:\s*18px;[^}]*border-top:\s*1px solid #c8d6ec;/);
  assert.match(css,/\.book-expense \.closing-book-row \+ \.closing-book-row\s*\{[^}]*border-top-color:\s*#d8c0d2;/);
  assert.match(css,/\.closing-book-row:last-child\s*\{\s*padding-bottom:\s*0;/);
  assert.doesNotMatch(css,/\.closing-book-row\s*\{[^}]*border-bottom:/,'Mobile must not add a second separator');
});
test('closing money display groups thousands without rounding or changing validation',()=> {
  const source=fs.readFileSync(path.join(root,'closing-book.js'),'utf8');
  const start=source.indexOf('function formatClosingBookMoney('),end=source.indexOf('function closingBookMoneyField(',start);
  const context={};vm.runInNewContext(source.slice(start,end),context);
  for(const [raw,display] of [['10000','10.000'],['200000','200.000'],['125000','125.000'],['1000000','1.000.000'],['0','0'],['',''],['00010','10'],['10.000','10.000'],['9007199254740993','9.007.199.254.740.993']]) {
    assert.equal(context.formatClosingBookMoney(raw),display);
    if(raw&&Number(raw.replace(/\./g,''))<=Number.MAX_SAFE_INTEGER) assert.equal(core.parseMoney(display),core.parseMoney(raw));
  }
  for(const invalid of ['-5','12.3','1,000','abc']) assert.equal(context.formatClosingBookMoney(invalid),invalid);
  assert.throws(()=>core.parseMoney(context.formatClosingBookMoney('9007199254740993')),/quá lớn/);
});
test('closing money formatter preserves editing position, blank input and unformatted draft values',()=> {
  const source=fs.readFileSync(path.join(root,'closing-book.js'),'utf8');
  const start=source.indexOf('function formatClosingBookMoney('),end=source.indexOf('function closingBookMoneyField(',start);
  const context={};vm.runInNewContext(source.slice(start,end),context);
  const input=(value,caret,grouped=false)=>({value,selectionStart:caret,selectionEnd:caret,dataset:{bookGrouped:String(grouped)},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}});
  let target=input('10000',5);
  assert.equal(context.formatClosingBookMoneyInput(target),'10000');assert.equal(target.value,'10.000');assert.equal(target.selectionStart,6);
  target=input('1923.456',2,true);
  assert.equal(context.formatClosingBookMoneyInput(target,{inputType:'insertText',data:'9'}),'1923456');
  assert.equal(target.value,'1.923.456');assert.equal(target.selectionStart,3);
  target=input('12.456',2,true);
  assert.equal(context.formatClosingBookMoneyInput(target,{inputType:'deleteContentBackward'}),'12456');assert.equal(target.selectionStart,2);
  target=input('',0,true);assert.equal(context.formatClosingBookMoneyInput(target),'');assert.equal(target.value,'');
  target=input('12.3',4,true);assert.equal(context.formatClosingBookMoneyInput(target,{inputType:'insertFromPaste'}),'12.3');
});
test('deleting a shift cascades only linked entries and preserves other days and shifts',()=> {
  const a={...core.emptyShift(),expense:[{id:'row-a',transferredEntryId:'entry-a',note:'A',amount:1}],income:[{id:'row-b',note:'B',amount:2}]};
  const b={...core.emptyShift(),expense:[{id:'row-other',note:'Other',amount:3}]};
  const months=[{month:'2026-09',days:[{date:'2026-09-01',shifts:[a,b]},{date:'2026-09-02',shifts:[b]}]},{month:'2026-10',days:[]}];
  const entries=[{id:'entry-a',type:'expense'},{id:'entry-b',type:'income',closingBookRowId:'row-b'},{id:'other',closingBookRowId:'row-other'},{id:'manual',date:'2026-09-01',note:'A',amount:1}];
  const before=JSON.stringify({months,entries});
  const plan=core.deleteShift(months,'2026-09-01',0,entries);
  assert.deepEqual(plan.removedEntries.map(e=>e.id),['entry-a','entry-b']);
  assert.deepEqual(plan.entries.map(e=>e.id),['other','manual']);
  assert.deepEqual(plan.months[0].days[0].shifts,[b]);
  assert.deepEqual(plan.months[0].days[1],months[0].days[1]);
  assert.deepEqual(plan.months[1],months[1]);
  assert.equal(JSON.stringify({months,entries}),before);
  const last=core.deleteShift(plan.months,'2026-09-01',0,plan.entries);
  assert.deepEqual(last.months[0].days.map(d=>d.date),['2026-09-02']);
  assert.throws(()=>core.deleteShift(months,'2026-08-01',0,entries),/Tháng/);
  assert.throws(()=>core.deleteShift(months,'2026-09-01',-1,entries),/Ca/);
});
test('shift deletion handles legacy groups and unsaved drafts without saving invalid other drafts',()=> {
  const months=[{month:'2026-09',days:[{date:'2026-09-01',shifts:[{income1:[{id:'legacy'}],expense2:[{transferredEntryId:'old'}]}]}]}];
  const entries=[{id:'a',closingBookRowId:'legacy'},{id:'old'},{id:'draft',closingBookRowId:'new'},{id:'manual'}];
  const plan=core.deleteShift(months,'2026-09-01',0,entries,{income:[{id:'new'}],expense:[]});
  assert.deepEqual(plan.entries,[{id:'manual'}]);
  assert.equal(plan.months[0].days.length,0);
  const unsaved=core.deleteShift(months,'2026-09-01',1,entries,{income:[{id:'new'}],expense:[]});
  assert.deepEqual(unsaved.months,months);
  assert.deepEqual(unsaved.removedEntries,[entries[2]]);
});
test('Firebase state write replaces store arrays and reports success or failure for deletion',async()=> {
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const start=app.indexOf('async function saveStateToCloud('),end=app.indexOf('\nfunction updateSyncStatus',start);
  let payload,options,fail=false;
  const context={cloudStore:{enabled:true,docRef:{set:async(data,opts)=>{if(fail)throw new Error('test');payload=JSON.parse(JSON.stringify(data));options=opts;}}},
    state:{stores:[{id:'a',entries:[],closingMonths:[{month:'2026-09',days:[]}]}]},isEmployeeUser:()=>false,updateSyncStatus:()=>{},console:{error:()=>{}},window:{firebase:{firestore:{FieldValue:{serverTimestamp:()=> 'timestamp'}}}}};
  vm.runInNewContext(app.slice(start,end),context);
  assert.equal(await context.saveStateToCloud(),true);
  assert.deepEqual(payload.state,context.state);
  assert.equal(options.merge,true);
  fail=true;assert.equal(await context.saveStateToCloud(),false);
  context.cloudStore.enabled=false;assert.equal(await context.saveStateToCloud(),false);
});
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
  assert.match(ui,/isAdminUser\(\) \|\| \(isEmployeeUser\(\) && employeeCan\('closingBook','manage'\)/);
  assert.match(ui,/store.id!==closingBook.storeId/);
  assert.match(app,/closingMonths: Array.isArray\(store.closingMonths\)/);
  assert.match(app,/function showLoginScreen[^]*hideClosingBookPage/);
  assert.match(ui,/beforeunload/);
  assert.match(ui,/closingBookDiscard/);
  assert.doesNotMatch(ui,/store\.entries\s*=|entries\.push\(|orders\.push\(/);
  assert.match(ui,/ClosingBookCore\.transferEntry/);
  assert.match(html,/id="openClosingBookDesktop"[^>]*aria-label="Chốt sổ"/);
  assert.match(html,/id="openClosingBookMobile"[^>]*aria-label="Chốt sổ"/);
  assert.match(worker,/closing-book-core\.js/);
  assert.match(worker,/closing-book\.js/);
  assert.doesNotMatch(ui,/name="cancelled"|'cash','cancelled'/);
  assert.match(html,/Các bill đã hủy<textarea name="recheck"/);
  assert.doesNotMatch(ui,/· Nhóm|Tổng nhóm/);
});

test('closing row metadata survives validation and migration',()=> {
  const row={note:'Tiền điện',amount:'350000',id:'row-a',createdAt:'2026-09-01T08:12:34.000Z',categoryId:'cat-a',transferredEntryId:'entry-a',timeSource:'saved'};
  assert.deepEqual(core.validateShift({...core.emptyShift(),expense:[row]}).expense[0],{...row,amount:350000});
});

test('explicit Thu/Chi transfers require categories and preserve book date and original creation time',()=> {
  for(const type of core.groups) {
    const row={id:'r-'+type,note:'Khoản thử',amount:200000,createdAt:'2026-10-07T08:12:34.000Z',categoryId:'category'};
    const options={type,date:'2026-09-01',categories:[{id:'category',name:'Mục thử'}],entries:[],entryId:'entry-'+type};
    const entry=core.transferEntry(row,options);
    assert.deepEqual(entry,{id:'entry-'+type,type,categoryId:'category',date:'2026-09-01',amount:200000,note:'Khoản thử',createdAt:row.createdAt,closingBookRowId:row.id});
    assert.throws(()=>core.transferEntry({...row,categoryId:''},options),/chọn Mục/);
    assert.throws(()=>core.transferEntry(row,{...options,categories:[]}),/chọn Mục/);
    assert.throws(()=>core.transferEntry({...row,transferredEntryId:entry.id},options),/đã được chuyển/);
    assert.throws(()=>core.transferEntry(row,{...options,entries:[entry]}),/đã được chuyển/);
    assert.throws(()=>core.transferEntry({...row,amount:0},options),/lớn hơn 0/);
    assert.throws(()=>core.transferEntry({...row,createdAt:''},options),/thời điểm tạo/);
  }
});

test('closing book uses bill labels and puts cancelled-bill notes before the closing result',()=> {
  const ui=fs.readFileSync(path.join(root,'closing-book.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for (const [key,label] of Object.entries({vcb:'Bill VCB',momo:'Bill Momo',zalop:'Bill Zalop',cash:'Bill Tiền mặt'})) {
    assert.ok(ui.includes(`${key}:'${label}'`));
  }
  assert.match(html,/<h2>Kiểm tiền trong Két<\/h2>/);
  const notes=html.match(/<div class="closing-book-notes">([^]*?)<\/div>/)[1];
  assert.ok(notes.indexOf('name="recheck"')<notes.indexOf('name="result"'));
});

test('whole detail-row surface opens classification without intercepting controls',()=> {
  const ui=fs.readFileSync(path.join(root,'closing-book.js'),'utf8');
  const start=ui.indexOf("document.querySelector('#closingBookDetailList').addEventListener('click'");
  const end=ui.indexOf("document.querySelector('#closingBookCreateMonth')",start);
  let handler,opened=0;
  const card={};
  const context={document:{querySelector:()=>({addEventListener:(_,fn)=>handler=fn})},
    openClosingBookDetailEditor:element=>{assert.equal(element,card);opened++;},closingBookDetailNotice:message=>{throw new Error(message);}};
  vm.runInNewContext(ui.slice(start,end),context);
  handler({target:{closest:selector=>selector==='[data-detail-id]'?card:null}});
  assert.equal(opened,1);
  handler({target:{closest:selector=>selector==='[data-detail-id]'?card:(selector.includes('input,select')?{}:null)}});
  assert.equal(opened,1,'Inputs are not intercepted');
  handler({target:{closest:()=>null}});
  assert.equal(opened,1,'Click outside a row has no effect');
});

test('batch transfer only includes selected classified rows, preserves dates and blocks duplicates',()=> {
  for(const type of core.groups) {
    const base={note:'Khoản thử',amount:50000,createdAt:'2026-09-03T07:12:13.000Z',categoryId:'cat'};
    const rows=[{...base,id:'a'},{...base,id:'b'},{...base,id:'c',categoryId:''},{...base,id:'d',categoryId:'deleted'},
      {...base,id:'e',transferredEntryId:'old'},{...base,id:'f',amount:0},{...base,id:'g'}];
    const original=JSON.stringify(rows);
    let index=0;
    const options={type,date:'2026-09-03',categories:[{id:'cat'}],entries:[],createEntryId:()=>`new-${index++}`};
    const plan=core.transferBatch(rows,['a','b','b','c','d','e','f'],options);
    assert.equal(plan.entries.length,2);
    assert.equal(plan.skipped.length,4);
    assert.deepEqual(plan.entries.map(entry=>entry.closingBookRowId),['a','b']);
    assert.ok(plan.entries.every(entry=>entry.date===options.date&&entry.createdAt===base.createdAt&&entry.type===type));
    assert.equal(JSON.stringify(rows),original,'Planning never mutates book rows');
    const repeated=core.transferBatch(rows,['a','b'],{...options,entries:plan.entries});
    assert.equal(repeated.entries.length,0);
    assert.equal(repeated.skipped.length,2);
    assert.equal(core.transferBatch(rows,[],options).entries.length,0);
  }
});
