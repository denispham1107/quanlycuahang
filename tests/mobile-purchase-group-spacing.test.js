const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
test('mobile purchase item groups use the sales form gap without changing inner fields or desktop',()=>{
 const block=css.slice(css.indexOf('/* Mobile purchase groups use'),css.indexOf('/* End Mobile purchase group spacing. */'));
 assert.match(block,/html\.mobile-app-theme \.sales-page-mode #quickEntryForm\[data-type="purchase"\] #purchaseItems \{ display: grid; gap: 12px; \}/);
 assert.match(block,/@media \(max-width: 700px\)/);assert.match(block,/#purchaseItems \{ gap: 6px; \}/);
 assert.doesNotMatch(block,/html:not|margin|padding|color|font|salesItems|purchase-bulk|\.sales-item-row/);
});
