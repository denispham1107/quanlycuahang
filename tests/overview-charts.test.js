const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const start = app.indexOf("function getOverviewChartData(store, referenceDate = new Date()) {");
const end = app.indexOf("function renderOverviewCharts(store) {", start);
const categoryStart = app.indexOf("function getMonthlyExpenseCategoryData(store, referenceDate = new Date()) {");
const categoryEnd = app.indexOf("function renderOverviewExpenseCategories(store) {", categoryStart);

function chartData(store, date) {
  const context = {
    toDateInputValue: (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`,
    isCancelledEntry: (entry) => entry.status === "cancelled"
  };
  vm.createContext(context);
  vm.runInContext(`${app.slice(start, end)}\nthis.getOverviewChartData = getOverviewChartData;`, context);
  return JSON.parse(JSON.stringify(context.getOverviewChartData(store, date)));
}

function categoryChartData(store, date) {
  const context = {
    toDateInputValue: (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`,
    isCancelledEntry: (entry) => entry.status === "cancelled"
  };
  vm.createContext(context);
  vm.runInContext(`${app.slice(categoryStart, categoryEnd)}\nthis.getMonthlyExpenseCategoryData = getMonthlyExpenseCategoryData;`, context);
  return JSON.parse(JSON.stringify(context.getMonthlyExpenseCategoryData(store, date)));
}

test("all four overview charts are shared by mobile and desktop in the same order", () => {
  assert.ok(start >= 0 && end > start);
  const balance = html.indexOf('id="mobileBalance"');
  const summary = html.indexOf('class="summary-grid"', balance);
  const charts = html.indexOf('class="overview-charts"', summary);
  const breakdown = html.indexOf('class="desktop-overview-breakdown"', charts);
  assert.ok(balance < summary && summary < charts && charts < breakdown);
  const chartIds = ["overviewCategoryPlot", "overviewWeekPlot", "overviewIncomeMonthPlot", "overviewExpenseMonthPlot"];
  const chartPositions = chartIds.map((id) => html.indexOf(`id="${id}"`, charts));
  assert.ok(chartPositions.every((position) => position > charts && position < breakdown));
  assert.deepEqual(chartPositions, [...chartPositions].sort((a, b) => a - b));
  assert.match(css, /\.overview-charts\s*\{\s*display: grid;/);
  assert.doesNotMatch(css, /\.overview-charts\s*\{\s*display: none;/);
  assert.match(css, /\.overview-chart-card\s*\{\s*display: grid;/);
  assert.match(app, /document\.querySelector\("\.overview-charts"\)\?\.addEventListener\("click"/);
  assert.match(app, /renderDesktopOverviewBreakdown\([^;]+;\s*renderOverviewExpenseCategories\(store\);\s*renderOverviewCharts\(store\);/);
});

test("current-month daily and comparison charts sum active cash flow across a year boundary", () => {
  const data = chartData({
    entries: [
      { type: "income", date: "2025-12-05", amount: 100 },
      { type: "income", date: "2025-12-27", amount: 10 },
      { type: "expense", date: "2025-12-31", amount: 5 },
      { type: "income", date: "2026-01-01", amount: 20 },
      { type: "income", date: "2026-01-01", amount: 40, orderId: "sale-1" },
      { type: "income", date: "2026-01-02", amount: 900, status: "cancelled" },
      { type: "expense", date: "2026-01-02", amount: 7 },
      { type: "expense", date: "2026-01-02", amount: 50, status: "cancelled" }
    ],
    orders: [
      { date: "2025-12-10", total: 30 },
      { date: "2026-01-01", total: 40 },
      { date: "2026-01-02", total: 1000, status: "cancelled" }
    ]
  }, new Date(2026, 0, 2));

  assert.equal(data.days.length, 31);
  assert.equal(data.days[0].date, "2026-01-01");
  assert.equal(data.days[30].date, "2026-01-31");
  assert.deepEqual(data.days.find((item) => item.date === "2026-01-01"), { date: "2026-01-01", income: 60, expense: 0 });
  assert.deepEqual(data.days.find((item) => item.date === "2026-01-02"), { date: "2026-01-02", income: 0, expense: 7 });
  assert.deepEqual(data.months, [
    { key: "2025-12", income: 140, expense: 5 },
    { key: "2026-01", income: 60, expense: 7 }
  ]);
  assert.deepEqual(data.totals, { income: { amount: 60, count: 2 }, expense: { amount: 7, count: 1 } });
});

test("charts show zero values for an empty store without borrowing another store's data", () => {
  const data = chartData({ entries: [], orders: [] }, new Date(2026, 9, 6));
  assert.equal(data.days.length, 31);
  assert.equal(data.days[0].date, "2026-10-01");
  assert.equal(data.days[30].date, "2026-10-31");
  assert.ok(data.days.every((item) => item.income === 0 && item.expense === 0));
  assert.deepEqual(data.totals, { income: { amount: 0, count: 0 }, expense: { amount: 0, count: 0 } });
  assert.deepEqual(data.months, [
    { key: "2026-09", income: 0, expense: 0 },
    { key: "2026-10", income: 0, expense: 0 }
  ]);
});

test("cash-flow chart spans all days of a leap-year February and exposes scrollable monthly totals", () => {
  const data = chartData({
    entries: [
      { type: "income", date: "2028-02-01", amount: 120 },
      { type: "expense", date: "2028-02-29", amount: 35 },
      { type: "income", date: "2028-01-31", amount: 500 }
    ],
    orders: [{ date: "2028-02-29", total: 80 }]
  }, new Date(2028, 1, 10));
  assert.equal(data.days.length, 29);
  assert.deepEqual(data.days[0], { date: "2028-02-01", income: 120, expense: 0 });
  assert.deepEqual(data.days[28], { date: "2028-02-29", income: 80, expense: 35 });
  assert.deepEqual(data.totals, { income: { amount: 200, count: 2 }, expense: { amount: 35, count: 1 } });
  for (const id of ["overviewIncomeTotal", "overviewIncomeCount", "overviewExpenseTotal", "overviewExpenseCount", "overviewFlowScroll"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Biểu đồ tiền vào và tiền ra theo từng ngày; cuộn ngang để xem cả tháng/);
  assert.match(css, /\.overview-week-plot\s*\{[^}]*grid-auto-flow: column;/);
  assert.match(css, /\.overview-category-scroll\s*\{[^}]*overflow-x: auto;/);
});

test("monthly Chi tiêu Q/P chart follows the balance, exposes totals and scrolls all calendar days", () => {
  assert.ok(categoryStart >= 0 && categoryEnd > categoryStart);
  const balance = html.indexOf('id="mobileBalance"');
  const category = html.indexOf('id="overviewCategoryPlot"');
  const week = html.indexOf('id="overviewWeekPlot"');
  assert.ok(balance < category && category < week);
  for (const id of ["overviewCategoryQTotal", "overviewCategoryPTotal", "overviewCategoryQCount", "overviewCategoryPCount", "overviewCategoryScroll"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /\.overview-category-scroll\s*\{[^}]*overflow-x: auto;/);
  assert.match(css, /\.overview-category-plot\s*\{[^}]*grid-auto-flow: column;/);
  assert.match(app, /renderDesktopOverviewBreakdown\([^;]+;\s*renderOverviewExpenseCategories\(store\);\s*renderOverviewCharts\(store\);/);
});

test("Q/P day columns use category IDs, exclude cancelled entries, and total amount plus entry count", () => {
  const data = categoryChartData({
    categories: { expense: [
      { id: "q", name: " Chi   tiêu Q " },
      { id: "p", name: "Chi tiêu P" },
      { id: "other", name: "Khác" }
    ] },
    entries: [
      { type: "expense", categoryId: "q", date: "2026-10-01", amount: 100 },
      { type: "expense", categoryId: "q", date: "2026-10-01", amount: 200 },
      { type: "expense", categoryId: "p", date: "2026-10-01", amount: 50 },
      { type: "expense", categoryId: "p", date: "2026-10-31", amount: 25 },
      { type: "expense", categoryId: "q", date: "2026-09-30", amount: 999 },
      { type: "expense", categoryId: "p", date: "2026-10-02", amount: 1000, status: "cancelled" },
      { type: "expense", categoryId: "other", date: "2026-10-03", amount: 500 },
      { type: "income", categoryId: "q", date: "2026-10-04", amount: 600 }
    ]
  }, new Date(2026, 9, 6));
  assert.equal(data.monthKey, "2026-10");
  assert.equal(data.days.length, 31);
  assert.equal(data.days[0].date, "2026-10-01");
  assert.equal(data.days[30].date, "2026-10-31");
  assert.deepEqual(data.days[0], { date: "2026-10-01", q: 300, p: 50 });
  assert.deepEqual(data.days[30], { date: "2026-10-31", q: 0, p: 25 });
  assert.deepEqual(data.totals, { q: { amount: 300, count: 2 }, p: { amount: 75, count: 2 } });
  assert.deepEqual(data.missing, []);
});

test("Q/P chart handles a missing category, an empty store and leap-year February", () => {
  const data = categoryChartData({
    categories: { expense: [{ id: "q", name: "Chi tiêu Q" }] },
    entries: []
  }, new Date(2028, 1, 10));
  assert.equal(data.days.length, 29);
  assert.equal(data.days[28].date, "2028-02-29");
  assert.deepEqual(data.missing, ["p"]);
  assert.deepEqual(data.totals, { q: { amount: 0, count: 0 }, p: { amount: 0, count: 0 } });
  const otherStore = categoryChartData({ categories: { expense: [] }, entries: [] }, new Date(2026, 9, 6));
  assert.deepEqual(otherStore.missing, ["q", "p"]);
  assert.ok(otherStore.days.every((day) => day.q === 0 && day.p === 0));
});
