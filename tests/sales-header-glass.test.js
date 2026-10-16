const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
test('desktop sales header matches the active sales tab palette without FAB glass layers',()=>{
 const selector='html:not(.mobile-app-theme) body[data-active-tab="sales"] #desktopPrimaryAction';
 const rule=[...css.matchAll(/([^{}]+)\{([^}]+)\}/g)].find(m=>m[1].trim()===selector&&m[2].includes('background:'))[2];
 const nav=[...css.matchAll(/([^{}]+)\{([^}]+)\}/g)].find(m=>m[1].includes('html:not(.mobile-app-theme) .desktop-nav-host .tab-button[data-tab="sales"].active'))[2];
 for(const prop of ['background','color','border-color','box-shadow']){
  const value=s=>s.match(new RegExp('(?:^|;)\\s*'+prop+':\\s*([^;]+)'))[1];assert.equal(value(rule),value(nav),prop);
 }
 assert.doesNotMatch(css,/body\[data-active-tab="sales"\] #desktopPrimaryAction::(?:before|after)/);
 assert.doesNotMatch(rule,/(?:width|height|padding|margin|font-size|display)\s*:/);
});
