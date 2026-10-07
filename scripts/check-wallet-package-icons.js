const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main(){
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
  try{
    for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]){
      const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.hostname!=='icons.test')return route.abort();
        if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});
        const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
        return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
      });
      await page.goto('http://icons.test/');
      await page.evaluate(()=>{
        authState.role='admin';authState.ready=true;authState.profile={role:'admin'};authState.user={uid:'preview-admin'};cloudStore.enabled=false;
        state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cù Lao Petshop',createdAt:'2026-10-07',categories:{income:[],expense:[]},entries:[],orders:[]}]});
        els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('stores');render();
      });
      const initial=await page.locator('[data-icon-design]').evaluateAll(icons=>icons.map(icon=>icon.outerHTML));
      for(const tab of ['income','expense','purchase']){
        const button=page.locator(`[data-tab="${tab}"]`);
        assert.equal(await button.locator('svg').count(),1);
        await button.click();
        assert.equal(await page.evaluate(()=>getActiveTabName()),tab);
        const metrics=await button.evaluate(button=>{
          const frame=button.querySelector('.tab-icon'),svg=frame.querySelector('svg'),label=button.querySelector('.tab-label');
          const bounds=button.getBoundingClientRect(),box=frame.getBoundingClientRect(),r=svg.getBoundingClientRect();
          return {ink:getComputedStyle(button.querySelector('.cash-stock-main')).stroke,arrow:getComputedStyle(button.querySelector('.cash-stock-direction')).stroke,badge:getComputedStyle(button.querySelector('.cash-stock-badge')).fill,
            clipped:bounds.left<0||bounds.right>innerWidth+1||r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1,labelClipped:label.scrollWidth>label.clientWidth+1,width:box.width};
        });
        assert.equal(metrics.ink,'rgb(255, 255, 255)');assert.equal(metrics.arrow,'rgb(255, 255, 255)');assert.equal(metrics.badge,'rgb(101, 80, 218)');
        assert.equal(metrics.clipped,false);assert.equal(metrics.labelClipped,false);assert.ok(metrics.width>=23);
        if(process.env.ICON_TEST_SHOTS&&[375,1440].includes(width)&&height===900)await page.locator(width<700?'#tabBar':'#desktopNavHost').screenshot({path:path.join(process.env.ICON_TEST_SHOTS,`wallet-package-${tab}-${width}.png`)});
      }
      assert.deepEqual(await page.locator('[data-icon-design]').evaluateAll(icons=>icons.map(icon=>icon.outerHTML)),initial,'Navigation does not swap platform-specific SVGs');
      await page.evaluate(()=>activateTab('stores'));
      for(const tab of ['income','expense','purchase']){
        const ink=await page.locator(`[data-tab="${tab}"] .cash-stock-main`).evaluate(el=>getComputedStyle(el).stroke);
        assert.notEqual(ink,'rgb(255, 255, 255)');assert.notEqual(ink,'none');
      }
      assert.deepEqual(errors,[]);await page.close();console.log(`Wallet & Package shared icons, navigation, contrast and bounds ${width}x${height}: OK`);
    }
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
