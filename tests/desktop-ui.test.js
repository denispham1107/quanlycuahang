const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

test("desktop assets use one cache version and mobile-specific navigation remains separate", () => {
  assert.match(html, /styles\.css\?v=114/);
  assert.match(html, /app\.js\?v=114/);
  assert.match(worker, /quanlycuahang-pwa-v114/);
  assert.match(worker, /styles\.css\?v=114/);
  assert.match(worker, /app\.js\?v=114/);
  assert.match(app, /if \(USE_MOBILE_APP_THEME && els\.tabBar\)/);
  assert.match(app, /if \(desktopUi\) \{\s*document\.querySelector\("#desktopNavHost"\)/);
  assert.match(css, /html\.mobile-app-theme \.desktop-filter-rail/);
  assert.match(css, /html:not\(\.mobile-app-theme\) \.desktop-nav-host \.tab-button/);
});

test("desktop and mobile render the same SVG for all six navigation tabs", () => {
  for (const tab of ["stores", "overview", "income", "expense", "purchase", "sales"]) {
    const button = html.match(new RegExp(`<button class="tab-button[^"]*"[^>]*data-tab="${tab}"[\\s\\S]*?<\\/button>`))?.[0];
    assert.ok(button, `Missing ${tab} tab`);
    assert.match(button, /class="tab-icon"[^>]*><svg/);
    assert.doesNotMatch(button, /desktop-tab-icon/);
    assert.equal((button.match(/<svg\b/g) || []).length, 1, `${tab} must have one shared icon`);
  }
  assert.match(css, /html:not\(\.mobile-app-theme\) \.desktop-nav-host \.tab-icon \{\s*display: inline-grid;/);
  assert.match(css, /\.tab-button \.tab-icon \.icon-accent \{ stroke: var\(--mobile-nav-icon-accent\)/);
  assert.match(css, /\.tab-button:is\(\[data-tab="stores"\],[^\n]+\)\.active \{\s*--mobile-nav-icon-ink: #fff;/);
});

test("desktop income and expense histories follow forms and category summaries", () => {
  for (const tab of ["income", "expense"]) {
    for (const [section, order] of [["manage", 1], ["report", 2], ["history", 3]]) {
      assert.match(css, new RegExp(`html:not\\(\\.mobile-app-theme\\) \\[data-tab-panel="${tab}"\\] > \\.panel\\[data-mobile-flow-panel="${section}"\\][\\s\\S]*?order: ${order};`));
    }
  }
});

test("desktop income cards exclude cancelled entries and preserve category totals", () => {
  const start = app.indexOf("function renderDesktopInsights(store) {");
  const end = app.indexOf("function updateTimeFiltersVisibility(", start);
  assert.ok(start >= 0 && end > start);
  const context = {
    desktopUi: { insights: { innerHTML: "" } },
    getDateRange: () => ({ start: "2026-10-04", end: "2026-10-04" }),
    getActiveTabName: () => "income",
    isCancelledEntry: (entry) => entry.cancelled === true,
    sumEntries: (entries) => entries.reduce((sum, entry) => sum + entry.amount, 0),
    formatCurrency: (value) => `${value} đ`,
    escapeHtml: (value) => String(value)
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.renderDesktopInsights({
    categories: { income: [{ id: "rent", name: "Tiền thuê nhà" }] },
    entries: [
      { type: "income", date: "2026-10-04", categoryId: "rent", amount: 500 },
      { type: "income", date: "2026-10-04", categoryId: "rent", amount: 900, cancelled: true },
      { type: "income", date: "2026-10-03", categoryId: "rent", amount: 200 }
    ]
  });
  assert.match(context.desktopUi.insights.innerHTML, /Tổng thu/);
  assert.match(context.desktopUi.insights.innerHTML, /Tiền thuê nhà/);
  assert.equal((context.desktopUi.insights.innerHTML.match(/500 đ/g) || []).length, 2);
  assert.doesNotMatch(context.desktopUi.insights.innerHTML, /900 đ/);
});

test("Điều hành keeps the Store master-detail layout desktop-only", () => {
  assert.match(html, /class="desktop-store-heading"/);
  assert.match(html, /class="desktop-store-layout"/);
  assert.match(html, /class="desktop-store-details"/);
  assert.match(app, /if \(USE_MOBILE_APP_THEME\) \{\s*if \(storePanel\) storesPanel\.append\(storePanel\);/);
  assert.match(app, /if \(hero\) details\.append\(hero\);/);
  assert.match(css, /html:not\(\.mobile-app-theme\) \.desktop-store-layout \{\s*display: grid;/);
  assert.match(css, /html\.mobile-app-theme \.desktop-store-layout,/);
  assert.match(css, /html\.mobile-app-theme \.desktop-overview-breakdown \{\s*display: none !important;/);
});

test("desktop overview breakdown handles empty and nonempty filtered values", () => {
  const start = app.indexOf("function renderDesktopOverviewBreakdown(rangeLabel, amounts) {");
  const end = app.indexOf("function renderDesktopInsights(store) {", start);
  assert.ok(start >= 0 && end > start);
  const rows = ["income", "sales", "expense"].map((kind) => {
    const value = { textContent: "" };
    const fill = { style: { width: "" } };
    return {
      dataset: { overviewBar: kind },
      querySelector: (selector) => selector === "strong" ? value : fill,
      value,
      fill
    };
  });
  const labels = { textContent: "" };
  const empty = { hidden: false };
  const bars = { hidden: true, querySelectorAll: () => rows };
  const elements = {
    "#desktopOverviewRangeLabel": labels,
    "#desktopOverviewEmpty": empty,
    "#desktopOverviewBars": bars
  };
  const context = {
    desktopUi: {},
    document: { querySelector: (selector) => elements[selector] },
    formatCurrency: (amount) => `${amount} đ`
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.renderDesktopOverviewBreakdown("04/10/2026", { income: 0, sales: 0, expense: 0 });
  assert.equal(labels.textContent, "04/10/2026");
  assert.equal(empty.hidden, false);
  assert.equal(bars.hidden, true);
  context.renderDesktopOverviewBreakdown("04/10/2026", { income: 100, sales: 50, expense: 25 });
  assert.equal(empty.hidden, true);
  assert.equal(bars.hidden, false);
  assert.deepEqual(rows.map((row) => row.value.textContent), ["100 đ", "50 đ", "25 đ"]);
  assert.deepEqual(rows.map((row) => row.fill.style.width), ["100%", "50%", "25%"]);
});
