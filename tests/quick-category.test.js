const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("quick Thu/Chi entry has an inline category creator with non-submit buttons", () => {
  assert.match(html, /id="quickCategoryToggle"[^>]*type="button"[^>]*aria-controls="quickCategoryCreator"/);
  assert.match(html, /id="quickCategoryCreate" type="button"/);
  assert.match(html, /id="quickNewCategoryName" type="text"/);
  assert.match(css, /\.quick-category-creator\[hidden\][\s\S]*?display: none;/);
  assert.match(app, /els\.quickCategoryCreate\.addEventListener\("click", createQuickEntryCategory\)/);
});

test("quick category input and buttons keep separate columns on narrow screens", () => {
  assert.match(css, /\.quick-entry-category-picker,\s*\.quick-category-creator-row\s*\{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) max-content;/);
  assert.match(css, /\.quick-entry-card \.quick-category-toggle,\s*\.quick-entry-card \.quick-category-creator-row button\s*\{\s*width: auto;/);
  assert.match(css, /\.quick-entry-category-picker select,\s*\.quick-category-creator-row input\s*\{\s*min-width: 0;\s*width: 100%;/);
});

test("Nhập nhanh mobile sheet keeps controls legible without changing desktop or sales", () => {
  assert.match(html, /id="quickEntryClose" type="button" aria-label="Đóng cửa sổ thêm khoản"/);
  assert.match(html, /class="quick-cash-symbol" aria-hidden="true"/);
  assert.match(app, /if \(USE_MOBILE_APP_THEME\) \{\s*\/\/ Match the visual and keyboard order[\s\S]*?mainRow\?\.prepend\(els\.quickEntryAmount\.closest\("\.field"\)\);[\s\S]*?detailRow\?\.prepend\(els\.quickEntryCategory\.closest\("\.field"\)\);/);
  assert.match(app, /els\.quickEntryClose\.addEventListener\("click", closeQuickEntryModal\)/);
  assert.match(css, /html\.mobile-app-theme \.quick-entry-backdrop\.cash-quick-entry-mode \{/);
  assert.match(css, /html\.mobile-app-theme \.cash-quick-entry-mode \.quick-entry-card \.modal-actions \{\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /html\.mobile-app-theme \.cash-quick-entry-mode \.quick-entry-card \.modal-actions #cancelQuickEntry \{[\s\S]*?background: #fff;[\s\S]*?color: #18285a;/);
  assert.match(css, /html\.mobile-app-theme \.cash-quick-entry-mode \.quick-entry-card \.modal-actions #quickEntrySubmit \{[\s\S]*?background: var\(--cash-quick-gradient\);[\s\S]*?color: #fff;/);
});

test("creating a quick category keeps draft fields and selects the new category", () => {
  const start = app.indexOf("function setQuickCategoryCreatorOpen(open) {");
  const end = app.indexOf("function openQuickEntryModal(type) {", start);
  assert.ok(start >= 0 && end > start);
  const store = { categories: { income: [{ id: "old", name: "Cũ" }], expense: [] } };
  const els = {
    quickEntryForm: { dataset: { type: "income" } },
    quickEntryNote: { value: "Tiền thuê" },
    quickEntryAmount: { value: "120.000" },
    quickEntryDate: { value: "2026-10-04" },
    quickNewCategoryName: { value: "Thuê nhà", focus() {} },
    quickCategoryCreator: { hidden: false },
    quickCategoryToggle: { setAttribute(name, value) { this[name] = value; } },
    quickCategoryError: { textContent: "", hidden: true },
    quickEntryCategory: { innerHTML: "", disabled: false, value: "" },
    quickEntrySubmit: { disabled: false }
  };
  const context = {
    els,
    isAdminUser: () => true,
    getActiveStore: () => store,
    addCategory(type, name) {
      const category = { id: "new", name };
      store.categories[type].push(category);
      return category;
    },
    escapeHtml: (value) => String(value)
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.createQuickEntryCategory();
  assert.equal(els.quickEntryCategory.value, "new");
  assert.match(els.quickEntryCategory.innerHTML, /Thuê nhà/);
  assert.equal(els.quickEntrySubmit.disabled, false);
  assert.equal(els.quickCategoryCreator.hidden, true);
  assert.equal(els.quickEntryNote.value, "Tiền thuê");
  assert.equal(els.quickEntryAmount.value, "120.000");
  assert.equal(els.quickEntryDate.value, "2026-10-04");
});

test("duplicate category names are rejected without changing the draft", () => {
  const start = app.indexOf("function setQuickCategoryCreatorOpen(open) {");
  const end = app.indexOf("function openQuickEntryModal(type) {", start);
  const els = {
    quickEntryForm: { dataset: { type: "expense" } },
    quickNewCategoryName: { value: "  Chi Phí CH  ", focus() {} },
    quickCategoryCreator: { hidden: false },
    quickCategoryToggle: { setAttribute() {} },
    quickCategoryError: { textContent: "", hidden: true }
  };
  const context = {
    els,
    isAdminUser: () => true,
    getActiveStore: () => ({ categories: { expense: [{ id: "same", name: "chi phí ch" }] } }),
    addCategory: () => { throw new Error("Duplicate should not be created"); }
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.createQuickEntryCategory();
  assert.equal(els.quickCategoryError.hidden, false);
  assert.match(els.quickCategoryError.textContent, /đã tồn tại/);
});
