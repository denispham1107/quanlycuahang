const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("cash-flow layout is mobile-only and keeps the desktop summary", () => {
  assert.match(html, /class="mobile-overview-flow"/);
  assert.match(html, /id="mobileOverviewStoreName"/);
  assert.match(html, /id="mobileOverviewRangeLabel"/);
  for (const id of ["mobileTotalIncome", "mobileTotalSales", "mobileTotalExpense", "mobileBalance"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const id of ["totalIncome", "totalSales", "totalExpense", "balance"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /\.mobile-overview-flow\s*\{\s*display: none;/);
  assert.match(css, /html\.mobile-app-theme \.mobile-overview-flow\s*\{\s*display: grid;/);
  assert.match(css, /html\.mobile-app-theme \[data-tab-panel="overview"\] > \.summary-grid\s*\{\s*display: none;/);
});

test("mobile and desktop use the same filtered, non-cancelled totals", () => {
  const start = app.indexOf("function renderReports(store) {");
  const end = app.indexOf("  els.salesHistoryDateLabel.textContent = range.label;", start);
  assert.ok(start >= 0 && end > start);
  const els = new Proxy({}, {
    get(target, key) {
      if (!target[key]) target[key] = { textContent: "", innerHTML: "", value: "all" };
      return target[key];
    }
  });
  const context = {
    els,
    getDateRange: () => ({ start: "2026-10-04", end: "2026-10-04", label: "04/10/2026" }),
    isCancelledEntry: (entry) => entry.cancelled === true,
    filterEntriesBySearch: (entries) => entries,
    filterEntriesByCategory: (entries) => entries,
    sumEntries: (entries) => entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    formatCurrency: (value) => `${value} đ`
  };
  vm.createContext(context);
  vm.runInContext(`${app.slice(start, end)}\n}`, context);
  context.renderReports({
    entries: [
      { type: "income", date: "2026-10-04", createdAt: "1", amount: 100 },
      { type: "income", date: "2026-10-04", createdAt: "2", amount: 900, cancelled: true },
      { type: "income", date: "2026-10-04", createdAt: "3", amount: 3000, orderId: "order-1" },
      { type: "expense", date: "2026-10-04", createdAt: "4", amount: 25 },
      { type: "expense", date: "2026-10-04", createdAt: "5", amount: 500, cancelled: true }
    ],
    orders: [
      { date: "2026-10-04", createdAt: "6", total: 40 },
      { date: "2026-10-04", createdAt: "7", total: 1000, cancelled: true }
    ]
  });
  assert.equal(els.mobileTotalIncome.textContent, els.totalIncome.textContent);
  assert.equal(els.mobileTotalSales.textContent, els.totalSales.textContent);
  assert.equal(els.mobileTotalExpense.textContent, els.totalExpense.textContent);
  assert.equal(els.mobileBalance.textContent, els.balance.textContent);
  assert.equal(els.mobileBalance.textContent, "115 đ");
  assert.equal(els.mobileOverviewRangeLabel.textContent, "04/10/2026");
});
