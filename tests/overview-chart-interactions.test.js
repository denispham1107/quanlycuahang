const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("all four overview charts provide accessible tappable columns and their own value panel", () => {
  assert.equal((html.match(/class="overview-chart-selection"/g) || []).length, 4);
  for (const id of ["overviewCategoryPlot", "overviewWeekPlot", "overviewIncomeMonthPlot", "overviewExpenseMonthPlot"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /\.overview-charts"\)\?\.addEventListener\("click", \(event\) => \{[\s\S]*?showOverviewBarValue\(button\)/);
  assert.match(app, /<button class="category-q" type="button" data-overview-bar data-chart-label=/);
  assert.match(app, /<button class="category-p" type="button" data-overview-bar data-chart-label=/);
  assert.match(app, /<button class="money-in" type="button" data-overview-bar data-chart-label=/);
  assert.match(app, /<button class="money-out" type="button" data-overview-bar data-chart-label=/);
  assert.match(app, /<button class="overview-month-track" type="button" data-overview-bar data-chart-label=/);
  assert.match(css, /\.overview-chart-card \[data-overview-bar\]:focus-visible/);
  assert.match(css, /\.overview-chart-selection\[hidden\]\s*\{\s*display: none;/);
});

test("tapping one column reveals only that column's amount and rerender clears stale details", () => {
  const start = app.indexOf("function resetOverviewChartSelection(plot) {");
  const end = app.indexOf("function renderReports(store) {", start);
  assert.ok(start >= 0 && end > start);
  const context = { formatCurrency: (value) => `${value} đ` };
  vm.createContext(context);
  vm.runInContext(`${app.slice(start, end)}\nthis.showOverviewBarValue = showOverviewBarValue; this.resetOverviewChartSelection = resetOverviewChartSelection;`, context);

  const makeCard = (labels) => {
    const fields = { ".overview-chart-selection-label": { textContent: "" }, ".overview-chart-selection-value": { textContent: "" } };
    const detail = { hidden: true, querySelector: (selector) => fields[selector] };
    const buttons = labels.map(([label, amount]) => ({
      dataset: { chartLabel: label, chartAmount: String(amount) },
      selected: false,
      attributes: {},
      classList: { toggle(name, state) { this.owner.selected = state; } },
      setAttribute(name, value) { this.attributes[name] = value; }
    }));
    const card = {
      querySelectorAll: () => buttons,
      querySelector: () => detail
    };
    buttons.forEach((button) => {
      button.classList.owner = button;
      button.closest = () => card;
    });
    return { card, buttons, detail, fields };
  };

  const week = makeCard([["Ngày 01/10 · Tiền vào", 100], ["Ngày 01/10 · Tiền ra", 25]]);
  const month = makeCard([["Tháng 08 · Tiền vào", 250], ["Tháng 09 · Tiền vào", 500], ["Tháng 10 · Tiền vào", 750]]);
  context.showOverviewBarValue(week.buttons[0]);
  assert.equal(week.fields[".overview-chart-selection-value"].textContent, "100 đ");
  assert.equal(week.fields[".overview-chart-selection-label"].textContent, "Ngày 01/10 · Tiền vào");
  assert.equal(week.buttons[0].attributes["aria-pressed"], "true");
  context.showOverviewBarValue(week.buttons[1]);
  assert.equal(week.fields[".overview-chart-selection-value"].textContent, "25 đ");
  assert.equal(week.buttons[0].attributes["aria-pressed"], "false");
  context.showOverviewBarValue(month.buttons[0]);
  assert.equal(month.fields[".overview-chart-selection-value"].textContent, "250 đ");
  context.showOverviewBarValue(month.buttons[1]);
  assert.equal(month.fields[".overview-chart-selection-value"].textContent, "500 đ");
  context.showOverviewBarValue(month.buttons[2]);
  assert.equal(month.fields[".overview-chart-selection-value"].textContent, "750 đ");
  assert.equal(week.fields[".overview-chart-selection-value"].textContent, "25 đ");
  context.resetOverviewChartSelection({ closest: () => week.card });
  assert.equal(week.detail.hidden, true);
  assert.equal(month.detail.hidden, false);
});
