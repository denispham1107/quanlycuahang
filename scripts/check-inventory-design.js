const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function main() {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const functionSource = name => {
    const start = app.indexOf(`function ${name}(`);
    const end = app.indexOf('\nfunction ', start + 1);
    assert.ok(start >= 0 && end > start);
    return app.slice(start, end);
  };
  const start = html.indexOf('<div class="modal-backdrop inventory-backdrop"');
  const end = html.indexOf('<div class="modal-backdrop inventory-history-backdrop"', start);
  const browser = await chromium.launch({ headless: true,
    ...(process.env.BULK_TEST_CHROME ? { executablePath: process.env.BULK_TEST_CHROME } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>${css}</style><span id="inventoryCount" hidden></span>${html.slice(start, end)}`);
    const clickStart = app.indexOf('els.inventoryList.addEventListener("click",');
    const clickEnd = app.indexOf('els.cancelEditInventory.addEventListener', clickStart);
    await page.addScriptTag({ content: `
      const els = Object.fromEntries(Array.from(document.querySelectorAll('[id]'), el => [el.id, el]));
      const uiState = { inventorySearch: '', inventoryFilter: 'all' };
      const today = '2026-10-07';
      let employee = false;
      let inventoryExportAllowed = false;
      const actions = [];
      function isEmployeeUser() { return employee; }
      function employeeCan(area, action) { return area === 'purchase' && (action === 'inventoryView' || (action === 'inventoryExport' && inventoryExportAllowed)); }
      function openExportInventoryModal(id) { actions.push(['export', id]); }
      function openEditInventoryModal(id) { actions.push(['edit', id]); }
      ${['renderInventory', 'normalizeSearchText', 'formatCurrency', 'formatDate', 'getInventorySalePrice', 'escapeHtml'].map(functionSource).join('\n')}
      ${app.slice(clickStart, clickEnd)}
      const store = { inventory: [
        {id:'cat', name:'Cát nhật', groupName:'Cát vệ sinh', quantity:5, lastPrice:44000, salePrice:58000, totalCost:88000, updatedAt:today},
        {id:'spa', name:'Tắm VS 3kg', groupName:'Spa', quantity:0, lastPrice:150000, salePrice:150000, totalCost:0, updatedAt:today}
      ] };
      els.inventoryModal.hidden = false;
      renderInventory(store);
    ` });
    assert.equal(await page.locator('[data-edit-inventory]').count(), 2);
    assert.equal(await page.locator('[data-export-inventory="spa"]').isDisabled(), true);
    assert.match(await page.locator('#inventorySummary').innerText(), /88\.000/);
    await page.locator('[data-export-inventory="cat"]').click();
    await page.locator('[data-edit-inventory="cat"] .inventory-main').click();
    assert.deepEqual(await page.evaluate(() => actions), [['export','cat'], ['edit','cat']]);
    await page.evaluate(() => { uiState.inventorySearch = 'tam'; renderInventory(store); });
    assert.equal(await page.locator('.inventory-item').count(), 1);
    await page.evaluate(() => { uiState.inventorySearch = ''; uiState.inventoryFilter = 'out-of-stock'; renderInventory(store); });
    assert.equal(await page.locator('.inventory-item').count(), 1);
    await page.evaluate(() => { uiState.inventoryFilter = 'group:cat ve sinh'; renderInventory(store); });
    assert.equal(await page.locator('.inventory-item').count(), 1);
    await page.evaluate(() => { uiState.inventoryFilter = 'all'; employee = true; renderInventory(store); });
    assert.equal(await page.locator('[data-edit-inventory], [data-export-inventory]').count(), 0);
    await page.evaluate(() => { inventoryExportAllowed = true; renderInventory(store); });
    assert.equal(await page.locator('[data-edit-inventory]').count(), 0);
    assert.equal(await page.locator('[data-export-inventory]').count(), 2);
    await page.locator('[data-export-inventory="cat"]').click();
    assert.deepEqual(await page.evaluate(() => actions.at(-1)), ['export', 'cat']);
    await page.evaluate(() => { employee = false; renderInventory({inventory:[]}); });
    assert.equal(await page.locator('#inventoryList .empty-list').count(), 1);
    await page.evaluate(() => { renderInventory(store); });
    for (const [width,height] of [[320,700],[375,900],[430,900],[667,375],[375,400],[800,900],[1024,900],[1440,900]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(width => {
        document.documentElement.classList.toggle('mobile-app-theme',width<700);
        els.inventoryModal.scrollTop = 0;
      },width);
      const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('#inventoryModal input, #inventoryModal select, #inventoryModal button, #inventoryModal .inventory-item, #inventoryModal .inventory-meta strong')).filter(el=> {
        const r = el.getBoundingClientRect();
        return r.left < -1 || r.right > innerWidth+1;
      }).map(el=>el.id || el.className));
      assert.deepEqual(overflow, [], `${width}x${height}`);
      if(process.env.INVENTORY_TEST_SHOTS && [375,1440].includes(width) && height===900) {
        await page.screenshot({path:path.join(process.env.INVENTORY_TEST_SHOTS,`inventory-${width}.png`)});
      }
    }
    await page.evaluate(() => { store.inventory[0].name = 'Tên hàng rất dài '.repeat(12); store.inventory[0].groupName = 'Nhóm hàng dài '.repeat(10); store.inventory[0].totalCost = 9999999999999; renderInventory(store); });
    await page.setViewportSize({width:320,height:700});
    assert.equal(await page.evaluate(() => els.inventoryModal.scrollWidth <= els.inventoryModal.clientWidth), true);
    assert.deepEqual(errors, []);
    console.log('Inventory filters, values, permissions, export/edit actions, empty state and responsive layouts passed.');
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
