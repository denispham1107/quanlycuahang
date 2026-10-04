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
  assert.match(html, /styles\.css\?v=46/);
  assert.match(html, /app\.js\?v=46/);
  assert.match(worker, /quanlycuahang-pwa-v46/);
  assert.match(worker, /styles\.css\?v=46/);
  assert.match(worker, /app\.js\?v=46/);
  assert.match(app, /if \(USE_MOBILE_APP_THEME && els\.tabBar\)/);
  assert.match(app, /if \(desktopUi\) \{\s*document\.querySelector\("#desktopNavHost"\)/);
  assert.match(css, /html\.mobile-app-theme \.desktop-filter-rail/);
  assert.match(css, /html:not\(\.mobile-app-theme\) \.desktop-nav-host \.tab-button/);
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
