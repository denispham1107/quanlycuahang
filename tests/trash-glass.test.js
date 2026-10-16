const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const block=css.slice(css.indexOf('/* Approved trash model 1:'),css.indexOf('/* End approved trash glass. */'));
test('approved pink glass trash shares one native glyph on mobile and desktop',()=>{
 assert.match(block,/#b63e70/);assert.match(block,/linear-gradient\(145deg,#fff8fc,#fbe6ef 60%,#eddaee\)/);
 assert.match(block,/M10 11v6M14 11v6M19 6v14/);assert.match(block,/stroke-width='2'/);
 assert.match(block,/width: 18px/);assert.match(block,/height: 18px/);
 assert.equal((block.match(/data:image\/svg\+xml/g)||[]).length,1);
 assert.match(block,/html\.mobile-app-theme/);assert.match(block,/html:not\(\.mobile-app-theme\)/);
});
test('trash glass decorations cannot intercept clicks or change button dimensions',()=>{
 const face=block.slice(block.indexOf('html body .delete-small,'),block.indexOf('html body .delete-small::before,'));
 assert.doesNotMatch(face,/\b(?:width|height|padding|margin|border-radius|border-width|transform|overflow)\s*:/);
 assert.equal((block.match(/pointer-events: none/g)||[]).length,2);
 assert.match(block,/isolation: isolate/);assert.match(block,/inset: 3px/);
 assert.doesNotMatch(block,/\.history-purge-button|\.danger-button|button\[type=/);
});
test('mobile trash glyph is centered independently of the invisible text flex item',()=>{
 const center=block.slice(block.indexOf('/* Mobile buttons retain'),block.indexOf('html body .delete-small::after'));
 assert.match(center,/html\.mobile-app-theme body \.delete-small::before/);
 assert.match(center,/position: absolute/);assert.match(center,/left: 50%/);assert.match(center,/top: 50%/);
 assert.match(center,/transform: translate\(-50%,-50%\)/);
 assert.doesNotMatch(center,/html:not|width:|height:|padding:|gap:|margin:/);
});
