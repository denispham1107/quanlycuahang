const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('styles.css','utf8'),block=css.slice(css.indexOf('/* Desktop purchase overview and primary'),css.indexOf('/* End purchase Sales-matched paint. */'));
test('purchase Sales matching is desktop purchase-only paint, without modifying layout or warehouse button',()=>{
 for(const rule of block.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^}]+)\}/g)){for(const s of rule[1].split(','))assert.ok(s.trim().startsWith('html:not(.mobile-app-theme) body[data-active-tab="purchase"]'),s);for(const d of rule[2].split(';').filter(s=>s.trim()))assert.match(d.trim(),/^(background|border-color|box-shadow|color|-webkit-background-clip|background-clip):/);}
 assert.doesNotMatch(block,/toggleInventory|openBulkPurchase|desktopFilter|\.sidebar/);assert.match(block,/stock-import strong \{ background: var\(--money-gradient\)/);assert.match(block,/stock-export strong \{ color: var\(--balance\)/);assert.match(block,/category-two strong \{ color: var\(--expense\)/);
 assert.match(block,/linear-gradient\(110deg,#7860b5,#4f78ac\)/);assert.match(block,/background: rgba\(255,255,255,\.95\)/);
});
