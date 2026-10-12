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
 const pairs=[['69509a',['faf6ff','f5f8ff']],['604b8d',['eee4fa','e7ecfb','eee1fb','dce9fb']],['24695f',['f0faf6','f8fcff','e3f4ec','e8f2fd','def2e9']],['286c60',['dcf2e9','e8f3fb']],['955173',['fff3f8','faf7ff']],['824361',['f8e3ee','eee8fa','f5e5ef','eee7f9']],['176992',['faf6fc','ffffff']],['315e91',['f4f8ff','f5fbf9']],['695980',['f4edfb']],['235a6a',['d3f1e5','b1ded7','c1ddf0']],['55497f',['e8e2f7','e0effb']],['9b4167',['f9e3ed']],['58468e',['fcfaff','e6e6ff']],['944567',['fff9ff','f8e9ff']]];
 for(const [fg,bgs] of pairs)for(const bg of bgs)assert.ok(contrast(fg,bg)>=4.5,`${fg} on ${bg}`);
 for(const [a,b] of [['7450c9','4e65bd'],['4e65bd','247ba8']])for(let i=0;i<=20;i++){const ah=a.match(/../g).map(x=>parseInt(x,16)),bh=b.match(/../g).map(x=>parseInt(x,16));const bg=ah.map((v,j)=>Math.round(v+(bh[j]-v)*i/20).toString(16).padStart(2,'0')).join('');assert.ok(contrast('ffffff',bg)>=4.5);}
});
