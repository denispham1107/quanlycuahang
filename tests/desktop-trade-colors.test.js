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
 const pairs=[['69509a',['eee3fa','e4eefa']],['24695f',['e0f3e8','e0eff8','def2e9','e5fbf7','faffff','eaf6f1','f0f4ff']],['286c60',['f4fcf7','e8f5ef']],['955173',['fbe2ed','eee5f8']],['176992',['fff5fa','f1edfa']],['315e91',['e5ecff','def3ed']],['695980',['e9dff7']],['6a425c',['f9ddbf','edc5c9','e5d3f5']],['9b4167',['f9e3ed']],['58468e',['fcfaff','e6e6ff']],['944567',['fff9ff','f8e9ff']],['223766',['fcfaff','e6e6ff','fff9ff','f8e9ff','faffff','e5fbf7']]];
 for(const [fg,bgs] of pairs)for(const bg of bgs)assert.ok(contrast(fg,bg)>=4.5,`${fg} on ${bg}`);
 for(const bg of ['d7eee6','dcecfb'])assert.ok(contrast('285f56',bg)>=4.5,'separate mint-blue history total is readable');
 for(const bg of ['ede5fa','e6ecfc','d8c4ee','d3def6'])assert.ok(contrast('584282',bg)>=4.5,'approved lavender heading/header text is readable');
 for(const [a,b] of [['7450c9','4e65bd'],['4e65bd','247ba8'],['7251a8','436fa8'],['27816e','306e91'],['6550a0','376f9f'],['55549a','2a769b']])for(let i=0;i<=20;i++){const ah=a.match(/../g).map(x=>parseInt(x,16)),bh=b.match(/../g).map(x=>parseInt(x,16));const bg=ah.map((v,j)=>Math.round(v+(bh[j]-v)*i/20).toString(16).padStart(2,'0')).join('');assert.ok(contrast('ffffff',bg)>=4.5,`white on ${bg}`);}
 for(const [a,b] of [['f9ddbf','edc5c9'],['edc5c9','e5d3f5']])for(let i=0;i<=20;i++){const ah=a.match(/../g).map(x=>parseInt(x,16)),bh=b.match(/../g).map(x=>parseInt(x,16));const bg=ah.map((v,j)=>Math.round(v+(bh[j]-v)*i/20).toString(16).padStart(2,'0')).join('');assert.ok(contrast('6a425c',bg)>=4.5,`dark history text on ${bg}`);assert.ok(lum(bg)>lum('994c75')&&lum(bg)>lum('715d9f'),'history bands brighter than previous dark colors');}
});
test('sales/purchase overview cards retain their restored v151 light paint, not v152 strong fills',()=>{
 assert.doesNotMatch(block,/\.desktop-insight\.(total|category-one|category-two) \{/);
 assert.doesNotMatch(block,/\.desktop-insight-icon \{/);
 assert.ok(block.includes('.desktop-insight.category-one strong { color: #944567; }'));
 assert.match(css,/\.desktop-insight\.category-one \{\s*border-color: rgba\(245, 183, 249, 0\.7\);\s*background: linear-gradient\(135deg, #fff9ff, #f8e9ff\)/);
});
test('desktop sales history matches the confirmed Tím oải hương preview without changing other trade palettes',()=>{
 for(const [selector,palette] of [['.draft-order-table thead','#7251a8,#436fa8'],['.sales-history-table thead','#d8c4ee,#d3def6'],['.inventory-log-table thead','#55549a,#2a769b']])assert.ok(block.includes(`${selector} { background: linear-gradient(110deg,${palette}); }`));
 for(const table of ['draft-order-table','inventory-log-table'])assert.ok(block.includes(`.${table} th { color: #fff; }`));
 assert.ok(block.includes('.sales-history-table th { color: #584282; }'));
 assert.ok(block.includes('.sales-history-panel .panel-heading > span { color: #584282; }'));
 assert.ok(block.includes('#salesRangeLabel .report-amount { color: #285f56; }'));
 const reference=block.slice(block.indexOf('> .sales-history-panel { background:')).match(/background: ([^;]+)/)[1];
 assert.equal(block.slice(block.indexOf('> .sales-history-panel { background:')).match(/background: ([^;]+)/)[1],'linear-gradient(115deg,#ede5fa,#e6ecfc)');
 assert.ok(block.includes('border-color: #c6b5e3'));assert.ok(block.includes('tbody tr:not(.entry-cancelled) { background: #fcfaff; }'));assert.ok(block.includes('tbody tr:not(.entry-cancelled):nth-child(even) { background: #f1edfa; }'));
 const total=block.slice(block.indexOf('#salesRangeLabel { background:')).match(/background: ([^;]+)/)[1];assert.notEqual(total,reference);assert.equal(total,'linear-gradient(110deg,#d7eee6,#dcecfb)');
 assert.ok(block.includes('report-total .report-amount { color: #fff; }'));assert.ok(block.includes('inventory-log-summary strong { color: #fff; }'));
 assert.ok(block.includes('#f9ddbf,#edc5c9 50%,#e5d3f5'));assert.ok(block.includes('tbody tr:not(.entry-cancelled):nth-child(even)'));
});
