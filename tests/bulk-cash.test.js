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
