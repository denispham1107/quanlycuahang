const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const start = app.indexOf("function parseBulkCashColumns(line) {");
const end = app.indexOf("function applyQuickEntrySuggestion() {", start);
assert.ok(start >= 0 && end > start);
const bulkFunctions = app.slice(start, end);

function setup(extra = {}) {
  const context = vm.createContext({
    setTimeout,
    clearTimeout,
    toDateInputValue: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    isValidDateInput: (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
    },
    ...extra
  });
  vm.runInContext(bulkFunctions, context);
  return context;
}

test("Thu and Chi have a full bulk page launched above Hủy/Lưu", () => {
  assert.match(html, /id="openBulkCashPage"[^>]*>Thêm từ danh sách/);
  assert.ok(html.indexOf('id="openBulkCashPage"') < html.indexOf('<div class="modal-actions">', html.indexOf('id="openBulkCashPage"')));
  assert.match(html, /<main class="bulk-cash-page" id="bulkCashPage" aria-labelledby="bulkCashTitle" hidden>/);
  assert.match(html, /id="bulkCashText"[^>]*rows="12"[^>]*maxlength="70000"/);
  assert.match(app, /els\.openBulkCashPage\.hidden = !isAdminUser\(\) \|\| \(type !== "income" && type !== "expense"\)/);
  assert.match(app, /bulkCashPage: true \}, "", `#bulk-\$\{type\}`/);
  assert.match(app, /window\.visualViewport\?\.addEventListener\("resize", updateBulkCashViewport\)/);
  assert.match(app, /hideBulkCashPage\(\{ restoreFocus: false \}\);\s*hideEmployeeManagerPage/);
  assert.match(css, /\.bulk-cash-page\[hidden\] \{ display: none; \}/);
  assert.match(css, /\.bulk-cash-shell \{ width: min\(920px, 100%\); min-width: 0; margin-inline: auto; \}/);
  assert.match(css, /\.bulk-cash-card\s*\{[\s\S]*?width: 100%;[\s\S]*?max-width: 100%;/);
  assert.match(html, /id="bulkCashFileButton"[^>]*aria-label="Nhập từ file \.txt hoặc \.md"/);
  assert.match(html, /id="bulkCashFile"[^>]*type="file"[^>]*accept="\.txt,\.md/);
  assert.match(css, /\.bulk-cash-file-button:focus-visible/);
});

test("CSV-like rows accept quoted commas, optional dates and 200 entries", () => {
  const context = setup();
  const result = context.parseBulkCashRows('"Ăn, uống",150.000,"Mục, khác",06/10/2026\n"Tên ""đặc biệt""",25000,Sinh hoạt', "2026-10-06");
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].note, "Ăn, uống");
  assert.equal(result.rows[0].categoryName, "Mục, khác");
  assert.equal(result.rows[0].amount, 150000);
  assert.equal(result.rows[0].date, "2026-10-06");
  assert.equal(result.rows[1].note, 'Tên "đặc biệt"');
  assert.equal(result.rows[1].date, "2026-10-06");
  assert.equal(context.parseBulkCashRows('“Tên từ iPhone”,1000,Mục', "2026-10-06").rows[0].note, "Tên từ iPhone");

  const twoHundred = Array.from({ length: 200 }, (_, index) => `Khoản ${index + 1},1000,Mục`).join("\n");
  assert.equal(context.parseBulkCashRows(twoHundred, "2026-10-06").errors.length, 0);
  assert.match(context.parseBulkCashRows(`${twoHundred}\nKhoản 201,1000,Mục`, "2026-10-06").errors[0], /Tối đa 200 dòng/);
  const fromFile = context.parseBulkCashRows(`${twoHundred}\nKhoản 201,1000,Mục`, "2026-10-06", { maxRows: null });
  assert.equal(fromFile.errors.length, 0);
  assert.equal(fromFile.rows.length, 201);
});

