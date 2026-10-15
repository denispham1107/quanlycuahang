const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('sales and purchase omit static plus instructions while retaining action targets',()=>{
 assert.doesNotMatch(html,/Bấm nút \+ để (?:tạo đơn hàng mới cho khách|nhập hàng hóa mới vào kho)/);
 for(const id of ['openCustomers','openBulkPurchase','toggleInventory'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
 assert.match(html,/id="salesDraftList"/);assert.match(html,/id="inventoryLogPanel"/);
});
test('desktop header actions use the matched Lam ngoc palette; bulk action and Mobile stay unchanged',()=>{
 const rule=selector=>[...css.matchAll(/([^{}]+)\{([^}]+)\}/g)].find(m=>m[1].trim()===selector)[2];
 const desktop=rule('html:not(.mobile-app-theme) [data-tab-panel="purchase"] #openBulkPurchase'),mobile=rule('html.mobile-app-theme .purchase-main-panel > #openBulkPurchase');
 const warehouse=rule('html:not(.mobile-app-theme) #desktopPurchaseActions #toggleInventory');
 const primary=rule('html:not(.mobile-app-theme) #desktopPurchaseActions #desktopPrimaryAction');
 assert.match(primary,/linear-gradient\(110deg,#337985,#3c6c97\)/);
 assert.match(primary,/color: #fff; border-color: #ffffffc7; box-shadow: 0 7px 16px #586d9c26/);
 assert.doesNotMatch(primary,/(?:width|height|padding|margin|font|display|border-radius)\s*:/);
 assert.match(warehouse,/linear-gradient\(175deg,#ffffff55,transparent 68%\),linear-gradient\(110deg,#d5e9e7,#d7e7f4\)/);
 assert.match(warehouse,/color: #315e72; border-color: #a3c3cf; box-shadow: 0 5px 13px #61719b1c/);
 assert.match(desktop,/radial-gradient\(ellipse at 10% 0%,#ffffff66,transparent 65%\),linear-gradient\(110deg,#eed5ed,#ded3ef 50%,#cfcff0\)/);
 assert.match(desktop,/color: #5c4478; border-color: #bda7cc; box-shadow: 0 5px 14px #5d6e9b24/);
 assert.match(mobile,/linear-gradient\(110deg,#c5eee1,#97d4ca 48%,#a6cde7\)/);assert.match(mobile,/color: #235a6a; border: 1px solid #8bbdbb/);
 const luminance=h=>h.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 for(const bg of ['eed5ed','ded3ef','cfcff0','ffffff'])assert.ok((luminance(bg)+.05)/(luminance('5c4478')+.05)>=4.5);
 for(const bg of ['337985','3c6c97'])assert.ok((luminance('ffffff')+.05)/(luminance(bg)+.05)>=4.5);
 for(const bg of ['d5e9e7','d7e7f4'])assert.ok((luminance(bg)+.05)/(luminance('315e72')+.05)>=4.5);
});
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
