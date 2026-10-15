const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.resolve(__dirname,'../styles.css'),'utf8'),app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
test('employee mobile filter clearance restores only the gap removed by the hidden sidebar',()=>{
 assert.match(css,/html\.mobile-app-theme \.layout\s*\{[^}]*--mobile-layout-gap: 14px;[^}]*gap: var\(--mobile-layout-gap\);/);
 const fix=css.match(/html\.mobile-app-theme body\.employee-session\.mobile-secondary-tab \.layout\s*\{([^}]+)\}/)[1];
 assert.ok(fix.includes('padding-top: calc(max(8px, env(safe-area-inset-top)) + 36px + var(--mobile-layout-gap));'));
 assert.doesNotMatch(fix,/display|position|margin|transform/);
 assert.match(app,/setAttribute\("data-role-hidden", employee && USE_MOBILE_APP_THEME \? "true" : "false"\)/);
 const rail=css.match(/html\.mobile-app-theme \.mobile-time-filter-shell\s*\{([^}]+)\}/)[1];
 assert.match(rail,/top: max\(8px, env\(safe-area-inset-top\)\);/);
});