test("file import accepts .txt/.md, fills the same textarea, and unlocks its length", async () => {
  for (const name of ["danh-sach.txt", "danh-sach.MD"]) {
    const text = Array.from({ length: 201 }, (_, index) => `Khoản ${index + 1},1000,Mục`).join("\n");
    const file = { name, text: async () => text };
    let limitRemoved = false;
    const els = {
      bulkCashPage: { hidden: false, dataset: { type: "income", storeId: "store-1", source: "manual" } },
      bulkCashFile: { files: [file] },
      bulkCashFileHint: { textContent: "", dataset: {} },
      bulkCashText: {
        value: "", focus() {},
        set maxLength(value) { if (value < 0) throw new RangeError("DOM rejects a negative maxLength"); },
        removeAttribute(name) { if (name === "maxlength") limitRemoved = true; }
      },
      bulkCashCount: { textContent: "", classList: { toggle() {} } },
      bulkCashErrors: { hidden: true, replaceChildren() {} }
    };
    const context = setup({ els });
    await context.importBulkCashFile();
    assert.equal(els.bulkCashText.value, text);
    assert.equal(limitRemoved, true);
    assert.equal(els.bulkCashPage.dataset.source, "file");
    assert.equal(els.bulkCashCount.textContent, "201 dòng từ file");
    assert.equal(els.bulkCashFileHint.dataset.state, "success");
    assert.equal(context.parseBulkCashRows(els.bulkCashText.value, "2026-10-06", { maxRows: null }).errors.length, 0);
  }
});

test("file import does not silently discard a read when FileList returns a new File wrapper", async () => {
  const text = "Tiền điện,350000,Sinh hoạt,06/10/2026";
  const fileInput = {
    get files() { return [{ name: "khoanchi.txt", text: async () => text }]; }
  };
  const els = {
    bulkCashPage: { hidden: false, dataset: { type: "expense", storeId: "store-1", source: "manual" } },
    bulkCashFile: fileInput,
    bulkCashFileHint: { textContent: "", dataset: {} },
    bulkCashText: { value: "", maxLength: 70000, focus() {}, removeAttribute() {} },
    bulkCashCount: { textContent: "", classList: { toggle() {} } },
    bulkCashErrors: { hidden: true, replaceChildren() {} }
  };
  const context = setup({ els });
  await context.importBulkCashFile();
  assert.equal(els.bulkCashText.value, text);
  assert.equal(els.bulkCashCount.textContent, "1 dòng từ file");
  assert.equal(els.bulkCashFileHint.dataset.state, "success");
});

test("a slower earlier file cannot replace a more recently selected file", async () => {
  let finishFirst;
  const first = { name: "first.txt", text: () => new Promise((resolve) => { finishFirst = resolve; }) };
  const second = { name: "second.md", text: async () => "Khoản mới,2000,Mục" };
  const fileInput = { files: [first] };
  const els = {
    bulkCashPage: { hidden: false, dataset: { type: "income", storeId: "store-1", source: "manual" } },
    bulkCashFile: fileInput,
    bulkCashFileHint: { textContent: "", dataset: {} },
    bulkCashText: { value: "", maxLength: 70000, focus() {}, removeAttribute() {} },
    bulkCashCount: { textContent: "", classList: { toggle() {} } },
    bulkCashErrors: { hidden: true, replaceChildren() {} }
  };
  const context = setup({ els });
  const pending = context.importBulkCashFile();
  fileInput.files = [second];
  await context.importBulkCashFile();
  finishFirst("Khoản cũ,1000,Mục");
  await pending;
  assert.equal(els.bulkCashText.value, "Khoản mới,2000,Mục");
  assert.match(els.bulkCashFileHint.textContent, /second\.md/);
});

