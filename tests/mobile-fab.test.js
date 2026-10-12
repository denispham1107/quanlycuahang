const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
test('shared mobile quick-add has a soft glass surface and clear white plus without changing AI or desktop',()=>{
 const rules=css.slice(css.indexOf('/* One shared mobile quick-add button:'));
 assert.match(rules,/html\.mobile-app-theme #quickEntryButton \{/);
 assert.match(rules,/width: 54px/);assert.match(rules,/border-radius: 50%/);
 assert.match(rules,/linear-gradient\(145deg,#8670cf 0%,#7565c8 48%,#4085c1 100%\)/);
 assert.match(rules,/#quickEntryButton::before \{\s*inset: 2px;/);
 assert.match(rules,/#quickEntryButton svg \{[\s\S]*?stroke: #fff;\s*stroke-width: 3;/);
 assert.doesNotMatch(rules,/#aiButton|\.ai-fab|html:not/);
 const luminance=hex=>{const rgb=hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 for(const hex of ['8670cf','7565c8','4085c1'])assert.ok(1.05/(luminance(hex)+.05)>=3,`white plus contrasts against ${hex}`);
});
test('quick-add retains press feedback, keyboard focus and reduced-motion support',()=>{
 const rules=css.slice(css.indexOf('/* One shared mobile quick-add button:'));
 assert.match(rules,/#quickEntryButton:active \{/);assert.match(rules,/#quickEntryButton:focus-visible \{/);
 assert.match(rules,/@media \(prefers-reduced-motion: reduce\) \{\s*html\.mobile-app-theme #quickEntryButton \{ transition: none;/);
});
