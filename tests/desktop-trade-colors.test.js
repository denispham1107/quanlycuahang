const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const block=css.slice(css.indexOf('/* Desktop trade accents:'),css.indexOf('/* End Desktop trade accents. */'));
test('desktop trade accents only change paint, scoped to sales/purchase and never mobile',()=>{
 assert.ok(block.length>2000);
 for(const rule of block.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^}]+)\}/g)){
  for(const selector of rule[1].trim().split(/,\s*\n/)){assert.ok(selector.trim().startsWith('html:not(.mobile-app-theme)'),selector);assert.ok(/data-(active-tab|tab-panel)="(sales|purchase)"/.test(selector),selector);}
  for(const declaration of rule[2].split(';').filter(s=>s.trim()))assert.match(declaration.trim(),/^(color|background|border-color|box-shadow):/);
 }
 assert.ok(block.includes('tr:not(.entry-cancelled) .amount-cell'));
 assert.ok(block.includes('inventory-log-purpose.export'));
});
test('desktop trade text and primary warehouse button contrast on every gradient stop',()=>{
 const lum=hex=>hex.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 const pairs=[['69509a',['eee3fa','e4eefa']],['24695f',['e0f3e8','e0eff8','def2e9','c3ebdc','cbe8f6','eaf6f1','f0f4ff']],['286c60',['f4fcf7','e8f5ef']],['955173',['fbe2ed','eee5f8']],['176992',['fff5fa','f1edfa']],['315e91',['e5ecff','def3ed']],['695980',['e9dff7']],['6a425c',['f9ddbf','edc5c9','e5d3f5']],['9b4167',['f9e3ed']],['58468e',['ded2f2','c8dcf1']],['853a5c',['f5ccdf','e9d8f6']],['223766',['ded2f2','c8dcf1','f5ccdf','e9d8f6','c3ebdc','cbe8f6']]];
 for(const [fg,bgs] of pairs)for(const bg of bgs)assert.ok(contrast(fg,bg)>=4.5,`${fg} on ${bg}`);
 for(const [a,b] of [['7450c9','4e65bd'],['4e65bd','247ba8'],['7251a8','436fa8'],['27816e','306e91'],['994c75','70599e'],['9c4f78','715d9f'],['6550a0','376f9f'],['55549a','2a769b']])for(let i=0;i<=20;i++){const ah=a.match(/../g).map(x=>parseInt(x,16)),bh=b.match(/../g).map(x=>parseInt(x,16));const bg=ah.map((v,j)=>Math.round(v+(bh[j]-v)*i/20).toString(16).padStart(2,'0')).join('');assert.ok(contrast('ffffff',bg)>=4.5,`white on ${bg}`);}
});
test('desktop trade uses rich headers, colored totals and alternating rows rather than near-white accents',()=>{
 for(const [selector,palette] of [['.draft-order-table thead','#7251a8,#436fa8'],['.sales-history-table thead','#9c4f78,#715d9f'],['.inventory-log-table thead','#55549a,#2a769b']])assert.ok(block.includes(`${selector} { background: linear-gradient(110deg,${palette}); }`));
 for(const table of ['draft-order-table','sales-history-table','inventory-log-table'])assert.ok(block.includes(`.${table} th { color: #fff; }`));
 assert.ok(block.includes('report-total .report-amount { color: #fff; }'));assert.ok(block.includes('inventory-log-summary strong { color: #fff; }'));
 assert.ok(block.includes('#f9ddbf,#edc5c9 50%,#e5d3f5'));assert.ok(block.includes('tbody tr:not(.entry-cancelled):nth-child(even)'));
});
