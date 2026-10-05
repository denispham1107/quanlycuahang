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

function chartData(store, date) {
  const context = {
    toDateInputValue: (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`,
    isCancelledEntry: (entry) => entry.status === "cancelled"
  };
  vm.createContext(context);
  vm.runInContext(`${app.slice(start, end)}\nthis.getOverviewChartData = getOverviewChartData;`, context);
  return JSON.parse(JSON.stringify(context.getOverviewChartData(store, date)));
}

test("three overview column charts follow the balance on mobile only", () => {
  assert.ok(start >= 0 && end > start);
  const balance = html.indexOf('id="mobileBalance"');
  const charts = html.indexOf('class="mobile-overview-charts"');
  const desktopRange = html.indexOf('class="selected-range-card"', charts);
  assert.ok(balance < charts && charts < desktopRange);
  for (const id of ["overviewWeekPlot", "overviewIncomeMonthPlot", "overviewExpenseMonthPlot"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /\.mobile-overview-charts\s*\{\s*display: none;/);
  assert.match(css, /html\.mobile-app-theme \.mobile-overview-charts\s*\{\s*display: grid;/);
  assert.match(app, /renderDesktopOverviewBreakdown\([^;]+;\s*renderOverviewCharts\(store\);/);
});

test("seven-day and monthly charts sum real active cash flow across a year boundary", () => {
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

  assert.equal(data.days.length, 7);
  assert.equal(data.days[0].date, "2025-12-27");
  assert.equal(data.days[6].date, "2026-01-02");
  assert.deepEqual(data.days.find((item) => item.date === "2026-01-01"), { date: "2026-01-01", income: 60, expense: 0 });
  assert.deepEqual(data.days.find((item) => item.date === "2026-01-02"), { date: "2026-01-02", income: 0, expense: 7 });
  assert.deepEqual(data.months, [
    { key: "2025-12", income: 140, expense: 5 },
    { key: "2026-01", income: 60, expense: 7 }
  ]);
});

test("charts show zero values for an empty store without borrowing another store's data", () => {
  const data = chartData({ entries: [], orders: [] }, new Date(2026, 9, 6));
  assert.equal(data.days[0].date, "2026-09-30");
  assert.equal(data.days[6].date, "2026-10-06");
  assert.ok(data.days.every((item) => item.income === 0 && item.expense === 0));
  assert.deepEqual(data.months, [
    { key: "2026-09", income: 0, expense: 0 },
    { key: "2026-10", income: 0, expense: 0 }
  ]);
});
