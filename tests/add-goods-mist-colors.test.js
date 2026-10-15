const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
test('approved mist-blue add-goods colors are scoped to both trade forms, not platform geometry',()=>{
 const start=css.indexOf('/* Approved “Lam sương” add-goods buttons');assert.ok(start>=0);
 const rules=css.slice(start,css.indexOf('/* Mobile purchase actions',start));
 for(const s of ['html #quickEntryForm[data-type="sales"] #addSalesItem','html #quickEntryForm[data-type="purchase"] #addPurchaseItem'])assert.ok(rules.includes(s));
 for(const c of ['#e3eef8','#dceef3','#35617d','#b8d0e0','#ffffff70'])assert.ok(rules.includes(c));
 assert.doesNotMatch(rules,/(?:width|height|padding|margin|font|display|transform)\s*:|#cancelQuickEntry|#quickEntrySubmit/);
 const lum=h=>h.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 for(const bg of ['e3eef8','dceef3'])assert.ok((lum(bg)+.05)/(lum('35617d')+.05)>=4.5);
});
