const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
test('desktop sales header uses approved Tim lam tram palette without FAB glass layers',()=>{
 const selector='html:not(.mobile-app-theme) body[data-active-tab="sales"] #desktopPrimaryAction';
 const rule=[...css.matchAll(/([^{}]+)\{([^}]+)\}/g)].find(m=>m[1].trim()===selector&&m[2].includes('background:'))[2];
 assert.match(rule,/background: linear-gradient\(110deg,#7860b5,#4f78ac\)/);
 assert.match(rule,/color: #fff; border-color: #7d83bb; box-shadow: 0 7px 16px #6c75a123,inset 0 1px 0 #ffffff80/);
 const lum=h=>h.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const a=[120,96,181],b=[79,120,172];for(let i=0;i<=100;i++){const bg=a.map((v,j)=>Math.round(v+(b[j]-v)*i/100).toString(16).padStart(2,'0')).join('');assert.ok(1.05/(lum(bg)+.05)>=4.5,'white label contrast '+bg);}
 assert.doesNotMatch(css,/body\[data-active-tab="sales"\] #desktopPrimaryAction::(?:before|after)/);
 assert.doesNotMatch(rule,/(?:width|height|padding|margin|font-size|display)\s*:/);
});
