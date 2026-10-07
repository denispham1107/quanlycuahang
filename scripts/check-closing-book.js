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
    await page.addScriptTag({content:`let admin=true; let saves=0; let state={activeStoreId:'a',stores:[{id:'a',name:'Cửa hàng thử nghiệm',closingMonths:[],entries:[],categories:{income:[],expense:[]}},{id:'b',name:'Cửa hàng 2',closingMonths:[],entries:[],categories:{income:[],expense:[]}}]}; const els=Object.fromEntries(Array.from(document.querySelectorAll('[id]'),el=>[el.id,el])); function isAdminUser(){return admin;} function getActiveStore(){return state.stores.find(s=>s.id===state.activeStoreId);} function getActiveTabName(){return 'overview';} function updateTimeFiltersVisibility(){} function recordActivity(){} function saveAndRender(){saves++;window.refreshClosingBookAccess?.();} ${['formatCurrency','formatDate','formatActivityDateTime','escapeHtml','createId'].map(helper).join('\n')}`});
    await page.addScriptTag({content:'async function refreshEmployeeCashSuggestions(){return false;}\n'+['isCancelledEntry','formatAmountInput','getEntrySuggestions','matchEntrySuggestion','renderEntrySuggestionList'].map(helper).join('\n')});
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'closing-book-core.js'),'utf8')});
    await page.addScriptTag({content:`function isEmployeeUser(){return false;} function employeeCan(){return false;} for(const id of ['employeeOverviewAccess','employeeOverviewStoreName','openClosingBookEmployee']) {const el=document.createElement(id==='openClosingBookEmployee'?'button':'div');el.id=id;document.body.append(el);}`});
    await page.addScriptTag({content:fs.readFileSync(path.join(root,'closing-book.js'),'utf8')});
    await page.locator('#openClosingBookDesktop').click();
    assert.equal(await page.locator('#closingBookPage').isVisible(),true);
    await page.locator('#closingBookNewMonth').fill('09/2026');
    await page.locator('#closingBookCreateMonth button').click();
    assert.equal(await page.locator('#closingBookDay option').count(),30);
    for(const key of ['opening','pos','vcb','momo','zalop','cash','actualVcb','actualMomo','actualZalop','ending']) {
      const input=page.locator(`[name="${key}"]`);
      await input.fill('10000');assert.equal(await input.inputValue(),'10.000');
      assert.equal(await page.evaluate(key=>ClosingBookCore.parseMoney(closingBook.draft[key]),key),10000);
      await input.fill('');
    }
    const amount=page.locator('[name="opening"]');
    await amount.fill('123456');await amount.evaluate(el=>el.setSelectionRange(4,4));await amount.press('Backspace');
    assert.equal(await amount.inputValue(),'12.456');assert.equal(await amount.evaluate(el=>el.selectionStart),2);
    await amount.fill('123456');await amount.evaluate(el=>el.setSelectionRange(3,3));await amount.press('Delete');assert.equal(await amount.inputValue(),'12.356');
    await amount.fill('123456');await amount.evaluate(el=>el.setSelectionRange(1,1));await page.keyboard.insertText('9');assert.equal(await amount.inputValue(),'1.923.456');
    await amount.fill('123456');await amount.evaluate(el=>el.setSelectionRange(4,7));await page.keyboard.insertText('8');assert.equal(await amount.inputValue(),'1.238');
    await amount.fill('12.3');assert.equal(await amount.inputValue(),'12.3');assert.match(await page.locator('#closingBookMessage').innerText(),/Số tiền/);
    for(const type of ['income','expense']) {
      const input=page.locator(`[data-book-amount="${type}"]`);await input.fill('125000');assert.equal(await input.inputValue(),'125.000');await input.fill('');
    }
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
    assert.equal(await page.locator('[name="opening"]').inputValue(),'500.000');
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
      opening:500000,cash:200000,ending:600000,cancelled:7,recheck:'Bill cũ đã hủy',result:'Kết quả cũ',
      income1:[{note:'Thu A',amount:100000}],income2:[{note:'Thu B',amount:200000}],
      expense1:[{note:'Chi A',amount:100000}],expense2:[{note:'Chi B',amount:200000}]
    }]}));
    await page.locator('#closingBookDay').selectOption('2026-09-03');
    assert.equal(await page.locator('[data-book-group]').count(),2);
    assert.equal(await page.locator('[name="cancelled"]').count(),0);
    assert.equal(await page.locator('[name="recheck"]').inputValue(),'Bill cũ đã hủy');
    assert.equal(await page.locator('[name="result"]').inputValue(),'Kết quả cũ');
    assert.deepEqual(await page.locator('.closing-book-notes textarea').evaluateAll(els=>els.map(el=>el.name)),['recheck','result']);
    for(const [key,label] of Object.entries({vcb:'Bill VCB',momo:'Bill Momo',zalop:'Bill Zalop',cash:'Bill Tiền mặt'})) {
      assert.equal(await page.locator(`#closingBookFields [name="${key}"]`).locator('..').innerText(),label);
    }
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
    assert.equal(await page.locator('[name="recheck"]').inputValue(),'Bill cũ đã hủy');
    assert.equal(await page.locator('[name="result"]').inputValue(),'Kết quả cũ');
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
      const cancelledBounds=await page.locator('[name="recheck"]').boundingBox();
      const resultBounds=await page.locator('[name="result"]').boundingBox();
      if(width>520) assert.ok(cancelledBounds.x<resultBounds.x,'Cancelled bills before result on desktop');
      else assert.ok(cancelledBounds.y<resultBounds.y,'Cancelled bills above result on mobile');
      const buttonStyle=await page.locator('#closingBookCreateMonth button').evaluate(el=>({background:getComputedStyle(el).backgroundImage,color:getComputedStyle(el).color,variable:getComputedStyle(el).getPropertyValue('--accent-gradient')}));
      assert.notEqual(buttonStyle.background,'none',JSON.stringify(buttonStyle));
      const deleteStyle=await page.locator('#closingBookDeleteShift').evaluate(el=>({background:getComputedStyle(el).backgroundImage,color:getComputedStyle(el).color}));
      assert.equal(deleteStyle.background,'none','Delete uses a readable warning background, not the global gradient');
      assert.equal(deleteStyle.color,'rgb(172, 40, 81)');
      if(process.env.INVENTORY_TEST_SHOTS&&[375,1440].includes(width)&&height===900) await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`closing-book-${width}.png`)});
      if(process.env.INVENTORY_TEST_SHOTS&&[375,1440].includes(width)&&height===900) {
        await page.locator('#closingBookEntries').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`closing-book-columns-${width}.png`)});
        await page.locator('.closing-book-notes').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`closing-book-notes-${width}.png`)});
      }
    }
    await page.setViewportSize({width:375,height:400});
    await page.locator('[name="result"]').focus();
    await page.waitForTimeout(450);
    const focusBounds=await page.locator('[name="result"]').boundingBox();
    const navBounds=await page.locator('#closingBookMain .closing-book-nav').boundingBox();
    assert.ok(focusBounds.y>=navBounds.y+navBounds.height-1&&focusBounds.y+focusBounds.height<=401,'Focused note remains visible above the keyboard');
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>document.documentElement.classList.remove('mobile-app-theme'));
    for(const type of ['income','expense']) {
      await page.locator(`[data-book-details="${type}"]`).click();
      assert.equal(await page.locator('#closingBookDetailPage').isVisible(),true);
      assert.equal(await page.locator('#closingBookMain').isVisible(),false);
      assert.equal(await page.locator('.book-detail-row').count(),2);
      for(const selector of ['.book-detail-row-action > strong','.book-detail-time','.book-detail-number']) {
        await page.evaluate(()=>renderClosingBookDetails());
        await page.locator(selector).first().click();
        assert.equal(await page.locator('.book-detail-editor').first().isVisible(),true,`Click ${selector} opens ${type} classification`);
        await page.locator(selector).first().click();
        assert.equal(await page.locator('.book-detail-editor').first().isVisible(),true,'Repeated row clicks keep classification open');
      }
      await page.evaluate(()=>renderClosingBookDetails());
      await page.locator('.book-detail-row').first().click({position:{x:8,y:8}});
      assert.equal(await page.locator('.book-detail-editor').first().isVisible(),true,'Blank row padding opens classification');
      await page.evaluate(()=>renderClosingBookDetails());
      await page.locator('[data-detail-transfer]').first().click();
      assert.match(await page.locator('#closingBookDetailMessage').innerText(),/chọn Mục/);
      assert.equal(await page.locator('.book-detail-editor').first().isVisible(),false,'Transfer is not intercepted by the whole-row click');
      assert.equal(await page.evaluate(()=>getActiveStore().entries.length),type==='income'?0:1);
      await page.locator('[data-detail-edit]').first().click();
      await page.locator('[data-detail-new-name]').first().fill('Mục '+type);
      await page.locator('[data-detail-create]').first().click();
      assert.equal(await page.evaluate(type=>getActiveStore().categories[type].length,type),1);
      await page.locator('[data-detail-edit]').first().click();
      for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
        await page.setViewportSize({width,height});
        await page.evaluate(width=>document.documentElement.classList.toggle('mobile-app-theme',width<700),width);
        const bad=await page.locator('#closingBookDetailPage input,#closingBookDetailPage select,#closingBookDetailPage button,#closingBookDetailPage strong').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<-1||r.right>innerWidth+1);}).map(el=>el.outerHTML));
        assert.deepEqual(bad,[],`Details ${type} ${width}x${height}`);
        const overlap=await page.locator('#closingBookDetailPage input,#closingBookDetailPage select,#closingBookDetailPage button').evaluateAll(els=> {
          const boxes=els.map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
          return boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2));
        });
        assert.equal(overlap,false,`Details controls ${width}x${height}`);
        if(width===375&&height===400) {
          await page.locator('[data-detail-new-name]').first().focus();
          await page.waitForTimeout(450);
          const field=await page.locator('[data-detail-new-name]').first().boundingBox();
          const button=await page.locator('[data-detail-create]').first().boundingBox();
          const nav=await page.locator('#closingBookDetailPage .closing-book-nav').boundingBox();
          assert.ok(field.y>=nav.y+nav.height-1 && button.y+button.height<=401,'New category field and button remain visible with keyboard');
          await page.evaluate(()=>document.activeElement.blur());
        }
        if(process.env.INVENTORY_TEST_SHOTS&&[375,1440].includes(width)&&height===900) {await page.evaluate(()=>closingBook.page.scrollTop=0);await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`closing-book-details-${type}-${width}.png`)});}
      }
      const original=await page.evaluate(type=>({...closingBook.draft[type][0]}),type);
      await page.locator('[data-detail-transfer]').first().click();
      assert.equal(await page.locator('[data-detail-transfer]').first().isDisabled(),true);
      await page.locator('.book-detail-time').first().click();
      assert.equal(await page.locator('.book-detail-editor').first().isVisible(),true,'Transferred row can still display its category');
      assert.equal(await page.locator('[data-detail-category]').first().isDisabled(),true);
      const entry=await page.evaluate(type=>getActiveStore().entries.find(entry=>entry.type===type),type);
      assert.equal(entry.createdAt,original.createdAt);assert.equal(entry.date,'2026-09-03');assert.equal(entry.amount,original.amount);assert.equal(entry.note,original.note);
      await page.evaluate(type=>openClosingBookDetails(type,{fromHistory:true}),type);
      assert.equal(await page.locator('[data-detail-transfer]').first().isDisabled(),true);
      await page.locator('[data-detail-edit]').nth(1).click();
      await page.locator('[data-detail-category]').nth(1).selectOption(entry.categoryId);
      assert.equal(await page.evaluate(type=>closingBook.draft[type][1].categoryId,type),entry.categoryId);
      await page.locator('#closeClosingBookDetail').click();
      await page.waitForFunction(()=>closingBook.detailType===null);
      assert.equal(await page.locator('#closingBookMain').isVisible(),true);
      assert.equal(await page.locator(`[data-book-note="${type}"]`).first().getAttribute('readonly'),'');
    }
    await page.evaluate(()=> {
      const store=getActiveStore(), shift=ClosingBookCore.emptyShift();
      for(const type of ['income','expense']) shift[type]=[0,1,2,3].map(index=>({id:`batch-${type}-${index}`,note:`Khoản ${index+1}`,amount:index===3?0:50000,categoryId:index===2?'':store.categories[type][0].id,createdAt:'2026-09-04T03:12:34.000Z'}));
      store.closingMonths[0].days.push({date:'2026-09-04',updatedAt:'2026-09-04T04:00:00.000Z',shifts:[shift]});
    });
    await page.locator('#closingBookDay').selectOption('2026-09-04');
    for(const type of ['income','expense']) {
      await page.locator(`[data-book-details="${type}"]`).click();
      const before=await page.evaluate(()=>getActiveStore().entries.length);
      assert.equal(await page.locator('#closingBookTransferSelected').isDisabled(),true);
      await page.locator('[data-detail-select]').first().check();
      assert.equal(await page.locator('.book-detail-editor').first().isVisible(),false,'Selection does not open the category editor');
      assert.match(await page.locator('#closingBookSelectionCount').innerText(),/1 dòng/);
      assert.equal(await page.locator('#closingBookSelectAll').evaluate(el=>el.indeterminate),true);
      await page.locator('#closingBookSelectAll').check();
      assert.match(await page.locator('#closingBookSelectionCount').innerText(),/4 dòng/);
      await page.locator('#closingBookSelectAll').uncheck();
      assert.equal(await page.locator('#closingBookTransferSelected').isDisabled(),true);
      await page.locator('#closingBookSelectAll').check();
      for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
        await page.setViewportSize({width,height});
        await page.evaluate(width=>document.documentElement.classList.toggle('mobile-app-theme',width<700),width);
        const overflow=await page.locator('.book-bulk-toolbar input,.book-bulk-toolbar button,.book-bulk-toolbar span,[data-detail-select]').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}));
        assert.equal(overflow.length,0,`Batch selection ${width}x${height}`);
        if(process.env.INVENTORY_TEST_SHOTS&&[375,1440].includes(width)&&height===900) {await page.evaluate(()=>closingBook.page.scrollTop=0);await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`closing-book-batch-${type}-${width}.png`)});}
      }
      // A rejected commit must create no entries and must leave row transfer markers untouched.
      await page.evaluate(()=>state.batchTestPadding='x'.repeat(900000));
      await page.locator('#closingBookTransferSelected').click();
      assert.equal(await page.evaluate(()=>getActiveStore().entries.length),before);
      assert.equal(await page.evaluate(()=>closingBook.draft[closingBook.detailType].some(row=>row.transferredEntryId)),false);
      await page.evaluate(()=>delete state.batchTestPadding);
      await page.locator('#closingBookTransferSelected').click();
      assert.equal(await page.evaluate(()=>getActiveStore().entries.length),before+2);
      assert.match(await page.locator('#closingBookDetailMessage').innerText(),/Đã chuyển 2 khoản/);
      assert.match(await page.locator('#closingBookDetailMessage').innerText(),/Giữ lại 2 dòng/);
      assert.match(await page.locator('#closingBookSelectionCount').innerText(),/2 dòng/);
      assert.equal(await page.locator('[data-detail-select]').first().isDisabled(),true);
      const created=await page.evaluate(type=>getActiveStore().entries.filter(entry=>entry.closingBookRowId?.startsWith('batch-'+type)),type);
      assert.ok(created.every(entry=>entry.date==='2026-09-04'&&entry.createdAt==='2026-09-04T03:12:34.000Z'));
      await page.locator('#closingBookTransferSelected').click();
      assert.equal(await page.evaluate(()=>getActiveStore().entries.length),before+2,'Repeated batch action cannot duplicate entries');
      await page.locator('.book-detail-time').nth(2).click();
      const categoryId=await page.evaluate(type=>getActiveStore().categories[type][0].id,type);
      await page.locator('[data-detail-category]').nth(2).selectOption(categoryId);
      assert.match(await page.locator('#closingBookSelectionCount').innerText(),/2 dòng/,'Selection survives category assignment');
      await page.locator('#closingBookTransferSelected').click();
      assert.equal(await page.evaluate(()=>getActiveStore().entries.length),before+3);
      assert.match(await page.locator('#closingBookSelectionCount').innerText(),/1 dòng/);
      await page.locator('#closeClosingBookDetail').click();
      await page.waitForFunction(()=>closingBook.detailType===null);
    }
    // Cascading deletion: cancel, Firebase unavailable/failure/retry, and final shift.
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=> {
      window.cloudStore={enabled:true,docRef:{}};
      window.saveStateToCloud=async()=>true;
      saveAndRender=()=>{saves++;refreshClosingBookAccess();return window.saveStateToCloud();};
      getActiveStore().entries.push({id:'manual-delete-test',type:'expense',date:closingBook.dayKey,note:'Nhập trực tiếp',amount:1000});
    });
    const beforeDelete=await page.evaluate(()=>JSON.stringify(getActiveStore()));
    await page.evaluate(()=>getActiveStore().closingMonths[0].days.find(d=>d.date===closingBook.dayKey).shifts[0].name='Sửa từ thiết bị khác');
    await page.locator('#closingBookDeleteShift').click();
    assert.match(await page.locator('#closingBookMessage').innerText(),/đã thay đổi trên cloud/);
    await page.evaluate(()=>getActiveStore().closingMonths[0].days.find(d=>d.date===closingBook.dayKey).shifts[0].name='');
    await page.locator('#closingBookDeleteShift').click();
    assert.equal(await page.evaluate(()=>JSON.stringify(getActiveStore())),beforeDelete,'Cancel never changes data');
    await page.evaluate(()=>cloudStore.enabled=false);
    await page.locator('#closingBookDeleteShift').click();
    assert.match(await page.locator('#closingBookMessage').innerText(),/kết nối Firebase/);
    assert.equal(await page.evaluate(()=>JSON.stringify(getActiveStore())),beforeDelete);
    await page.evaluate(()=>{cloudStore.enabled=true;saveStateToCloud=async()=>false;});
    page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());
    const otherStore=await page.evaluate(()=>JSON.stringify(state.stores[1]));
    await page.locator('#closingBookDeleteShift').click();
    await page.waitForFunction(()=>!closingBook.saving);
    assert.match(await page.locator('#closingBookMessage').innerText(),/Chưa xác nhận/);
    assert.equal(await page.locator('#closingBookRetryDelete').isVisible(),true);
    assert.equal(await page.evaluate(()=>getActiveStore().entries.filter(e=>e.date==='2026-09-04').length),1,'Only the unrelated manual entry remains');
    assert.equal(await page.evaluate(()=>getActiveStore().closingMonths[0].days.some(d=>d.date==='2026-09-04')),false,'Deleting last shift removes saved day');
    assert.equal(await page.evaluate(()=>JSON.stringify(state.stores[1])),otherStore);
    await page.evaluate(()=>saveStateToCloud=async()=>true);
    await page.locator('#closingBookRetryDelete').click();
    await page.waitForFunction(()=>document.querySelector('#closingBookMain').inert===false);
    assert.match(await page.locator('#closingBookMessage').innerText(),/thiết bị và Firebase/);
    assert.equal(await page.locator('#closingBookRetryDelete').isVisible(),false);
    assert.equal(await page.locator('#closingBookShift option').count(),1,'A fresh empty draft remains usable');
    await page.locator('#closingBookDay').selectOption('2026-09-01');
    await page.locator('#closingBookShift').selectOption('0');
    await page.locator('#closingBookDeleteShift').click();
    await page.waitForFunction(()=>!closingBook.saving);
    assert.equal(await page.evaluate(()=>getActiveStore().closingMonths[0].days.find(d=>d.date==='2026-09-01').shifts.length),1);
    assert.equal(await page.locator('[name="name"]').inputValue(),'Ca tối');
    page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.dismiss());
    await page.evaluate(()=>{state.activeStoreId='b';refreshClosingBookAccess();});
    assert.equal(await page.locator('#closingBookPage').isVisible(),false);
    await page.evaluate(()=>openClosingBookPage());
    assert.equal(await page.locator('#closingBookEditor').isVisible(),false);
    await page.locator('#closingBookNewMonth').fill('10/2026');
    await page.locator('#closingBookCreateMonth button').click();
    await page.locator('[data-book-details="income"]').click();
    assert.equal(await page.locator('.book-detail-empty').isVisible(),true);
    assert.equal(await page.evaluate(()=>getActiveStore().entries.length),0);
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
    assert.equal(await full.locator('[name="opening"]').inputValue(),'123.000');
    await full.locator('[data-book-add="expense"]').click();
    await full.locator('[data-book-note="expense"]').fill('Khoản chuyển thực tế');
    await full.locator('[data-book-amount="expense"]').fill('45000');
    await full.locator('[data-book-details="expense"]').click();
    await full.locator('[data-detail-edit]').click();
    await full.locator('[data-detail-new-name]').fill('Sinh hoạt');
    await full.locator('[data-detail-create]').click();
    const sourceTime=await full.evaluate(()=>closingBook.draft.expense[0].createdAt);
    await full.locator('[data-detail-select]').check();
    await full.locator('#closingBookTransferSelected').click();
    const cached=await full.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).stores[0]);
    assert.equal(cached.entries.length,1);assert.equal(cached.entries[0].date,'2024-02-29');assert.equal(cached.entries[0].createdAt,sourceTime);assert.equal(cached.entries[0].categoryId,cached.categories.expense[0].id);
    assert.equal(cached.closingMonths[0].days[0].shifts[0].expense[0].transferredEntryId,cached.entries[0].id);
    await full.reload();
    await full.evaluate(()=> {
      authState.role='admin';authState.ready=true;authState.profile={role:'admin',displayName:'Admin'};
      els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();
    });
    assert.equal(await full.locator('#closingBookDetailPage').isVisible(),true);
    assert.equal(await full.locator('[data-detail-transfer]').isDisabled(),true);
    assert.equal(await full.evaluate(()=>getActiveStore().entries.length),1);
    await full.locator('#closeClosingBookDetail').click();
    await full.waitForFunction(()=>closingBook.detailType===null);
    await full.evaluate(()=> {
      window.firestoreWrites=[];
      window.firebase={firestore:{FieldValue:{serverTimestamp:()=> 'mock-server-time'}}};
      cloudStore.enabled=true;
      cloudStore.docRef={set:async payload=>firestoreWrites.push(JSON.parse(JSON.stringify(payload)))};
    });
    full.on('dialog',dialog=>dialog.accept());
    await full.locator('#closingBookDeleteShift').click();
    await full.waitForFunction(()=>!closingBook.saving);
    const deleted=await full.evaluate(()=>({cached:JSON.parse(localStorage.getItem(STORAGE_KEY)).stores[0],remote:firestoreWrites.at(-1).state.stores[0]}));
    for(const store of [deleted.cached,deleted.remote]) {assert.equal(store.entries.length,0);assert.equal(store.closingMonths[0].days.length,0);}
    assert.match(await full.locator('#closingBookMessage').innerText(),/thiết bị và Firebase/);
    await full.reload();
    await full.evaluate(()=> {
      authState.role='admin';authState.ready=true;authState.profile={role:'admin',displayName:'Admin'};
      els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();
    });
    assert.equal(await full.evaluate(()=>getActiveStore().entries.length),0,'Deleted entries do not reappear after cache reload');
    assert.equal(await full.evaluate(()=>getActiveStore().closingMonths[0].days.length),0);
    await full.evaluate(()=>hideClosingBookPage({force:true}));
    const desktopIcon=await full.locator('#openClosingBookDesktop svg').boundingBox();
    assert.ok(desktopIcon.width>=36&&desktopIcon.height>=36,'Detailed desktop book icon is not collapsed by the heading action-button style');
    if(process.env.INVENTORY_TEST_SHOTS) await full.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,'closing-book-overview-desktop.png')});
    await full.evaluate(()=>showLoginScreen());
    assert.equal(await full.locator('#closingBookPage').isVisible(),false);
    assert.deepEqual(fullErrors,[]);
    // Staff uses real frontend permission/mutation flow with an isolated server fixture.
    const {applyClosingBookMutation}=require('../functions/closing-book-mutation');
    const employee=await browser.newPage({viewport:{width:375,height:900}});
    const employeeErrors=[];employee.on('pageerror',error=>employeeErrors.push(error.message));
    employee.on('dialog',dialog=>dialog.accept());
    let serverStore={id:'staff-store',name:'Cửa hàng được gán cho nhân viên · Tên dài để kiểm tra',closingMonths:[],categories:{income:[],expense:[]},entries:[{id:'direct-entry',type:'expense',note:'Nhập trực tiếp',amount:999}],activityHistory:[]};
    const staffUser={uid:'staff-test',profile:{role:'employee',active:true,storeId:'staff-store',displayName:'Nhân viên thử',permissions:{closingBook:{manage:true}}}};
    await employee.exposeFunction('testStaffMutation',async(name,mutation)=> {
      if (name==='saveMutationUrl') applyClosingBookMutation(serverStore,mutation,staffUser,()=> 'log-'+Date.now());
      return {profile:JSON.parse(JSON.stringify(staffUser.profile)),state:{activeStoreId:serverStore.id,stores:[{...JSON.parse(JSON.stringify(serverStore)),entries:serverStore.entries.filter(entry=>entry.closingBookRowId)}]}};
    });
    await employee.route('**/*',serveFull);await employee.goto('http://full.test/');
    await employee.evaluate(async()=> {
      authState.role='employee';authState.ready=true;authState.user={uid:'staff-test'};authState.profile={role:'employee',active:true,storeId:'staff-store',displayName:'Nhân viên thử',permissions:{closingBook:{manage:true}}};
      callEmployeeFunction=(name,body={})=>testStaffMutation(name,body.mutation);
      cloudStore.enabled=true;cloudStore.docRef={set:()=>{throw new Error('Employee must never write shared state directly');}};
      state=normalizeState((await callEmployeeFunction('getStateUrl')).state);
      els.authScreen.hidden=true;els.appShell.hidden=false;document.body.classList.remove('auth-pending');activateTab('overview');render();
    });
    for(const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
      await employee.setViewportSize({width,height});
      await employee.evaluate(width=>document.documentElement.classList.toggle('mobile-app-theme',width<700),width);
      assert.equal(await employee.locator('#employeeOverviewAccess').isVisible(),true);
      assert.match(await employee.locator('#employeeOverviewStoreName').innerText(),/Cửa hàng được gán/);
      assert.equal(await employee.locator('#openClosingBookEmployee').isVisible(),true);
      assert.equal(await employee.locator('.overview-charts').isVisible(),false,'Permission does not grant unrelated overview data');
      const controls=await employee.locator('#employeeOverviewAccess h2,#openClosingBookEmployee').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));
      assert.ok(controls.every(r=>r.left>=0&&r.right<=width),`Staff overview fits ${width}`);
      if(process.env.INVENTORY_TEST_SHOTS&&[375,1440].includes(width)&&height===900) await employee.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`closing-book-staff-overview-${width}.png`)});
    }
    await employee.locator('#openClosingBookEmployee').click();
    await employee.locator('#closingBookNewMonth').fill('09/2026');await employee.locator('#closingBookCreateMonth button').click();
    await employee.waitForFunction(()=>!closingBook.page.inert);
    for(const type of ['income','expense']) {
      await employee.locator(`[data-book-note="${type}"]`).fill('Khoản '+type+' từ nhân viên');
      await employee.locator(`[data-book-amount="${type}"]`).fill(type==='income'?'150000':'25000');
    }
    await employee.locator('#closingBookForm button[type="submit"]').click();await employee.waitForFunction(()=>!closingBook.page.inert);
    for(const type of ['income','expense']) {
      await employee.locator(`[data-book-details="${type}"]`).click();await employee.waitForFunction(()=>!closingBook.page.inert);
      await employee.locator('[data-detail-edit]').click();await employee.locator('[data-detail-new-name]').fill('Mục '+type);
      await employee.locator('[data-detail-create]').click();await employee.waitForFunction(()=>!closingBook.page.inert);
      await employee.locator('[data-detail-select]').check();await employee.locator('#closingBookTransferSelected').click();await employee.waitForFunction(()=>!closingBook.page.inert);
      assert.equal(serverStore.entries.filter(entry=>entry.type===type&&entry.closingBookRowId).length,1);
      await employee.locator('#closeClosingBookDetail').click();await employee.waitForFunction(()=>closingBook.detailType===null);
    }
    await employee.locator('#closingBookDeleteShift').click();await employee.waitForFunction(()=>!closingBook.saving&&!closingBook.page.inert);
    assert.equal(serverStore.entries.length,1);assert.equal(serverStore.entries[0].id,'direct-entry');assert.equal(serverStore.closingMonths[0].days.length,0);
    const serverBeforeDenied=JSON.stringify(serverStore);
    staffUser.profile.permissions.closingBook.manage=false;
    await employee.locator('#closingBookNewMonth').fill('10/2026');await employee.locator('#closingBookCreateMonth button').click();
    await employee.waitForFunction(()=>!closingBook.page.inert);
    assert.equal(JSON.stringify(serverStore),serverBeforeDenied,'Server revocation prevents stale browser credentials from writing');
    assert.equal(await employee.evaluate(()=>authState.profile.permissions.closingBook.manage),false,'Refresh picks up current permission');
    await employee.evaluate(()=>{authState.profile.permissions.closingBook.manage=false;refreshClosingBookAccess();});
    assert.equal(await employee.locator('#closingBookPage').isVisible(),false,'Revocation closes the book immediately');
    await employee.evaluate(()=>{activateTab('overview');render();});
    await employee.locator('#openClosingBookEmployee').click();assert.equal(await employee.locator('#closingBookPage').isVisible(),false,'No access after revocation');
    assert.deepEqual(employeeErrors,[]);
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
