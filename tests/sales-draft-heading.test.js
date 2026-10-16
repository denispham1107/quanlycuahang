const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
test('desktop moves the existing draft title into its card header and clears stale titles before early returns',()=>{
 const fn=app.slice(app.indexOf('function renderSalesDraftList('),app.indexOf('function renderInventory('));
 assert.match(fn,/const desktopDraftHeader = !USE_MOBILE_APP_THEME/);
 assert.match(fn,/desktopDraftHeader\?\.querySelector\("\.draft-order-heading"\)\?\.remove\(\)/);
 assert.ok(fn.indexOf('?.remove()')<fn.indexOf('if (!drafts.length)'));
 assert.match(fn,/desktopDraftHeader\.prepend\(els\.salesDraftList\.querySelector\("\.draft-order-heading"\)\)/);
 assert.match(css,/html:not\(\.mobile-app-theme\) \.sales-main-panel > \.panel-heading \.draft-order-heading \{ font-size: 20px; font-weight: 700;/);
 assert.match(css,/html:not\(\.mobile-app-theme\) #salesDraftList \{ margin-top: 0; \}/);
});
