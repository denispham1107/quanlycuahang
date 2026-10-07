const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
test('approved Wallet & Package icons have one shared SVG, clear direction and badge per tab',()=>{
  for(const [tab,design,direction] of [['income','wallet-income','M17 7 7 17M17 17H7V7'],['expense','wallet-expense','M7 7h10v10M7 17 17 7'],['purchase','package-open','M12 17V3m-6 8 6 6 6-6M19 21H5']]) {
    const button=html.match(new RegExp(`<button class="tab-button"[^>]*data-tab="${tab}"[\\s\\S]*?</button>`))[0];
    assert.equal((button.match(/<svg/g)||[]).length,1);
    assert.ok(button.includes(`data-icon-design="${design}"`));
    assert.ok(button.includes(`d="${direction}"`));
    for(const name of ['cash-stock-main','cash-stock-badge','cash-stock-direction'])assert.ok(button.includes(name));
    assert.match(button,/viewBox="0 0 32 32"/);
    assert.doesNotMatch(button,/desktop-tab-icon|<img/);
  }
});
test('Wallet & Package colors and full-canvas scaling remain shared and contrast on active tabs',()=>{
  assert.match(css,/\.tab-button \.cash-stock-main \{ stroke: var\(--mobile-nav-icon-ink\); stroke-width: 1\.7;/);
  assert.match(css,/\.tab-button \.cash-stock-direction \{ stroke: var\(--mobile-nav-icon-accent\); stroke-width: 2\.2;/);
  assert.match(css,/--mobile-nav-icon-badge: #6550da;/);
  assert.match(css,/\[data-tab="income"\], \[data-tab="expense"\], \[data-tab="purchase"\]\)\.active \{\s*--mobile-nav-icon-ink: #fff;\s*--mobile-nav-icon-accent: #fff;/);
  assert.match(css,/\.tab-icon svg \{ width: 100%; height: 100%; \}/);
  assert.match(css,/flex-basis: 32px; width: 32px; height: 32px/);
  assert.match(css,/flex-basis: 25px; width: 25px; height: 25px/);
});
