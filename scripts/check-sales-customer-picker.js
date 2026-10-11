const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
async function main() {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ headless: true, args: ['--disable-features=OverlayScrollbar,OverlayScrollbars'], ...(process.env.BULK_TEST_CHROME ? { executablePath: process.env.BULK_TEST_CHROME } : {}) });
  try {
    for (const [width, height, platform = 'ios'] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900],[375,900,'android']]) {
      const page = await browser.newPage({ viewport: { width, height }, ...(width < 700 ? { userAgent: platform === 'android' ? 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36' : 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}) });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url()); if (url.hostname !== 'picker.test') return route.abort();
        if (url.pathname === '/firebase-config.js') return route.fulfill({ contentType: 'application/javascript', body: 'window.firebaseAppConfig={};' });
        const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
        return route.fulfill({ contentType: file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', body: fs.readFileSync(file) });
      });
      await page.goto('http://picker.test/');
      await page.evaluate(() => {
        state = normalizeState({ activeStoreId: 'a', stores: [{ id:'a', name:'Thử nghiệm', categories:{income:[],expense:[]}, customers: Array.from({length:40}, (_,i) => ({id:'c'+i, name:i === 0 ? 'Nguyễn Hồng' : 'Khách <An> ' + 'TênDài'.repeat(6) + i, phone:'09012345'+String(i).padStart(2,'0'), memberTier:i % 2 ? 'Vip' : 'Thường', createdAt:'2026-10-11T10:00:00Z'})) }] });
        authState.role='admin'; authState.ready=true; authState.profile={role:'admin'}; authState.user={uid:'admin'}; cloudStore.enabled=false;
        els.authScreen.hidden=true; els.appShell.hidden=false; document.body.classList.remove('auth-pending'); activateTab('sales'); render(); openSalesOrderModal(getActiveStore());
        els.salesCustomerName.value='Đang soạn'; els.salesCustomerPhone.value='0999';
        els.salesItems.innerHTML=''; addSalesItemRow({name:'Sản phẩm đang soạn',price:150000,quantity:3,discountAmount:5000});
        uiState.salesOrderDiscountPercent=5; uiState.salesDraftId='draft-test';
        window.__draftSnapshot=() => JSON.stringify({items:getSalesOrderItems(),date:els.salesOrderDate.value,discount:uiState.salesOrderDiscountPercent,draft:uiState.salesDraftId});
        window.__stateBefore=JSON.stringify(state); window.__draftBefore=window.__draftSnapshot();
      });
      await page.locator('#openSalesCustomerCatalog').click();
      const modal = page.locator('#salesCustomerCatalogModal'), body = page.locator('#salesCustomerPickerBody');
      assert.equal(await page.locator('[data-select-sales-customer]').count(),40);
      const search = page.locator('#salesCustomerCatalogSearch'); const b = await search.boundingBox();
      assert.ok(b.width >= (width > 700 ? 330 : 180), `search usable at ${width}: ${b.width}`);
      for (const node of await modal.locator('.sales-customer-picker-card, header, input, select, button').all()) {
        const rect = await node.boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, 'no horizontal overflow');
        assert.ok(await node.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'text wraps within controls');
      }
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden');
      assert.equal(await page.evaluate(() => getComputedStyle(els.quickEntryModal).overflowY), 'hidden');
      const owners = await modal.evaluate(el => [el,...el.querySelectorAll('*')].filter(n => ['auto','scroll'].includes(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 2).map(n => n.id));
      assert.deepEqual(owners,['salesCustomerPickerBody']);
      const shell = await modal.locator('section').boundingBox(), region = await body.boundingBox();
      assert.ok(region.x >= shell.x + 12 && region.x + region.width <= shell.x + shell.width - 12, 'scrollbar inset');
      for (const selector of ['header','#closeSalesCustomerCatalog']) { const rect=await modal.locator(selector).boundingBox(); assert.ok(rect.y >= shell.y && rect.y + rect.height <= shell.y + shell.height + 1, 'fixed header/footer visible'); }
      await page.mouse.move(region.x + region.width/2, region.y + region.height/2); await page.mouse.wheel(0,400);
      await page.waitForFunction(() => document.getElementById('salesCustomerPickerBody').scrollTop > 0);
      await body.evaluate(el => el.scrollTop=0);
      await search.fill('nguyen hong'); assert.equal(await page.locator('[data-select-sales-customer]').count(),1);
      await search.fill('0901234501'); assert.equal(await page.locator('[data-select-sales-customer]').count(),1);
      await search.fill('not found'); assert.equal(await page.locator('[data-select-sales-customer]').count(),0);
      await search.fill(''); await page.locator('#salesCustomerCatalogFilter').selectOption('tier:vip'); assert.equal(await page.locator('[data-select-sales-customer]').count(),20);
      await page.locator('#salesCustomerCatalogFilter').selectOption('all');
      if (process.env.CUSTOMER_TEST_SHOTS && [375,1440].includes(width) && height === 900) await page.screenshot({path:path.join(process.env.CUSTOMER_TEST_SHOTS,`customer-picker-${platform}-${width}.png`)});
      await search.fill('nguyen hong'); await page.locator('[data-select-sales-customer="c0"]').click();
      assert.equal(await modal.isVisible(),false); assert.equal(await page.locator('#salesCustomerName').inputValue(),'Nguyễn Hồng');
      assert.equal(await page.locator('#salesCustomerPhone').inputValue(),'0901234500');
      assert.equal(await page.evaluate(() => JSON.stringify(state)), await page.evaluate(() => window.__stateBefore),'selection never saves data');
      assert.equal(await page.evaluate(() => window.__draftSnapshot()), await page.evaluate(() => window.__draftBefore),'sales items, date, discount and draft retained');
      await page.evaluate(() => openSalesCustomerCatalogModal());
      await search.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.id),'closeSalesCustomerCatalog');
      await page.locator('#closeSalesCustomerCatalog').press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id),'salesCustomerCatalogSearch');
      await search.press('Escape'); assert.equal(await modal.isVisible(),false);
      assert.deepEqual(errors,[]); await page.close(); console.log(`Picker ${platform} ${width}x${height}: layout, scroll, search/filter and selection OK`);
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
