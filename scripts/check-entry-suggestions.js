const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function main() {
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,...(process.env.BULK_TEST_CHROME?{executablePath:process.env.BULK_TEST_CHROME}:{})});
  try {
    for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
      const page=await browser.newPage({viewport:{width,height},...(width<700?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=> {
        const url=new URL(route.request().url());if(url.hostname!=='suggestions.test')return route.abort();
        if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.firebaseAppConfig={};'});
        const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
        return route.fulfill({contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8',body:fs.readFileSync(file)});
      });
      await page.goto('http://suggestions.test/');
      await page.evaluate(()=> {
        const entries=['income','expense'].flatMap((type,index)=>[
          {id:type+'old',type,note:'Khoản quen thuộc',amount:10000,categoryId:type+'2',date:'2026-09-01',createdAt:'2026-09-01T00:00:00Z'},
          {id:type+'new',type,note:'Khoản quen thuộc',amount:index?300000:200000,categoryId:type+'1',date:'2026-10-01',createdAt:'2026-10-01T00:00:00Z'},
          {id:type+'cancel',type,note:'Khoản quen thuộc',amount:999999,categoryId:type+'2',date:'2026-10-02',createdAt:'2026-10-02T00:00:00Z',status:'cancelled'}]);
        const categories=Object.fromEntries(['income','expense'].map(type=>[type,[{id:type+'1',name:'Mục gần nhất · '+type},{id:type+'2',name:'Mục khác · '+type}]]));
        state=normalizeState({activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng thử',entries,categories}]});
        authState.role='admin';authState.ready=true;authState.profile={role:'admin'};
        els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');render();
      });
      for(const type of ['income','expense']) {
        const expected=type==='income'?'200.000':'300.000';
        await page.evaluate(type=>{activateTab(type);const form=document.querySelector(`.entry-form[data-type="${type}"]`);const note=form.querySelector('[name="note"]');note.value='Khoản quen thuộc';note.dispatchEvent(new Event('input',{bubbles:true}));},type);
        const form=page.locator(`.entry-form[data-type="${type}"]`);
        assert.equal(await form.locator('[name="amount"]').inputValue(),expected);
        assert.equal(await form.locator('[name="categoryId"]').inputValue(),type+'1');
        await page.evaluate(type=>openQuickEntryModal(type),type);
        await page.locator('#quickEntryNote').fill('Khoản quen thuộc');
        assert.equal(await page.locator('#quickEntryAmount').inputValue(),expected);
        assert.equal(await page.locator('#quickEntryCategory').inputValue(),type+'1');
        await page.locator('#quickEntryCategory').selectOption(type+'2');
        await page.locator('#quickEntryAmount').fill('12345');
        assert.equal(await page.locator('#quickEntryCategory').inputValue(),type+'2');
        await page.evaluate(()=>closeQuickEntryModal());
      }
      await page.evaluate(()=>{activateTab('overview');openClosingBookPage();});
      await page.locator('#closingBookNewMonth').fill('09/2026');await page.locator('#closingBookCreateMonth button').click();
      for(const type of ['income','expense']) {
        const expected=type==='income'?'200.000':'300.000';
        await page.locator(`[data-book-note="${type}"]`).fill('Khoản quen');
        const suggested=page.locator(`[data-book-group="${type}"] [data-book-suggestion]`).first();
        assert.equal(await suggested.isVisible(),true,'Partial names show an explicit suggestion list');
        await suggested.click();
        assert.equal(await page.locator(`[data-book-note="${type}"]`).inputValue(),'Khoản quen thuộc');
        assert.equal(await page.locator(`[data-book-amount="${type}"]`).inputValue(),expected);
        assert.equal(await page.locator(`[data-book-category="${type}"]`).inputValue(),type+'1');
        assert.equal(await page.locator(`[data-book-category="${type}"] option`).count(),3);
        await page.locator(`[data-book-category="${type}"]`).selectOption(type+'2');
        await page.locator(`[data-book-amount="${type}"]`).fill('12345');
        assert.equal(await page.locator(`[data-book-category="${type}"]`).inputValue(),type+'2');
      }
      const boxes=await page.locator('.closing-book-row input,.closing-book-row select,.closing-book-row button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));
      assert.ok(boxes.every(r=>r.left>=-1&&r.right<=width+1),`Bounded controls ${width}x${height}`);
      assert.equal(boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)),false,'Controls do not overlap');
      if(width===375&&height===400) {
        await page.locator('[data-book-note="expense"]').focus();await page.waitForTimeout(450);
        const input=await page.locator('[data-book-note="expense"]').boundingBox();assert.ok(input.y>=0&&input.y+input.height<=height+1,'Focused field remains visible');
      }
      if(process.env.INVENTORY_TEST_SHOTS&&[375,1440].includes(width)&&height===900) {
        await page.locator('#closingBookEntries').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`closing-book-category-suggestions-${width}.png`)});
      }
      await page.locator('#closingBookForm button[type="submit"]').click();
      const saved=await page.evaluate(()=>getActiveStore().closingMonths[0].days[0].shifts[0]);
      for(const type of ['income','expense']) {assert.equal(saved[type][0].categoryId,type+'2');assert.equal(saved[type][0].amount,12345);}
      // Reopening the day keeps manual values; opening details sees the same classification.
      await page.evaluate(()=>loadClosingBookDay());
      assert.equal(await page.locator('[data-book-category="expense"]').inputValue(),'expense2');
      await page.locator('[data-book-details="expense"]').click();
      assert.match(await page.locator('[data-detail-edit]').first().innerText(),/Mục khác/);
      await page.locator('[data-detail-transfer]').first().click();
      await page.locator('#closeClosingBookDetail').click();
      assert.equal(await page.locator('[data-book-category="expense"]').isDisabled(),true);
      assert.equal(await page.locator('[data-book-note="expense"]').getAttribute('readonly'),'');
      assert.deepEqual(errors,[]);await page.close();console.log(`Amount/category suggestions and book classification ${width}x${height}: OK`);
    }
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
