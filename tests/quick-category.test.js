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

test("Thu and Chi reveal the category name field again after the mobile keyboard resizes", () => {
  const start = app.indexOf("function updateCashQuickEntryViewport() {");
  const end = app.indexOf("if (USE_MOBILE_APP_THEME && window.visualViewport)", start);
  assert.ok(start >= 0 && end > start);
  assert.match(app, /els\.quickNewCategoryName\.focus\(\{ preventScroll: true \}\);[\s\S]*?window\.setTimeout\(ensureQuickCategoryCreatorVisible, 350\)/);

  for (const type of ["income", "expense"]) {
    const viewport = { offsetTop: 65, height: 640 };
    const card = {
      scrollTop: 0,
      getBoundingClientRect() {
        return { top: 80, bottom: Math.min(660, viewport.offsetTop + viewport.height - 10) };
      }
    };
    const input = {};
    const els = {
      quickEntryModal: {
        hidden: false,
        classList: { contains: (name) => name === "cash-quick-entry-mode" },
        style: { setProperty() {} }
      },
      quickEntryForm: card,
      quickCategoryCreator: {
        hidden: false,
        getBoundingClientRect: () => ({ top: 790 - card.scrollTop, bottom: 880 - card.scrollTop, height: 90 })
      },
      quickNewCategoryName: input
    };
    const context = {
      USE_MOBILE_APP_THEME: true,
      els,
      document: { activeElement: input },
      window: { visualViewport: viewport, innerHeight: 700 },
      requestAnimationFrame: (callback) => callback()
    };
    vm.createContext(context);
    vm.runInContext(app.slice(start, end), context);

    context.ensureQuickCategoryCreatorVisible();
    assert.equal(card.scrollTop, 236, `${type}: show creator before keyboard opens`);
    viewport.height = 400;
    context.updateCashQuickEntryViewport();
    assert.equal(card.scrollTop, 441, `${type}: show creator after keyboard opens`);
    assert.ok(els.quickCategoryCreator.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom - 16);
  }
});

test("mobile category editor hides tall entry fields and restores the draft after cancel or add", () => {
  assert.match(html, /class="field quick-cash-hide-when-category">\s*<label for="quickEntryAmount"/);
  assert.match(html, /class="field quick-cash-hide-when-category">\s*<label for="quickEntryNote"/);
  assert.match(html, /class="field quick-cash-hide-when-category">\s*<label for="quickEntryDate"/);
  assert.match(css, /\.cash-quick-entry-mode\.cash-category-editing #quickEntryFields \.quick-cash-hide-when-category,[\s\S]*?\.cash-quick-entry-mode\.cash-category-editing \.quick-entry-card \.modal-actions \{\s*display: none;/);

  const start = app.indexOf("function setQuickCategoryCreatorOpen(open) {");
  const end = app.indexOf("function refreshQuickEntryCategoryOptions(", start);
  const classes = new Set(["cash-quick-entry-mode"]);
  const draft = { note: "Tiền thuê", amount: "120.000", date: "2026-10-05" };
  const els = {
    quickEntryModal: {
      classList: {
        contains: (name) => classes.has(name),
        toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }
      }
    },
    quickEntryForm: { scrollTop: 150 },
    quickCategoryCreator: { hidden: true },
    quickCategoryToggle: { textContent: "+ Mục", setAttribute() {} },
    quickNewCategoryName: { value: "Mục mới" },
    quickCategoryError: { textContent: "", hidden: true },
    quickEntryNote: { value: draft.note },
    quickEntryAmount: { value: draft.amount },
    quickEntryDate: { value: draft.date }
  };
  const context = { USE_MOBILE_APP_THEME: true, els, document: { activeElement: null } };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);

  context.setQuickCategoryCreatorOpen(true);
  assert.equal(els.quickCategoryCreator.hidden, false);
  assert.equal(classes.has("cash-category-editing"), true);
  assert.equal(els.quickCategoryToggle.textContent, "Hủy");
  assert.equal(els.quickEntryForm.scrollTop, 0);
  context.setQuickCategoryCreatorOpen(false);
  assert.equal(classes.has("cash-category-editing"), false);
  assert.equal(els.quickCategoryToggle.textContent, "+ Mục");
  assert.deepEqual([els.quickEntryNote.value, els.quickEntryAmount.value, els.quickEntryDate.value], Object.values(draft));
});

test("creating a quick category keeps draft fields and selects the new category", () => {
  const start = app.indexOf("function setQuickCategoryCreatorOpen(open) {");
  const end = app.indexOf("function openQuickEntryModal(type) {", start);
  assert.ok(start >= 0 && end > start);
  const store = { categories: { income: [{ id: "old", name: "Cũ" }], expense: [] } };
  const classes = new Set(["cash-quick-entry-mode", "cash-category-editing"]);
  const els = {
    quickEntryForm: { dataset: { type: "income" }, scrollTop: 42 },
    quickEntryModal: { classList: {
      contains: (name) => classes.has(name),
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }
    } },
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
    USE_MOBILE_APP_THEME: true,
    els,
    document: { activeElement: null },
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
  assert.equal(classes.has("cash-category-editing"), false);
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
    USE_MOBILE_APP_THEME: false,
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
