const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
test('pearl trade footer has four distinct semantic colors without touching geometry',()=>{
  const start=css.indexOf('/* Approved “Ngọc trai thanh lịch” footer');
  assert.ok(start>=0);
  const rules=css.slice(start,css.indexOf('/* Approved "Nổi bật gradient"',start));
  for(const color of ['#fde6e8','#9c3d52','#f8edcf','#75581c','#e8e3f7','#59468a','#dcefe9','#22665a']) assert.ok(rules.includes(color),color);
  for(const type of ['sales','purchase','purchase-bulk']) assert.ok(rules.includes(`[data-type="${type}"]`));
  assert.doesNotMatch(rules,/(?:width|height|padding|margin|font|display|transform|border-width)\s*:/);
  assert.doesNotMatch(rules,/#deleteSalesDraft|#addSalesItem|#addPurchaseItem|cash-quick-entry-mode/);
});

test('income and expense pearl actions are explicitly desktop-only',()=>{
  const prefix='html:not(.mobile-app-theme) #quickEntryForm:is([data-type="income"], [data-type="expense"])';
  assert.ok(css.includes(`${prefix} #cancelQuickEntry,`));
  assert.ok(css.includes(`${prefix} #quickEntrySubmit,`));
  assert.ok(css.includes(`${prefix} :is(#cancelQuickEntry, #quickEntrySubmit),`));
  assert.ok(css.includes(`${prefix} :is(#cancelQuickEntry, #quickEntrySubmit):active:not(:disabled),`));
});
