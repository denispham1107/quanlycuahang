const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
test('Desktop trade report cards match Overview white surfaces and hide only their own icons',()=>{
 const block=css.slice(css.indexOf('/* Desktop trade report cards match'),css.indexOf('/* Desktop trade accents:'));
 for(const rule of block.matchAll(/([^{}]+)\{([^{}]+)\}/g))for(const selector of rule[1].replace(/\/\*[\s\S]*?\*\//g,'').trim().split(/,\s*(?=html)/)){
  assert.ok(selector.startsWith('html:not(.mobile-app-theme) body'));assert.ok(selector.includes('#desktopInsights'));assert.match(selector,/data-active-tab="(?:purchase|sales)"/);
 }
 assert.match(block,/background: rgba\(255,255,255,0\.95\)/);assert.match(block,/border: 1px solid #e2e9f6/);assert.match(block,/min-height: 126px/);assert.match(block,/padding: 17px/);assert.match(block,/\.desktop-insight-icon \{ display: none; \}/);assert.match(block,/margin-top: 21px/);assert.match(block,/font-size: 13px/);assert.match(block,/var\(--money-gradient\)/);assert.match(block,/var\(--accent\)/);assert.match(block,/var\(--expense\)/);assert.match(block,/var\(--balance\)/);
});
