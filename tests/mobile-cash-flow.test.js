const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("Thu and Chi use the same compact mobile layout while desktop panels stay available", () => {
  for (const type of ["income", "expense"]) {
    assert.match(html, new RegExp(`class="mobile-cash-flow" data-mobile-flow="${type}"`));
    for (const section of ["manage", "report", "history"]) {
      assert.match(html, new RegExp(`data-mobile-flow-panel="${section}"`));
    }
  }
  assert.match(css, /\.mobile-cash-flow,\s*\.mobile-flow-close\s*\{\s*display: none;/);
  assert.match(css, /html\.mobile-app-theme \.mobile-cash-flow\s*\{\s*display: grid;/);
  assert.match(css, /data-mobile-flow-view="history"/);
  assert.match(app, /setMobileCashFlowPanel\(type, "history"\)/);
});

test("compact summaries use the selected store, range, live category totals and recent entries", () => {
  const start = app.indexOf("function renderMobileCashFlow(store, type, range, entries) {");
  const end = app.indexOf("function renderSalesGoodsReport(", start);
  assert.ok(start >= 0 && end > start);
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { textContent: "", innerHTML: "", hidden: false, firstChild: { textContent: "" } });
      return elements.get(id);
    }
  };
  const context = {
    document,
    sumEntries: (entries) => entries.reduce((total, entry) => total + entry.amount, 0),
    formatCurrency: (amount) => `${amount} đ`,
    formatDate: (date) => date,
    escapeHtml: (value) => String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.renderMobileCashFlow(
    {
      name: "Cửa hàng thử",
      categories: { income: [{ id: "a", name: "Thuê nhà" }, { id: "b", name: "Mượn ngoài" }] }
    },
    "income",
    { label: "04/10/2026" },
    [{ date: "2026-10-04", note: "Khoản A", categoryId: "a", amount: 125000 }]
  );
  assert.equal(document.getElementById("mobileIncomeFlowTotal").textContent, "125000 đ");
  assert.equal(document.getElementById("mobileIncomeFlowEntryCount").textContent, "1");
  assert.equal(document.getElementById("mobileIncomeFlowCategoryCount").textContent, "2");
  assert.match(document.getElementById("mobileIncomeFlowContext").textContent, /Cửa hàng thử · 04\/10\/2026/);
  assert.match(document.getElementById("mobileIncomeFlowCategories").innerHTML, /Thuê nhà<\/span><strong>125000 đ/);
  assert.match(document.getElementById("mobileIncomeFlowHistory").innerHTML, /Khoản A/);
});

test("mobile detail actions reveal the requested panel and can collapse it again", () => {
  const start = app.indexOf("function setMobileCashFlowPanel(type, view, innerTarget = null) {");
  const end = app.indexOf("function renderSalesGoodsReport(", start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  const panel = {
    dataset: {},
    querySelector(selector) {
      return { scrollIntoView(options) { calls.push({ selector, options }); } };
    }
  };
  const context = {
    USE_MOBILE_APP_THEME: true,
    document: { querySelector: () => panel },
    window: { requestAnimationFrame: (callback) => callback() }
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.setMobileCashFlowPanel("expense", "manage", ".category-section");
  assert.equal(panel.dataset.mobileFlowView, "manage");
  assert.equal(calls[0].selector, '[data-mobile-flow-panel="manage"] .category-section');
  context.setMobileCashFlowPanel("expense", "");
  assert.equal(panel.dataset.mobileFlowView, "");
  assert.equal(calls[1].selector, ".mobile-cash-flow");
});
