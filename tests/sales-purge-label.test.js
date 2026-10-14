const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
test('desktop cancelled sales keep the complete permanent-delete label in a reserved single-line lane',()=>{
 const block=css.slice(css.indexOf('/* Desktop cancelled-sale purge label:'),css.indexOf('/* End Desktop cancelled-sale purge label. */'));
 assert.match(block,/min-width: 110px; max-width: none/);assert.match(block,/white-space: nowrap; overflow-wrap: normal; word-break: normal/);assert.match(block,/padding-bottom: 54px/);
 assert.doesNotMatch(block,/html\.mobile-app-theme|desktopFilter|\.sidebar|th:nth-child|font-size: 0|display: none/);
 for(const rule of block.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{[^}]*\}/g))assert.ok(rule[1].trim().startsWith('html:not(.mobile-app-theme) .sales-history-table .entry-cancelled'));
 assert.match(app,/data-purge-history="\$\{escapeHtml\(id\)\}"[\s\S]*?>Xóa vĩnh viễn<\/button>/);
});
