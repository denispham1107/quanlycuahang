const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('desktop sales relocates one existing customer button before create-order and restores its anchor',()=>{
 assert.equal((html.match(/id="openCustomers"/g)||[]).length,1);
 assert.match(app,/desktopUi\.salesActions\.append\(els\.openCustomers, desktopUi\.primaryAction\)/);
 assert.match(app,/tabName !== "sales" && desktopUi\.salesActions\?\.isConnected/);
 assert.match(app,/desktopUi\.customerAnchor\.after\(els\.openCustomers\)/);
 assert.match(css,/html:not\(\.mobile-app-theme\) \.sales-main-panel > \.panel-heading h2 \{ display: none; \}/);
 assert.match(css,/#desktopSalesActions #openCustomers\[data-role-hidden="true"\] \{ display: none; \}/);
 assert.match(html,/<h2>Bán hàng<\/h2>\s*<span id="salesOrderCount">/);
});
