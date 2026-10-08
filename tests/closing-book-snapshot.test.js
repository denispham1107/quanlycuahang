const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../closing-book.js'),'utf8'),context={};
vm.runInNewContext(ui.slice(ui.indexOf('function closingBookSnapshotMatches('),ui.indexOf('function closingBookMonthData()')),context);
const matches=context.closingBookSnapshotMatches;
const fixture=()=>[{name:'Ca 1',vcb:7283000,cash:1766000,pos:9049000,income:[{id:'a',note:'Thu thử',amount:100,categoryId:'i'},{id:'b',note:'Thu khác',amount:50,categoryId:'j'}],expense1:[{note:'Dòng cũ',amount:20}],posTransfer:{id:'pos',transferredEntryId:'entry',amount:9049000,categoryId:'i'}}];
function reorder(value){return Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().reverse().map(key=>[key,reorder(value[key])])):value;}
test('Firestore reorders nested map keys without changing a closing-book snapshot',()=>{
  const local=fixture(),remote=reorder(local);assert.notEqual(JSON.stringify(remote),JSON.stringify(local),'old guard wrongly rejected equal payloads');assert.equal(matches(remote,JSON.stringify(local)),true);assert.equal(matches(local,JSON.stringify(remote)),true);
});
test('real value, category, receipt linkage or array changes still conflict',()=>{
  const original=fixture();for(const change of [value=>value[0].cash++,value=>value[0].income[0].categoryId='other',value=>value[0].posTransfer.transferredEntryId='other',value=>value[0].income.reverse(),value=>value[0].income.pop(),value=>value[0].income.push({id:'c'}),value=>value.push({name:'Ca 2'}),value=>value[0].cash=String(value[0].cash),value=>delete value[0].expense1]){const remote=reorder(original);change(remote);assert.equal(matches(remote,JSON.stringify(original)),false);}
});
test('legacy metadata is not silently normalized away and invalid snapshot fails closed',()=>{
  const local=fixture();assert.equal(matches(reorder(local),JSON.stringify(local)),true);const remote=reorder(local);remote[0].expense1[0].amount=30;assert.equal(matches(remote,JSON.stringify(local)),false);assert.equal(matches([], '[]'),true);assert.equal(matches([], 'invalid json'),false);
  assert.match(ui,/!closingBookSnapshotMatches\(day\?\.shifts\|\|\[\],session\.daySnapshot\)/);assert.match(ui,/!closingBookSnapshotMatches\(currentDay\?\.shifts\|\|\[\],closingBook\.daySnapshot\)/);
});
