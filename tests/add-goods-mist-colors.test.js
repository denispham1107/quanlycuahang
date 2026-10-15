const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
test('approved soft-amethyst add-goods colors are scoped to both trade forms, not platform geometry',()=>{
 const start=css.indexOf('/* Approved “Tím thạch anh dịu” add-goods buttons');assert.ok(start>=0);
 const rules=css.slice(start,css.indexOf('/* Mobile purchase actions',start));
 for(const s of ['html #quickEntryForm[data-type="sales"] #addSalesItem','html #quickEntryForm[data-type="purchase"] #addPurchaseItem'])assert.ok(rules.includes(s));
 for(const c of ['#dccfeb','#cddcf2','#58457f','#b6a7d0','#ffffff40','#6a759016','#ffffffc7'])assert.ok(rules.includes(c));
 assert.doesNotMatch(rules,/(?:width|height|padding|margin|font|display|transform)\s*:|#cancelQuickEntry|#quickEntrySubmit/);
 const lum=h=>h.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 for(const bg of ['dccfeb','cddcf2'])assert.ok((lum(bg)+.05)/(lum('58457f')+.05)>=4.5);
});
