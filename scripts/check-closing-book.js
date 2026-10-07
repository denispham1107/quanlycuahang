const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main() {
  const root=path.join(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const start=html.indexOf('<section id="closingBookPage"');
  const end=html.indexOf('<script defer src="app.js',start);
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const helper=name=> {const start=app.indexOf(`function ${name}(`);return app.slice(start,app.indexOf('\nfunction ',start+1));};
  const browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
  try {
    const page=await browser.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',dialog=>dialog.dismiss());
    await page.route('http://closing.test/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><style>${fs.readFileSync(path.join(root,'styles.css'),'utf8').replace(/^\uFEFF/,'')}</style><div id="appShell"></div><nav id="tabBar"></nav><div id="authScreen" hidden></div><span id="syncStatus">Đã lưu cloud</span><button id="openClosingBookDesktop" class="closing-book-icon" hidden></button><button id="openClosingBookMobile" class="closing-book-icon" hidden></button>${html.slice(start,end)}`}));
    await page.goto('http://closing.test/');
    await page.addScriptTag({content:`let admin=true; let saves=0; let state={activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng thử nghiệm',closingMonths:[],entries:[]},{id:'b',name:'Cửa hàng 2',closingMonths:[],entries:[]}]}; const els=Object.fromEntries(Array.from(document.querySelectorAll('[id]'),el=>[el.id,el])); function isAdminUser(){return admin;} function getActiveStore(){return state.stores.find(s=>s.id===state.activeStoreId);} function getActiveTabName(){return 'overview';} function updateTimeFiltersVisibility(){} function recordActivity(){} function saveAndRender(){saves++;window.refreshClosingBookAccess?.();} ${['formatCurrency','formatDate','formatActivityDateTime','escapeHtml'].map(helper).join('\n')}`});
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'closing-book-core.js'),'utf8')});
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'closing-book.js'),'utf8')});
    await page.locator('#openClosingBookDesktop').click();
    assert.equal(await page.locator('#closingBookPage').isVisible(),true);
    await page.locator('#closingBookNewMonth').fill('09/2026');
    await page.locator('#closingBookCreateMonth button').click();
    assert.equal(await page.locator('#closingBookDay option').count(),30);
    await page.locator('[name="opening"]').fill('500000');
    await page.locator('[name="cash"]').fill('200000');
    await page.locator('[name="ending"]').fill('600000');
    await page.locator('[data-book-note="expense"]').fill('Khoản thử');
    await page.locator('[data-book-amount="expense"]').fill('100000');
    assert.match(await page.locator('#closingBookTotals').innerText(),/600\.000/);
    await page.locator('#closingBookForm button[type="submit"]').click();
    const saved=await page.evaluate(()=>getActiveStore().closingMonths[0].days[0]);
    assert.equal(saved.date,'2026-09-01'); assert.equal(saved.shifts[0].opening,500000);
    assert.equal(await page.evaluate(()=>getActiveStore().entries.length),0);
    await page.locator('#closingBookDay').selectOption('2026-09-02');
    assert.equal(await page.locator('[name="opening"]').inputValue(),'');
    await page.locator('#closingBookDay').selectOption('2026-09-01');
    assert.equal(await page.locator('[name="opening"]').inputValue(),'500000');
    await page.locator('[name="opening"]').fill('-5');
    const saves=await page.evaluate(()=>saves);
    await page.locator('#closingBookForm button[type="submit"]').click();
    assert.equal(await page.evaluate(()=>saves),saves);
    await page.locator('#closingBookDay').selectOption('2026-09-02');
    assert.equal(await page.locator('#closingBookDay').inputValue(),'2026-09-01');
    await page.locator('[name="opening"]').fill('500000');
    await page.locator('#closingBookForm button[type="submit"]').click();
    await page.locator('#closingBookAddShift').click();
    await page.locator('[name="name"]').fill('Ca tối');
    await page.locator('#closingBookForm button[type="submit"]').click();
    assert.equal(await page.evaluate(()=>getActiveStore().closingMonths[0].days[0].shifts.length),2);
    await page.locator('#closingBookShift').selectOption('0');
    // Opening an old saved day merges both former groups without persisting until Save.
    await page.evaluate(()=>getActiveStore().closingMonths[0].days.push({date:'2026-09-03',updatedAt:new Date().toISOString(),shifts:[{
      opening:500000,cash:200000,ending:600000,cancelled:7,recheck:'Bill cũ đã hủy',
      income1:[{note:'Thu A',amount:100000}],income2:[{note:'Thu B',amount:200000}],
      expense1:[{note:'Chi A',amount:100000}],expense2:[{note:'Chi B',amount:200000}]
    }]}));
    await page.locator('#closingBookDay').selectOption('2026-09-03');
    assert.equal(await page.locator('[data-book-group]').count(),2);
    assert.equal(await page.locator('[name="cancelled"]').count(),0);
    assert.equal(await page.locator('[name="recheck"]').inputValue(),'Bill cũ đã hủy');
    assert.match(await page.locator('[name="recheck"]').locator('..').innerText(),/Các bill đã hủy/);
    for(const key of ['income','expense']) {
      assert.equal(await page.locator(`[data-book-note="${key}"]`).count(),2);
      assert.match(await page.locator(`[data-book-total="${key}"]`).innerText(),/300\.000/);
    }
    assert.equal(await page.evaluate(()=>getActiveStore().closingMonths[0].days[1].shifts[0].income),undefined);
    await page.locator('#closingBookForm button[type="submit"]').click();
    await page.locator('#closingBookDay').selectOption('2026-09-01');
    await page.locator('#closingBookDay').selectOption('2026-09-03');
    assert.equal(await page.locator('[data-book-note="income"]').count(),2);
    assert.equal(await page.evaluate(()=>getActiveStore().closingMonths[0].days.find(d=>d.date==='2026-09-03').shifts[0].cancelled),7);
    await page.evaluate(()=>document.activeElement.blur());
    for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(width=> {document.documentElement.classList.toggle('mobile-app-theme',width<700);closingBook.page.scrollTop=0;},width);
      const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('#closingBookPage input,#closingBookPage select,#closingBookPage textarea,#closingBookPage button,#closingBookPage strong')).filter(el=> {const r=el.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1;}).map(el=>el.id||el.name||el.className));
      assert.deepEqual(overflow,[],`${width}x${height}`);
      const overlaps=await page.evaluate(()=> {
        const controls=Array.from(document.querySelectorAll('#closingBookPage input,#closingBookPage select,#closingBookPage textarea,#closingBookPage button')).map(el=>({name:el.id||el.name||el.getAttribute('aria-label'),r:el.getBoundingClientRect()})).filter(item=>item.r.height>0);
        return controls.flatMap((a,i)=>controls.slice(i+1).filter(b=>Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>2&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>2).map(b=>[a.name,b.name]));
      });
      assert.deepEqual(overlaps,[],`Overlapping controls at ${width}x${height}`);
      assert.equal(await page.evaluate(()=>closingBook.page.scrollWidth<=closingBook.page.clientWidth),true);
      const incomeBounds=await page.locator('[data-book-group="income"]').boundingBox();
      const expenseBounds=await page.locator('[data-book-group="expense"]').boundingBox();
      if(width>800) assert.ok(incomeBounds.x<expenseBounds.x&&Math.abs(incomeBounds.y-expenseBounds.y)<1,'Thu left, Chi right');
      else assert.ok(incomeBounds.y<expenseBounds.y,'Thu above Chi on narrow screens');
      const buttonStyle=await page.locator('#closingBookCreateMonth button').evaluate(el=>({background:getComputedStyle(el).backgroundImage,color:getComputedStyle(el).color,variable:getComputedStyle(el).getPropertyValue('--accent-gradient')}));
      assert.notEqual(buttonStyle.background,'none',JSON.stringify(buttonStyle));
      if(process.env.INVENTORY_TEST_SHOTS&&[375,1440].includes(width)&&height===900) await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`closing-book-${width}.png`)});
      if(process.env.INVENTORY_TEST_SHOTS&&[375,1440].includes(width)&&height===900) {
        await page.locator('#closingBookEntries').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`closing-book-columns-${width}.png`)});
      }
    }
    await page.setViewportSize({width:375,height:400});
    await page.locator('[name="result"]').focus();
    await page.waitForTimeout(450);
    const focusBounds=await page.locator('[name="result"]').boundingBox();
    const navBounds=await page.locator('.closing-book-nav').boundingBox();
    assert.ok(focusBounds.y>=navBounds.y+navBounds.height-1&&focusBounds.y+focusBounds.height<=401,'Focused note remains visible above the keyboard');
    await page.evaluate(()=>{state.activeStoreId='b';refreshClosingBookAccess();});
    assert.equal(await page.locator('#closingBookPage').isVisible(),false);
    await page.evaluate(()=>openClosingBookPage());
    assert.equal(await page.locator('#closingBookEditor').isVisible(),false);
    await page.evaluate(()=>{admin=false;refreshClosingBookAccess();});
    assert.equal(await page.locator('#closingBookPage').isVisible(),false);
    assert.equal(await page.locator('#openClosingBookDesktop').isVisible(),false);
    assert.deepEqual(errors,[]);
    // Full production DOM/scripts, with all external services blocked and fake local data.
    const full=await browser.newPage(); const fullErrors=[];
    full.on('pageerror',error=>fullErrors.push(error.message));
    const serveFull=async route=> {
      const url=new URL(route.request().url());
      if(url.hostname!=='full.test') return route.abort();
      if(url.pathname==='/firebase-config.js') return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});
      const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)) return route.abort();
      const contentType=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'application/javascript; charset=utf-8':'application/octet-stream';
      return route.fulfill({contentType,body:fs.readFileSync(file)});
    };
    await full.route('**/*',serveFull);
    await full.goto('http://full.test/');
    await full.evaluate(()=> {
      state=normalizeState({activeStoreId:'test-store',stores:[{id:'test-store',name:'Cửa hàng kiểm thử',entries:[],categories:{income:[],expense:[]}}]});
      authState.role='admin';authState.ready=true;authState.profile={role:'admin',displayName:'Admin'};
      els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');
      activateTab('overview');render();
    });
    await full.locator('#openClosingBookDesktop').click();
    await full.locator('#closingBookNewMonth').fill('02/2024');
    await full.locator('#closingBookCreateMonth button').click();
    assert.equal(await full.locator('#closingBookDay option').count(),29);
    await full.locator('#closingBookDay').selectOption('2024-02-29');
    await full.locator('[name="opening"]').fill('123000');
    await full.locator('#closingBookForm button[type="submit"]').click();
    assert.equal(await full.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).stores[0].closingMonths[0].days[0].shifts[0].opening),123000);
    await full.reload();
    await full.evaluate(()=> {
      authState.role='admin';authState.ready=true;authState.profile={role:'admin',displayName:'Admin'};
      els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();
    });
    assert.equal(await full.locator('#closingBookPage').isVisible(),true);
    await full.locator('#closingBookDay').selectOption('2024-02-29');
    assert.equal(await full.locator('[name="opening"]').inputValue(),'123000');
    await full.evaluate(()=>hideClosingBookPage({force:true}));
    const desktopIcon=await full.locator('#openClosingBookDesktop svg').boundingBox();
    assert.ok(desktopIcon.width>=36&&desktopIcon.height>=36,'Detailed desktop book icon is not collapsed by the heading action-button style');
    if(process.env.INVENTORY_TEST_SHOTS) await full.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,'closing-book-overview-desktop.png')});
    await full.evaluate(()=>showLoginScreen());
    assert.equal(await full.locator('#closingBookPage').isVisible(),false);
    assert.deepEqual(fullErrors,[]);
    const mobile=await browser.newPage({userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',viewport:{width:375,height:900}});
    const mobileErrors=[];mobile.on('pageerror',error=>mobileErrors.push(error.message));
    await mobile.route('**/*',serveFull); await mobile.goto('http://full.test/');
    await mobile.evaluate(()=> {
      state=normalizeState({activeStoreId:'mobile',stores:[{id:'mobile',name:'Cửa hàng mobile',entries:[],categories:{income:[],expense:[]}}]});
      authState.role='admin';authState.ready=true;authState.profile={role:'admin',displayName:'Admin'};
      els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();
    });
    assert.equal(await mobile.locator('#openClosingBookMobile').isVisible(),true);
    if(process.env.INVENTORY_TEST_SHOTS) await mobile.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,'closing-book-overview-mobile.png')});
    await mobile.locator('#openClosingBookMobile').click();
    assert.equal(await mobile.locator('#closingBookPage').isVisible(),true);
    assert.equal(await mobile.evaluate(()=>isMobileTimeFilterSuppressed()),true);
    await mobile.evaluate(()=>hideClosingBookPage({force:true}));
    assert.equal(await mobile.evaluate(()=>isMobileTimeFilterSuppressed()),false);
    assert.deepEqual(mobileErrors,[]);
    console.log('Closing book saving, formulas, dates, draft guards, store separation, role guards and responsive layouts passed.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
