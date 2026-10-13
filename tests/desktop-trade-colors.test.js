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
 for(const [a,b] of [['7450c9','4e65bd'],['4e65bd','247ba8'],['7251a8','436fa8'],['27816e','306e91'],['6550a0','376f9f'],['55549a','2a769b']])for(let i=0;i<=20;i++){const ah=a.match(/../g).map(x=>parseInt(x,16)),bh=b.match(/../g).map(x=>parseInt(x,16));const bg=ah.map((v,j)=>Math.round(v+(bh[j]-v)*i/20).toString(16).padStart(2,'0')).join('');assert.ok(contrast('ffffff',bg)>=4.5,`white on ${bg}`);}
 for(const [a,b] of [['f9ddbf','edc5c9'],['edc5c9','e5d3f5']])for(let i=0;i<=20;i++){const ah=a.match(/../g).map(x=>parseInt(x,16)),bh=b.match(/../g).map(x=>parseInt(x,16));const bg=ah.map((v,j)=>Math.round(v+(bh[j]-v)*i/20).toString(16).padStart(2,'0')).join('');assert.ok(contrast('6a425c',bg)>=4.5,`dark history text on ${bg}`);assert.ok(lum(bg)>lum('994c75')&&lum(bg)>lum('715d9f'),'history bands brighter than previous dark colors');}
});
test('purchase retains restored v151 cards while sales uses the mobile pastel hero',()=>{
 assert.ok(block.includes('body[data-active-tab="purchase"] .desktop-insight.category-one strong { color: #944567; }'));
 assert.ok(block.includes('body[data-active-tab="sales"] .desktop-insight.total strong { color: #18377a; }'));
 assert.ok(block.includes('body[data-active-tab="sales"] .desktop-insight { background: linear-gradient(115deg, rgba(246, 222, 255, 0.94), rgba(217, 239, 255, 0.95))'));
 assert.doesNotMatch(block,/body\[data-active-tab="purchase"\] \.desktop-insight[^{}]*\{[^}]*background:/);
 assert.match(css,/\.desktop-insight\.category-one \{\s*border-color: rgba\(245, 183, 249, 0\.7\);\s*background: linear-gradient\(135deg, #fff9ff, #f8e9ff\)/);
});
test('desktop sales reuses mobile section and total palettes without changing filters or mobile CSS',()=>{
 const bg=selector=>{const rule=[...css.matchAll(/([^{}]+)\{([^}]+)\}/g)].findLast(m=>m[1].trim().endsWith(selector));return rule&&rule[2].match(/background: ([^;]+)/)?.[1];};
 const pairs=[
 ['html:not(.mobile-app-theme) [data-tab-panel="sales"] > .sales-main-panel','html.mobile-app-theme [data-tab-panel="sales"] > .sales-main-panel'],
 ['html:not(.mobile-app-theme) [data-tab-panel="sales"] > .sales-goods-panel','html.mobile-app-theme [data-tab-panel="sales"] > .sales-goods-panel'],
 ['html:not(.mobile-app-theme) [data-tab-panel="sales"] > .sales-history-panel','html.mobile-app-theme [data-tab-panel="sales"] > .sales-history-panel'],
 ['html:not(.mobile-app-theme) [data-tab-panel="sales"] #salesGoodsReport .report-total','html.mobile-app-theme #salesGoodsReport .report-total'],
 ['html:not(.mobile-app-theme) [data-tab-panel="sales"] #salesRangeLabel','html.mobile-app-theme #salesRangeLabel']
 ];
 for(const [desktop,mobile] of pairs)assert.equal(bg(desktop),bg(mobile),desktop);
 for(const n of ['3n+1','3n+2','3n'])assert.ok(block.includes(`.draft-order-table tbody tr:nth-child(${n})`));
 assert.ok(block.includes('.sales-history-table th { color: #824361; }'));
 assert.ok(block.includes('#salesRangeLabel .report-amount { color: #824361; }'));
 assert.ok(block.includes('.sales-history-table tr:not(.entry-cancelled) .amount-cell { color: #176992; }'));
 assert.ok(block.includes('.inventory-log-table thead { background: linear-gradient(110deg,#55549a,#2a769b); }'));
 assert.ok(block.includes('.inventory-log-summary strong { color: #fff; }'));
 const skin=css.slice(css.indexOf('/* Desktop sales button skin'),css.indexOf('/* End Desktop sales button skin. */'));
 assert.doesNotMatch(block+skin,/desktopFilter|\.sidebar|filter-rail|rangeMode|\.layout|grid-template|position:/);
 assert.match(skin,/\.delete-small::before/);assert.match(skin,/M5 7h14M9 7V4h6v3/);
 assert.doesNotMatch(skin,/html\.mobile-app-theme|data-tab-panel="purchase"/);
});
test('mobile-inspired desktop sales text and buttons preserve accessible contrast',()=>{
 const lum=h=>h.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 for(const [fg,bgs] of [['18377a',['f6deff','d9efff']],['4f617d',['f6deff','d9efff']],['69509a',['fcf7ff','f7f9ff','e5dcf7','dcecfb']],['24695f',['f2fbf8','fbfdff']],['955173',['fff5fa','fcfbff']],['285f56',['dcf2e9','e8f3fb']],['824361',['f8e3ee','eee8fa','f5e6ef','ece5f8']],['584a91',['fffaff','e8eaff','dcf0ff']],['075fd4',['fff5fa','f5f0fb']]])for(const bg of bgs)assert.ok(ratio(fg,bg)>=4.5,`${fg} on ${bg}`);
 assert.ok(ratio('c83578','fff0f6')>=3,'trash icon has non-text contrast matching Mobile');
 for(const [a,b] of [['9b36d6','6358cf'],['6358cf','1678b6']])for(let i=0;i<=20;i++){const x=a.match(/../g).map(v=>parseInt(v,16)),y=b.match(/../g).map(v=>parseInt(v,16));const bg=x.map((v,j)=>Math.round(v+(y[j]-v)*i/20).toString(16).padStart(2,'0')).join('');assert.ok(ratio('ffffff',bg)>=4.5,`primary label on ${bg}`);}
});
