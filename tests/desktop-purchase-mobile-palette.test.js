const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const block=css.slice(css.indexOf('/* Desktop purchase palette follows Mobile;'),css.indexOf('/* End Desktop purchase Mobile palette. */'));
test('desktop purchase Mobile palette only changes paint inside purchase reports and history',()=>{
 assert.ok(block.length>3000);
 for(const m of block.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^}]+)\}/g)){
  assert.ok(m[1].trim().startsWith('html:not(.mobile-app-theme)'));assert.match(m[1],/data-(?:active-tab|tab-panel)="purchase"/);
  for(const d of m[2].split(';').filter(d=>d.trim()))assert.match(d.trim(),/^(?:background(?:-clip)?|-webkit-background-clip|border-color|border-radius|color|box-shadow):/);
 }
 assert.doesNotMatch(block,/desktopPurchaseActions|toggleInventory|desktopPrimaryAction|desktopFilter|\.sidebar|\.layout|data-tab-panel="sales"/);
 assert.match(block,/\.stock-import strong \{ color: #6654b5/);assert.match(block,/\.stock-export strong \{ color: #ae4b77/);
 assert.match(block,/\.total strong \{ background: none; -webkit-background-clip: border-box; background-clip: border-box; color: #244f96/);
});
test('Mobile-inspired desktop purchase labels retain readable contrast on pastel surfaces',()=>{
 const lum=h=>h.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 for(const [fg,bgs] of [['244f96',['fffaff','e4efff']],['6654b5',['f5e8fc','e6eaff','dff2ff','ffffff']],['ae4b77',['ffffff','f5f5ff']],['24776b',['ffffff','eff7ff']],['586580',['fffaff','e4efff']],['203459',['f0eafc','e9f4ff']],['2c66a7',['f0eafc','e9f4ff']],['243656',['ffffff','f7faff']],['235a6a',['c5eee1','97d4ca','a6cde7']]])for(const bg of bgs)assert.ok((lum(bg)+.05)/(lum(fg)+.05)>=4.5,fg+' on '+bg);
});
