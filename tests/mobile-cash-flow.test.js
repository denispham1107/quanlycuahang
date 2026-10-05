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
  assert.match(css, /\.mobile-cash-flow,\s*\.mobile-flow-history-overview,\s*\.mobile-flow-close\s*\{\s*display: none;/);
  assert.match(css, /html\.mobile-app-theme \.mobile-cash-flow\s*\{\s*display: grid;/);
  assert.match(css, /html\.mobile-app-theme \.mobile-flow-history-overview\s*\{\s*display: grid;/);
  assert.match(css, /data-mobile-flow-view="history"/);
  assert.match(css, /data-mobile-flow-view="report-history"/);
  assert.match(app, /setMobileCashFlowPanel\(type, "history"\)/);
  for (const type of ["income", "expense"]) {
    const tabStart = html.indexOf(`<section class="tab-panel" data-tab-panel="${type}"`);
    const nextTab = html.indexOf('<section class="tab-panel"', tabStart + 1);
    const tab = html.slice(tabStart, nextTab < 0 ? undefined : nextTab);
    const report = tab.indexOf('data-mobile-flow-panel="report"');
    const historyHeading = tab.indexOf('class="mobile-flow-history-overview"');
    const history = tab.indexOf('data-mobile-flow-panel="history"');
    assert.ok(report >= 0 && report < historyHeading && historyHeading < history, `${type} history follows the category report`);
  }
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

test("Thu and Chi retain the category report when history opens and collapse details independently", () => {
  const start = app.indexOf("function setMobileCashFlowPanel(type, view, innerTarget = null) {");
  const end = app.indexOf("function renderSalesGoodsReport(", start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  const panels = Object.fromEntries(["income", "expense"].map((type) => [type, {
    dataset: {},
    querySelector(selector) {
      return { scrollIntoView(options) { calls.push({ type, selector, options }); } };
    }
  }]));
  const context = {
    USE_MOBILE_APP_THEME: true,
    document: { querySelector: (selector) => panels[selector.match(/"(income|expense)"/)[1]] },
    window: { requestAnimationFrame: (callback) => callback() }
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  for (const type of ["income", "expense"]) {
    const panel = panels[type];
    context.setMobileCashFlowPanel(type, "manage", ".category-section");
    assert.equal(panel.dataset.mobileFlowView, "manage");
    assert.equal(calls.at(-1).selector, '[data-mobile-flow-panel="manage"] .category-section');
    context.setMobileCashFlowPanel(type, "");
    assert.equal(panel.dataset.mobileFlowView, "");
    context.setMobileCashFlowPanel(type, "report");
    assert.equal(panel.dataset.mobileFlowView, "report");
    context.setMobileCashFlowPanel(type, "history");
    assert.equal(panel.dataset.mobileFlowView, "report-history");
    assert.equal(calls.at(-1).selector, ".mobile-flow-history-overview");
    context.setMobileCashFlowPanel(type, "close-history");
    assert.equal(panel.dataset.mobileFlowView, "report");
    context.setMobileCashFlowPanel(type, "history");
    context.setMobileCashFlowPanel(type, "close-report");
    assert.equal(panel.dataset.mobileFlowView, "history");
    context.setMobileCashFlowPanel(type, "close-history");
    assert.equal(panel.dataset.mobileFlowView, "");
    context.setMobileCashFlowPanel(type, "history");
    context.setMobileCashFlowPanel(type, "report");
    assert.equal(panel.dataset.mobileFlowView, "report-history");
  }
});