test("FileReader imports the supplied UTF-8 list format for both Thu and Chi", async () => {
  const sample = [
    '- Ecom.EW26090143116372.VED.0909463601.CashIn.203e582234a4,391560,"Chưa xác định",01/09/2026',
    '- Ecom.EW26090143120234.VED.0909463601.CashIn.c6c396412f73,102960,"Chưa xác định",01/09/2026',
    '- Ecom.EW26090144148126.VED.0909463601.CashIn.45d818844098,65000,"Chưa xác định",01/09/2026',
    '- Mua sữa tươi cho quán ăn,156000,"Chưa xác định",01/09/2026',
    '- Chuyển tiền cho NGUYEN THI KIEU OANH,27500000,"Chưa xác định",01/09/2026',
    '- Yen ứng lương,1500000,"Chưa xác định",01/09/2026'
  ].join("\n");
  class MockFileReader {
    readAsText(file, encoding) {
      assert.equal(encoding, "UTF-8");
      this.result = file.content;
      queueMicrotask(() => this.onload());
    }
  }
  for (const type of ["expense", "income"]) {
    for (const extension of ["txt", "md"]) {
      const file = { name: `khoanchi.${extension}`, content: sample }; // No File.text() method.
      const els = {
        bulkCashPage: { hidden: false, dataset: { type, storeId: "store-1", source: "manual" } },
        bulkCashFile: { files: [file] },
        bulkCashFileHint: { textContent: "", dataset: {} },
        bulkCashText: { value: "", maxLength: 70000, focus() {}, removeAttribute() {} },
        bulkCashCount: { textContent: "", classList: { toggle() {} } },
        bulkCashErrors: { hidden: true, replaceChildren() {} }
      };
      const context = setup({ els, FileReader: MockFileReader });
      await context.importBulkCashFile();
      assert.equal(els.bulkCashPage.dataset.source, "file");
      assert.equal(els.bulkCashCount.textContent, "6 dòng từ file");
      assert.equal(els.bulkCashFileHint.dataset.state, "success");
      const parsed = context.parseBulkCashRows(els.bulkCashText.value, "2026-10-06", { maxRows: null });
      assert.equal(parsed.errors.length, 0);
      assert.equal(parsed.rows.length, 6);
      assert.equal(parsed.rows[0].note, "Ecom.EW26090143116372.VED.0909463601.CashIn.203e582234a4");
      assert.equal(parsed.rows[0].amount, 391560);
      assert.equal(parsed.rows[0].date, "2026-09-01");
      assert.equal(parsed.rows[5].note, "Yen ứng lương");
    }
  }
});

test("file.text remains a fallback if FileReader cannot read the selected file", async () => {
  class BrokenFileReader {
    readAsText() { throw new Error("Reader unavailable"); }
  }
  const context = setup({ FileReader: BrokenFileReader });
  assert.equal(await context.readBulkCashFileText({ text: async () => "Khoản,1000,Mục" }), "Khoản,1000,Mục");
});

test("a stalled file reader does not delay another local reader", async () => {
  class StalledFileReader {
    readAsText() {}
  }
  const context = setup({ FileReader: StalledFileReader });
  const started = Date.now();
  const content = await context.readBulkCashFileText({ size: 509, text: async () => "Khoản,1000,Mục" }, 1000);
  assert.equal(content, "Khoản,1000,Mục");
  assert.ok(Date.now() - started < 500);
});

test("a stalled file.text does not delay FileReader", async () => {
  class WorkingFileReader {
    readAsText(file) {
      this.result = file.content;
      queueMicrotask(() => this.onload());
    }
  }
  const context = setup({ FileReader: WorkingFileReader });
  const content = await context.readBulkCashFileText({ size: 509, content: "Khoản,1000,Mục", text: () => new Promise(() => {}) }, 1000);
  assert.equal(content, "Khoản,1000,Mục");
});

test("arrayBuffer can recover UTF-8 content when another reader stalls", async () => {
  const bytes = new TextEncoder().encode("Sữa tươi,156000,Chưa xác định");
  const file = { size: bytes.length, text: () => new Promise(() => {}), arrayBuffer: async () => bytes.buffer };
  const attempts = [];
  const context = setup({ TextDecoder });
  const content = await context.readBulkCashFileText(file, 10, (index, total) => attempts.push([index, total]));
  assert.equal(content, "Sữa tươi,156000,Chưa xác định");
  assert.deepEqual(attempts, [[1, 2], [2, 2]]);
});

test("a stalled first reader still fills Danh sách khoản from the selected file", async () => {
  const text = "Mua sữa tươi cho quán ăn,156000,Chưa xác định,01/09/2026";
  const bytes = new TextEncoder().encode(text);
  const file = { name: "khoanchi.txt", size: bytes.length, text: () => new Promise(() => {}), arrayBuffer: async () => bytes.buffer };
  const els = {
    bulkCashPage: { hidden: false, dataset: { type: "expense", storeId: "store-1", source: "manual" } },
    bulkCashFile: { files: [file] },
    bulkCashFileHint: { textContent: "", dataset: {} },
    bulkCashText: { value: "", maxLength: 70000, focus() {}, removeAttribute() {} },
    bulkCashCount: { textContent: "", classList: { toggle() {} } },
    bulkCashErrors: { hidden: true, replaceChildren() {} }
  };
  const context = setup({
    els, TextDecoder,
    setTimeout: (callback) => setTimeout(callback, 2), clearTimeout
  });
  await context.importBulkCashFile();
  assert.equal(els.bulkCashText.value, text);
  assert.equal(els.bulkCashCount.textContent, "1 dòng từ file");
  assert.equal(els.bulkCashFileHint.dataset.state, "success");
});

