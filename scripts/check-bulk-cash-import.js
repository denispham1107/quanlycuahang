const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const root = path.join(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const pageStart = html.indexOf('<main class="bulk-cash-page"');
  const pageMarkup = html.slice(pageStart, html.indexOf('</main>', pageStart) + 7);
  const start = app.indexOf("function parseBulkCashColumns(line) {");
  const end = app.indexOf("function applyQuickEntrySuggestion() {", start);
  const datesStart = app.indexOf("function parseDateInput(value) {");
  const datesEnd = app.indexOf("function escapeHtml(value) {", datesStart);
  assert.ok(start >= 0 && end > start);
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BULK_TEST_CHROME ? { executablePath: process.env.BULK_TEST_CHROME } : {})
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent(`<style>${css}</style><section id="appShell"></section><section id="quickEntryModal" hidden></section>${pageMarkup}`);
    await page.addScriptTag({ content: `const els = Object.fromEntries(Array.from(document.querySelectorAll('[id]'), el => [el.id, el]));
      const USE_MOBILE_APP_THEME = false;
      let testStore, saves = 0, sequence = 0;
      function getActiveStore() { return testStore; }
      function isAdminUser() { return true; }
      function createId() { return 'test-' + (++sequence); }
      function recordActivity() {}
      function formatCurrency(amount) { return amount + ' đ'; }
      function saveAndRender() { saves++; }
      function updateTimeFiltersVisibility() {}
      function closeQuickEntryModal() {}
      function showActivityNavigationNotice() {}
      ${app.slice(datesStart, datesEnd)}
      ${app.slice(start, end)}
      els.bulkCashFile.addEventListener('change', importBulkCashFile);` });
    const files = process.argv.slice(2);
    const cases = files.length ? files : [null];
    for (const type of ["expense", "income"]) {
      await page.evaluate((type) => {
        els.bulkCashPage.dataset.type = type;
        els.bulkCashPage.dataset.storeId = 'test';
        els.bulkCashCard.dataset.type = type;
        resetBulkCashFileImport();
      }, type);
      for (const file of cases) {
        await page.evaluate(() => { els.bulkCashPage.hidden = false; });
        await page.locator("#bulkCashFile").setInputFiles(file || {
          name: "201-lines.txt", mimeType: "text/plain",
          buffer: Buffer.from(Array.from({ length: 201 }, (_, i) => `Khoản ${i + 1},1000,Mục`).join("\n"))
        });
        await page.waitForFunction(() => document.querySelector("#bulkCashFileHint").dataset.state !== "loading", null, { timeout: 18000 })
          .catch(error => { throw new Error(`${error.message}; browser errors: ${JSON.stringify(errors)}`); });
        const result = await page.evaluate(() => ({
          state: els.bulkCashFileHint.dataset.state,
          count: els.bulkCashText.value.split(/\r\n|\n|\r/).filter(line => line.trim()).length,
          hasLimit: els.bulkCashText.hasAttribute("maxlength"),
          hint: els.bulkCashFileHint.textContent,
          parsed: parseBulkCashRows(els.bulkCashText.value, toDateInputValue(new Date()), { maxRows: null })
        }));
        assert.equal(result.state, "success", JSON.stringify({ result, errors }));
        assert.ok(result.count > 0);
        assert.equal(result.hasLimit, false);
        assert.equal(await page.locator("#bulkCashText").isEnabled(), true);
        assert.equal(await page.locator("#completeBulkCashPage").isEnabled(), true);
        assert.deepEqual(errors, []);
        assert.deepEqual(result.parsed.errors, []);
        assert.equal(result.parsed.rows.length, result.count);
        const { parsed, ...summary } = result;
        const saved = await page.evaluate(() => {
          testStore = { id: 'test', categories: { income: [], expense: [] }, entries: [] };
          saves = 0;
          completeBulkCashPage();
          completeBulkCashPage();
          return { count: testStore.entries.length, saves, hidden: els.bulkCashPage.hidden };
        });
        assert.equal(saved.count, parsed.rows.length);
        assert.equal(saved.saves, 1);
        assert.equal(saved.hidden, true);
        console.log(JSON.stringify({ type, file: file ? path.basename(file) : "201-lines.txt", ...summary, parsedRows: parsed.rows.length }));
      }
    }
    for (const [width, height] of [[320, 700], [375, 812], [430, 900], [667, 375], [375, 400], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => { els.bulkCashPage.hidden = false; els.bulkCashPage.scrollTop = 0; });
      const layout = await page.evaluate(() => {
        const card = els.bulkCashCard.getBoundingClientRect();
        const shell = document.querySelector('.bulk-cash-shell').getBoundingClientRect();
        const overflow = ['bulkCashText', 'bulkCashFileButton', 'cancelBulkCashPage', 'completeBulkCashPage']
          .filter(id => {
            const rect = els[id].getBoundingClientRect();
            return rect.left < card.left - 1 || rect.right > card.right + 1;
          });
        return { overflow, centered: Math.abs(shell.left - (innerWidth - shell.right)) < 2 };
      });
      assert.deepEqual(layout.overflow, [], `${width}x${height}`);
      assert.equal(layout.centered, true, `${width}x${height}`);
    }
    console.log('Layout checks passed at 320/375/430px, landscape, keyboard-height and desktop.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
