const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('desktop purchase relocates the existing warehouse action, retaining one shared SVG and permission target',()=>{
 assert.equal((html.match(/id="toggleInventory"/g)||[]).length,1);
 assert.match(app,/desktopUi\.inventoryAnchor = document\.createComment/);
 assert.match(app,/desktopUi\.purchaseActions\.append\(desktopUi\.primaryAction, els\.toggleInventory\)/);
 assert.match(app,/desktopUi\.purchaseActions\.remove\(\);/);
 assert.match(app,/desktopUi\.inventoryAnchor\.after\(els\.toggleInventory\);/);
 assert.match(app,/els\.toggleInventory\.disabled = employee && !inventoryView/);
 for(const id of ['openBulkPurchase','toggleInventory'])assert.match(html,new RegExp(`id="${id}"[^>]*><svg class="purchase-action-icon"`));
 const block=css.slice(css.indexOf('/* Desktop purchase actions reuse'),css.indexOf('/* End Desktop purchase actions. */'));
 assert.match(block,/\.purchase-action-icon \{ display: block; width: 32px; height: 32px/);
 assert.doesNotMatch(block,/desktopFilter|\.sidebar|\.layout|html\.mobile-app-theme/);
});
test('desktop Thu/Chi reuse Mobile content and state disclosures without rewriting filters or sales styles',()=>{
 const block=css.slice(css.indexOf('/* Desktop Thu/Chi:'),css.indexOf('/* End Desktop Thu/Chi. */'));
 assert.doesNotMatch(block,/desktopFilter|\.sidebar|\.layout|data-tab-panel="sales"|data-tab-panel="purchase"/);
 assert.match(block,/mobile-cash-flow,.mobile-flow-history-overview\) \{ display: grid/);
 assert.match(block,/data-mobile-flow-view="report-history"/);
 assert.match(block,/linear-gradient\(115deg, rgba\(246, 222, 255, 0\.94\), rgba\(217, 239, 255, 0\.95\)\)/);
 assert.match(app,/const button = event\.target\.closest\("\[data-mobile-flow-action\]"\);\s*if \(!button\) return;/);
 const start=app.indexOf('function setMobileCashFlowPanel('),end=app.indexOf('function renderSalesGoodsReport(',start),panels={income:{dataset:{},querySelector:()=>null},expense:{dataset:{},querySelector:()=>null}};
 const ctx={USE_MOBILE_APP_THEME:false,document:{querySelector:s=>panels[s.match(/"(income|expense)"/)[1]]},window:{requestAnimationFrame:f=>f()}};vm.createContext(ctx);vm.runInContext(app.slice(start,end),ctx);
 for(const type of ['income','expense']){ctx.setMobileCashFlowPanel(type,'report');assert.equal(panels[type].dataset.mobileFlowView,'report');ctx.setMobileCashFlowPanel(type,'history');assert.equal(panels[type].dataset.mobileFlowView,'report-history');ctx.setMobileCashFlowPanel(type,'close-history');assert.equal(panels[type].dataset.mobileFlowView,'report');ctx.setMobileCashFlowPanel(type,'manage');assert.equal(panels[type].dataset.mobileFlowView,'manage');}
});
