const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
test('mobile export design preserves every field, action and accessible heading',()=>{
 const popup=html.slice(html.indexOf('id="exportInventoryModal"'),html.indexOf('id="editInventoryLogModal"'));
 for(const id of ['exportInventoryForm','exportInventoryName','exportInventoryDate','exportInventoryQuantity','exportInventoryReason','deleteExportInventoryReason','toggleExportInventoryReason','exportInventoryReasonPanel','exportInventoryNewReason','addExportInventoryReason','cancelExportInventory'])assert.ok(popup.includes(`id="${id}"`));
 assert.match(popup,/aria-labelledby="exportInventoryTitle"/);assert.match(popup,/export-dialog-icon/);assert.match(popup,/data-export-quantity-step="-1"/);assert.match(popup,/data-export-quantity-step="1"/);assert.match(popup,/type="submit">Hoàn Thành/);
 assert.match(css,/\.export-dialog-icon \{ display: none; \}/);
 const section=css.slice(css.indexOf('/* Export inventory: mobile-only'),css.indexOf('/* Approved trash model 1:'));
 for(const selector of section.split('{').slice(0,-1).map(x=>x.split('}').at(-1).trim()))if(!selector.startsWith('/*')&&!selector.startsWith('.export-dialog-icon'))assert.ok(selector.includes('html.mobile-app-theme'),selector);
 assert.match(section,/grid-template-columns: 44px minmax\(0,1fr\) 44px/);
 assert.match(section,/> button\[hidden\].*\[hidden\] \{ display: none; \}/);
 assert.doesNotMatch(section,/overflow-y:\s*auto/,'keep the existing backdrop as the single scroll owner');
});
