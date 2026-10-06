const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const root = path.join(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const start = app.indexOf("function parseBulkCashColumns(line) {");
  const end = app.indexOf("function applyQuickEntrySuggestion() {", start);
  assert.ok(start >= 0 && end > start);
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BULK_TEST_CHROME ? { executablePath: process.env.BULK_TEST_CHROME } : {})
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent('<main id="bulkCashPage" data-type="expense" data-store-id="test" data-source="manual"><input id="bulkCashFile" type="file"><p id="bulkCashFileHint"></p><textarea id="bulkCashText" maxlength="70000"></textarea><span id="bulkCashCount"></span><div id="bulkCashErrors"></div></main>');
    await page.addScriptTag({ content: `const els = Object.fromEntries(Array.from(document.querySelectorAll('[id]'), el => [el.id, el]));\n${app.slice(start, end)}\nels.bulkCashFile.addEventListener('change', importBulkCashFile);` });
    const files = process.argv.slice(2);
    const cases = files.length ? files : [null];
    for (const type of ["expense", "income"]) {
      await page.evaluate((type) => { els.bulkCashPage.dataset.type = type; resetBulkCashFileImport(); }, type);
      for (const file of cases) {
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
          hint: els.bulkCashFileHint.textContent
        }));
        assert.equal(result.state, "success", JSON.stringify({ result, errors }));
        assert.ok(result.count > 0);
        assert.equal(result.hasLimit, false);
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ type, file: file ? path.basename(file) : "201-lines.txt", ...result }));
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
