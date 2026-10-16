const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
test('desktop sales header uses the quick-add FAB palette and clipped non-interactive glass',()=>{
 const selector='html:not(.mobile-app-theme) body[data-active-tab="sales"] #desktopPrimaryAction';
 const rule=[...css.matchAll(/([^{}]+)\{([^}]+)\}/g)].find(m=>m[1].trim()===selector&&m[2].includes('background:'))[2];
 assert.match(rule,/linear-gradient\(135deg,#a27adf 3%,#7568d0 45%,#328ec5\)/);
 assert.match(rule,/border-color: #ffffffb3/);assert.match(rule,/inset 0 -3px 5px #34479655/);
 const block=css.slice(css.indexOf('/* Desktop sales quick-add matches'),css.indexOf('/* End Desktop sales quick-add glass. */'));
 for(const m of block.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^}]+)\}/g))assert.ok(m[1].trim().startsWith(selector));
 assert.equal((block.match(/pointer-events: none/g)||[]).length,2);
 assert.match(block,/isolation: isolate; overflow: hidden/);assert.match(block,/:focus-visible/);
 assert.doesNotMatch(block,/(?:width|height|padding|margin|font-size|display)\s*:/);
});