test("all stalled readers report an error instead of leaving Đang đọc indefinitely", async () => {
  class StalledFileReader {
    readAsText() {}
  }
  const context = setup({ FileReader: StalledFileReader });
  await assert.rejects(
    context.readBulkCashFileText({ size: 509, text: () => new Promise(() => {}) }, 10),
    /File read timed out/
  );
});

test("an import with stalled readers leaves loading state and preserves the draft", async () => {
  class StalledFileReader {
    readAsText() {}
  }
  const file = { name: "khoanchi.md", size: 509, text: () => new Promise(() => {}) };
  const els = {
    bulkCashPage: { hidden: false, dataset: { type: "expense", storeId: "store-1", source: "manual" } },
    bulkCashFile: { files: [file] },
    bulkCashFileHint: { textContent: "", dataset: {} },
    bulkCashText: { value: "Bản nháp", maxLength: 70000 }
  };
  const context = setup({
    els, FileReader: StalledFileReader,
    setTimeout: (callback) => setTimeout(callback, 2), clearTimeout,
    console: { error() {} }
  });
  await context.importBulkCashFile();
  assert.equal(els.bulkCashFileHint.dataset.state, "error");
  assert.equal(els.bulkCashText.value, "Bản nháp");
  assert.equal(els.bulkCashPage.dataset.source, "manual");
});

test("file import rejects unsupported or empty files without replacing manual input", async () => {
  const fileInput = { files: [{ name: "data.csv", text: async () => "Khoản,1000,Mục" }] };
  const els = {
    bulkCashPage: { hidden: false, dataset: { type: "expense", storeId: "store-1", source: "manual" } },
    bulkCashFile: fileInput,
    bulkCashFileHint: { textContent: "", dataset: {} },
    bulkCashText: { value: "Bản nháp", maxLength: 70000 }
  };
  const context = setup({ els });
  await context.importBulkCashFile();
  assert.equal(els.bulkCashText.value, "Bản nháp");
  assert.equal(els.bulkCashFileHint.dataset.state, "error");
  fileInput.files = [{ name: "empty.md", text: async () => "  \n  " }];
  await context.importBulkCashFile();
  assert.equal(els.bulkCashText.value, "Bản nháp");
  assert.equal(els.bulkCashPage.dataset.source, "manual");
});

test("closing during a read cancels the result and restores editable controls", async () => {
  let finish;
  const file = { name: "slow.txt", text: () => new Promise(resolve => { finish = resolve; }) };
  const els = {
    bulkCashPage: { hidden: false, dataset: { type: "expense", storeId: "test" } },
    bulkCashFile: { files: [file] },
    bulkCashFileHint: { dataset: {} },
    bulkCashText: { value: "Bản nháp" },
    completeBulkCashPage: { disabled: false },
    quickEntryModal: { hidden: true, removeAttribute() {} },
    appShell: { removeAttribute() {} }
  };
  const context = setup({ els, USE_MOBILE_APP_THEME: false,
    document: { body: { classList: { remove() {} } } }, updateTimeFiltersVisibility() {} });
  const pending = context.importBulkCashFile();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(els.bulkCashText.disabled, true);
  assert.equal(els.completeBulkCashPage.disabled, true);
  context.hideBulkCashPage({ restoreFocus: false });
  finish("Khoản,1000,Mục");
  await pending;
  assert.equal(els.bulkCashText.value, "Bản nháp");
  assert.equal(els.bulkCashText.disabled, false);
  assert.equal(els.completeBulkCashPage.disabled, false);
  assert.equal(els.bulkCashFileHint.dataset.state, "cancelled");
});

