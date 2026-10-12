const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
test('shared mobile quick-add has a soft glass surface and clear white plus with independently scoped rules',()=>{
 const rules=css.slice(css.indexOf('/* One shared mobile quick-add button:'),css.indexOf('/* Mobile AI companion:'));
 assert.match(rules,/html\.mobile-app-theme #quickEntryButton \{/);
 assert.match(rules,/width: 45\.9px/);assert.match(rules,/height: 45\.9px/);assert.match(rules,/border-radius: 50%/);
 assert.equal(45.9/54,.85,'circle is 15% smaller while retaining a touch target above 44px');
 assert.match(rules,/#quickEntryButton svg \{\s*width: 22\.1px;\s*height: 22\.1px;/);
 assert.match(rules,/linear-gradient\(145deg,#8670cf 0%,#7565c8 48%,#4085c1 100%\)/);
 assert.match(rules,/#quickEntryButton::before \{\s*inset: 1\.7px;/);
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
test('mobile AI robot retains its accessible label and desktop text fallback without external icons',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const button=html.match(/<button class="quick-entry-fab ai-fab"[\s\S]*?<\/button>/)[0];
 assert.match(button,/aria-label="Mở trợ lý AI"/);assert.match(button,/class="ai-fab-label"[^>]*>AI<\/span>/);
 assert.match(button,/class="ai-fab-robot" aria-hidden="true" viewBox="0 0 24 24"/);assert.match(button,/<rect[^>]*rx="4"/);
 assert.doesNotMatch(button,/<img|https?:/);
 assert.match(css,/\.ai-fab \.ai-fab-robot \{ display: none; \}/);
 assert.match(css,/html\.mobile-app-theme #aiButton \.ai-fab-label \{ display: none; \}/);
});
test('AI circle matches current quick-add size and glass colors on mobile only',()=>{
 const rules=css.slice(css.indexOf('/* Mobile AI companion:'));
 const ai=rules.match(/html\.mobile-app-theme #aiButton \{([^}]+)\}/)[1];
 const plus=css.match(/html\.mobile-app-theme #quickEntryButton \{([^}]+)\}/)[1];
 for(const property of ['width','height','min-width','min-height','border','border-radius','background','box-shadow']){
  const re=new RegExp(`(?:^|;)\\s*${property}: ([^;]+);`);assert.equal(ai.match(re)[1],plus.match(re)[1],property);
 }
 assert.match(rules,/#aiButton \.ai-fab-robot \{[\s\S]*?stroke: #fff;\s*stroke-width: 1\.8;/);
 assert.match(rules,/#aiButton:focus-visible/);assert.match(rules,/prefers-reduced-motion: reduce/);
});
