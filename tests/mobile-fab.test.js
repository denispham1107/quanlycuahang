const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
test('shared quick-add uses approved multi-layer glass and clear white plus on both platforms',()=>{
 const rules=css.slice(css.indexOf('/* One shared quick-add button:'),css.indexOf('/* Shared AI companion:'));
 assert.match(rules,/html #quickEntryButton \{/);
 assert.match(rules,/width: 45\.9px/);assert.match(rules,/height: 45\.9px/);assert.match(rules,/border-radius: 50%/);
 assert.equal(45.9/54,.85,'circle is 15% smaller while retaining a touch target above 44px');
 assert.match(rules,/#quickEntryButton svg \{\s*width: 22\.1px;\s*height: 22\.1px;/);
 assert.match(rules,/linear-gradient\(135deg,#a27adf 3%,#7568d0 45%,#328ec5\)/);
 assert.match(rules,/#quickEntryButton::before \{\s*inset: 8%;/);
 assert.match(rules,/#quickEntryButton::after \{[\s\S]*?inset: 3%;[\s\S]*?rotate\(-22deg\)/);
 assert.match(rules,/isolation: isolate/);assert.match(rules,/overflow: hidden/);
 assert.match(rules,/#quickEntryButton svg \{[\s\S]*?stroke: #fff;\s*stroke-width: 3;/);
 assert.doesNotMatch(rules,/#aiButton|\.ai-fab|html:not/);
 const luminance=hex=>{const rgb=hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 for(const hex of ['a27adf','7568d0','328ec5'])assert.ok(1.05/(luminance(hex)+.05)>=3,`white plus contrasts against ${hex}`);
});
test('quick-add retains press feedback, keyboard focus and reduced-motion support',()=>{
 const rules=css.slice(css.indexOf('/* One shared quick-add button:'));
 assert.match(rules,/#quickEntryButton:active \{/);assert.match(rules,/#quickEntryButton:focus-visible \{/);
 assert.match(rules,/@media \(prefers-reduced-motion: reduce\) \{\s*html #quickEntryButton \{ transition: none;/);
});
test('shared AI robot retains its accessible label without external icons',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const button=html.match(/<button class="quick-entry-fab ai-fab"[\s\S]*?<\/button>/)[0];
 assert.match(button,/aria-label="Mở trợ lý AI"/);assert.match(button,/class="ai-fab-label"[^>]*>AI<\/span>/);
 assert.match(button,/class="ai-fab-robot" aria-hidden="true" viewBox="0 0 24 24"/);assert.match(button,/<rect[^>]*rx="4"/);
 assert.doesNotMatch(button,/<img|https?:/);
 assert.match(css,/\.ai-fab \.ai-fab-robot \{ display: none; \}/);
 assert.match(css,/html #aiButton \.ai-fab-label \{ display: none; \}/);
});
test('AI keeps its original glass paint and matches quick-add dimensions on both platforms',()=>{
 const rules=css.slice(css.indexOf('/* Shared AI companion:'));
 const ai=rules.match(/html #aiButton \{([^}]+)\}/)[1];
 const plus=css.match(/html #quickEntryButton \{([^}]+)\}/)[1];
 for(const property of ['width','height','min-width','min-height','border-radius']){
  const re=new RegExp(`(?:^|;)\\s*${property}: ([^;]+);`);assert.equal(ai.match(re)[1],plus.match(re)[1],property);
 }
 assert.match(rules,/#aiButton \.ai-fab-robot \{[\s\S]*?stroke: #fff;\s*stroke-width: 1\.8;/);
 assert.match(rules,/#aiButton:focus-visible/);assert.match(rules,/prefers-reduced-motion: reduce/);
});

test('desktop quick-add is no longer CSS-hidden and sits below the final content row',()=>{
 assert.doesNotMatch(css,/html:not\(\.mobile-app-theme\) \.quick-entry-fab:not\(\.ai-fab\)\s*\{\s*display: none;/);
 assert.match(css,/html:not\(\.mobile-app-theme\) \.quick-entry-fab\s*\{\s*right: 24px;\s*bottom: 20px;/);
 assert.match(css,/\.quick-entry-fab\[hidden\]\s*\{\s*display: none;/);
});