test("Hoàn thành cannot save an old draft while a file is still loading", () => {
  const context = setup({
    els: { bulkCashPage: { hidden: false, dataset: { reading: "true" } } },
    getActiveStore: () => assert.fail("Loading import must not enter the save flow")
  });
  context.completeBulkCashPage();
});

test("cancelling a second file selection does not invalidate the current read", async () => {
  let finish;
  const fileInput = { files: [{ name: "slow.txt", text: () => new Promise(resolve => { finish = resolve; }) }] };
  const els = {
    bulkCashPage: { hidden: false, dataset: { type: "income", storeId: "test" } },
    bulkCashFile: fileInput, bulkCashFileHint: { dataset: {} },
    bulkCashText: { value: "", removeAttribute() {}, focus() {} },
    bulkCashCount: { classList: { toggle() {} } },
    bulkCashErrors: { replaceChildren() {} }
  };
  const context = setup({ els });
  const pending = context.importBulkCashFile();
  await new Promise(resolve => setImmediate(resolve));
  fileInput.files = [];
  await context.importBulkCashFile();
  finish("Khoản,1000,Mục");
  await pending;
  assert.equal(els.bulkCashText.value, "Khoản,1000,Mục");
  assert.equal(els.bulkCashFileHint.dataset.state, "success");
  assert.equal(els.bulkCashText.disabled, false);
});

test("Thu and Chi share compact DDMMYYYY dates and either date/category order", () => {
  const context = setup();
  const result = context.parseBulkCashRows([
    '"Tiền điện",350000,Sinh hoạt,06/10/2026',
    '"Tiền điện",350000,06/10/2026,Sinh hoạt',
    '"Tiền điện",350000,Sinh hoạt,01092026',
    '"Tiền điện",350000,01092026,Sinh hoạt',
    '"Tiền điện",350000,2026-09-01,Sinh hoạt'
  ].join("\n"), "2026-10-06");
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows.length, 5);
  for (const row of result.rows) {
    assert.equal(row.categoryName, "Sinh hoạt");
    assert.equal(row.amount, 350000);
  }
  assert.deepEqual(Array.from(result.rows, (row) => row.date), [
    "2026-10-06", "2026-10-06", "2026-09-01", "2026-09-01", "2026-09-01"
  ]);
  assert.match(html, /Ngày nhận DDMMYYYY/);
  assert.match(html, /Số tiền,Ngày,Mục/);
});

test("invalid compact dates and ambiguous date/category positions reject the whole line", () => {
  const context = setup();
  const result = context.parseBulkCashRows([
    "Sai,1000,31022026,Sinh hoạt",
    "Sai,1000,Sinh hoạt,31022026",
    "Sai,1000,01092026,06102026",
    "Sai,1000,01092026"
  ].join("\n"), "2026-10-06");
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 4);
  assert.match(result.errors[0], /Dòng 1: Ngày không hợp lệ/);
  assert.match(result.errors[1], /Dòng 2: Ngày không hợp lệ/);
  assert.match(result.errors[2], /Dòng 3: Chỉ nhập một ngày và một mục/);
  assert.match(result.errors[3], /Dòng 4: Mục phải có/);
});

test("invalid amounts, dates and malformed quotes report exact lines", () => {
  const context = setup();
  const result = context.parseBulkCashRows('Tốt,1000,Mục\nSai,abc,Mục\nNgày,1000,Mục,31/02/2026\n"Chưa đóng,1000,Mục', "2026-10-06");
  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 3);
  assert.match(result.errors[0], /^Dòng 2:/);
  assert.match(result.errors[1], /^Dòng 3:/);
  assert.match(result.errors[2], /^Dòng 4:/);
});

