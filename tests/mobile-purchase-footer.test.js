const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
test('mobile purchase cancel and complete share a two-column row without affecting sales or desktop',()=>{
  const start=css.indexOf('/* Mobile purchase actions stay in DOM order');
  assert.ok(start>=0);
  const rules=css.slice(start,css.indexOf('/* Approved “Ngọc trai thanh lịch”',start));
  assert.match(rules,/html\.mobile-app-theme #quickEntryForm:is\(\[data-type="purchase"\], \[data-type="purchase-bulk"\]\)/);
  assert.match(rules,/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(rules,/#cancelQuickEntry \{\s*grid-column: 1;\s*grid-row: 1;/);
  assert.match(rules,/#quickEntrySubmit \{\s*grid-column: 2;\s*grid-row: 1;/);
  assert.doesNotMatch(rules,/data-type="sales"|background:|color:|order:/);
});