test("Hoàn thành saves one batch only after all rows pass and reuses new categories", () => {
  const store = {
    id: "store-1",
    categories: { expense: [{ id: "existing", name: "Sinh hoạt" }] },
    entries: []
  };
  const errors = [];
  const activities = [];
  let saves = 0;
  let sequence = 0;
  const els = {
    bulkCashPage: { hidden: false, dataset: { type: "expense", storeId: "store-1" } },
    bulkCashText: { value: "A,1000,Sinh hoạt\nB,2000,Mục mới\nC,3000,mục mới" }
  };
  const context = setup({
    els, isAdminUser: () => true, getActiveStore: () => store,
    createId: () => `new-${++sequence}`,
    recordActivity: (...args) => activities.push(args),
    formatCurrency: (amount) => `${amount} đ`,
    saveAndRender: () => { saves += 1; },
    hideBulkCashPage: () => { els.bulkCashPage.hidden = true; },
    clearBulkCashHash() {}, closeQuickEntryModal() {}, showActivityNavigationNotice() {}
  });
  context.showBulkCashErrors = (messages) => errors.push(...messages);
  context.hideBulkCashPage = () => { els.bulkCashPage.hidden = true; };
  context.clearBulkCashHash = () => {};
  context.completeBulkCashPage();
  assert.equal(errors.length, 0);
  assert.equal(saves, 1);
  assert.equal(store.entries.length, 3);
  assert.equal(store.categories.expense.length, 2);
  assert.equal(store.entries[1].categoryId, store.entries[2].categoryId);
  assert.equal(activities.length, 4); // one new category and three entries

  els.bulkCashPage.hidden = false;
  els.bulkCashText.value = "A,1000,Mục\nSai,abc,Mục";
  context.completeBulkCashPage();
  assert.equal(saves, 1);
  assert.equal(store.entries.length, 3);
  assert.equal(store.categories.expense.length, 2);
  assert.match(errors.at(-1), /^Dòng 2:/);

  els.bulkCashText.value = Array.from({ length: 201 }, (_, index) => `Khoản ${index + 1},1000,Mục khác`).join("\n");
  context.completeBulkCashPage();
  assert.equal(saves, 1);
  assert.equal(store.entries.length, 3);
  assert.equal(store.categories.expense.length, 2);
  assert.match(errors.at(-1), /Tối đa 200 dòng/);
});

test("Thu also creates its missing category and defaults an empty date", () => {
  const store = { id: "store-2", categories: { income: [] }, entries: [] };
  let saves = 0;
  let sequence = 0;
  const els = {
    bulkCashPage: { hidden: false, dataset: { type: "income", storeId: "store-2" } },
    bulkCashText: { value: "Tiền thuê,2000000,Cho thuê," }
  };
  const context = setup({
    els, isAdminUser: () => true, getActiveStore: () => store,
    createId: () => `id-${++sequence}`, recordActivity() {},
    formatCurrency: (amount) => `${amount} đ`,
    saveAndRender: () => { saves += 1; },
    closeQuickEntryModal() {}, showActivityNavigationNotice() {}
  });
  context.hideBulkCashPage = () => { els.bulkCashPage.hidden = true; };
  context.clearBulkCashHash = () => {};
  context.completeBulkCashPage();
  assert.equal(saves, 1);
  assert.equal(store.categories.income.length, 1);
  assert.equal(store.entries.length, 1);
  assert.equal(store.entries[0].type, "income");
  assert.match(store.entries[0].date, /^\d{4}-\d{2}-\d{2}$/);
});

test("Hoàn thành saves more than 200 imported rows for both Thu and Chi", () => {
  for (const type of ["income", "expense"]) {
    const store = { id: `store-${type}`, categories: { [type]: [] }, entries: [] };
    const els = {
      bulkCashPage: { hidden: false, dataset: { type, storeId: store.id, source: "file" } },
      bulkCashText: { value: Array.from({ length: 201 }, (_, index) => `Khoản ${index + 1},1000,Mục mới`).join("\n") }
    };
    let saves = 0;
    let sequence = 0;
    const context = setup({
      els, isAdminUser: () => true, getActiveStore: () => store,
      createId: () => `id-${++sequence}`, recordActivity() {},
      formatCurrency: (amount) => `${amount} đ`,
      saveAndRender: () => { saves += 1; },
      closeQuickEntryModal() {}, showActivityNavigationNotice() {}
    });
    context.showBulkCashErrors = (errors) => assert.fail(`Unexpected errors: ${errors.join(", ")}`);
    context.hideBulkCashPage = () => { els.bulkCashPage.hidden = true; };
    context.clearBulkCashHash = () => {};
    context.completeBulkCashPage();
    assert.equal(saves, 1);
    assert.equal(store.entries.length, 201);
    assert.equal(store.categories[type].length, 1);
    assert.ok(store.entries.every((entry) => entry.type === type));
  }
});
