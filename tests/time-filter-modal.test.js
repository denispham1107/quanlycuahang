const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const visibilityCode = app.slice(
  app.indexOf("function isMobileTimeFilterSuppressed() {"),
  app.indexOf("function updateStickyControlMetrics()")
);

function makeClassList() {
  const classes = new Set();
  return {
    toggle(name, enabled) {
      if (enabled) classes.add(name);
      else classes.delete(name);
    },
    contains: (name) => classes.has(name)
  };
}

test("mobile time filter hides on entry sheets and overlays and returns after closing", () => {
  const els = {
    quickEntryModal: { hidden: true },
    quickEntryForm: { dataset: { type: "sales" } },
    customersPage: { hidden: true },
    closingBookPage: { hidden: true },
    aiChatModal: { hidden: true },
    timeFilters: { hidden: false, classList: makeClassList(), inert: false },
    timeFilterToggle: { hidden: false, classList: makeClassList(), setAttribute() {} },
    timeFilterCurrentValue: { textContent: "" },
    timePresetButtons: [],
    stickyControlDock: { classList: makeClassList() },
    appShell: { hidden: false }
  };
  const mobileTimeFilterShell = { hidden: true, classList: makeClassList() };
  const uiState = { timeFiltersExpanded: true };
  let cancelledAutoCollapse = 0;
  const context = {
    USE_MOBILE_APP_THEME: true,
    els,
    mobileTimeFilterShell,
    uiState,
    desktopUi: null,
    getActiveStore: () => ({}),
    getActiveTabName: () => "sales",
    isEmployeeEmptyTab: () => false,
    getMobileTimeFilterLabel: () => "Hôm nay",
    clearTimeFiltersAutoCollapse: () => { cancelledAutoCollapse += 1; }
  };
  vm.createContext(context);
  vm.runInContext(visibilityCode, context);

  const check = (shouldHide, tab = "sales") => {
    context.updateTimeFiltersVisibility(tab);
    assert.equal(mobileTimeFilterShell.hidden, shouldHide);
    assert.equal(els.timeFilterToggle.hidden, shouldHide);
    assert.equal(els.timeFilters.hidden, shouldHide);
  };

  check(false);
  els.closingBookPage.hidden = false;
  check(true);
  els.closingBookPage.hidden = true;
  check(false);
  for (const type of ["sales", "purchase", "purchase-bulk"]) {
    els.quickEntryForm.dataset.type = type;
    els.quickEntryModal.hidden = false;
    check(true, type === "sales" ? "sales" : "purchase");
    assert.equal(uiState.timeFiltersExpanded, false);
    els.quickEntryModal.hidden = true;
    check(false, type === "sales" ? "sales" : "purchase");
  }
  assert.equal(cancelledAutoCollapse, 1);

  els.customersPage.hidden = false;
  check(true);
  els.customersPage.hidden = true;
  check(false);

  els.aiChatModal.hidden = false;
  check(true, "overview");
  els.aiChatModal.hidden = true;
  check(false, "overview");

  for (const type of ["income", "expense"]) {
    els.quickEntryForm.dataset.type = type;
    els.quickEntryModal.hidden = false;
    check(true, type);
    els.quickEntryModal.hidden = true;
    check(false, type);
  }

  context.isEmployeeEmptyTab = (tab) => tab === "overview";
  check(true, "overview");
  context.isEmployeeEmptyTab = () => false;

  context.USE_MOBILE_APP_THEME = false;
  context.desktopUi = {};
  context.mobileTimeFilterShell = null;
  els.quickEntryForm.dataset.type = "sales";
  assert.equal(context.isMobileTimeFilterSuppressed(), false);
  context.updateTimeFiltersVisibility("sales");
  assert.equal(els.timeFilters.hidden, false);
});

test("entry overlays and customer page refresh the filter without changing desktop behavior", () => {
  for (const name of [
    "openSalesOrderModal", "openPurchaseOrderModal", "openBulkPurchaseModal",
    "openCustomersPage", "hideCustomersPage", "openAIChat", "closeAIChat", "closeQuickEntryModal"
  ]) {
    const start = app.indexOf(`function ${name}(`);
    const end = app.indexOf("\nfunction ", start + 1);
    assert.ok(start >= 0, `${name} is missing`);
    assert.match(app.slice(start, end < 0 ? undefined : end), /updateTimeFiltersVisibility\(\)/, `${name} must refresh the filter`);
  }
  assert.match(visibilityCode, /if \(!USE_MOBILE_APP_THEME\) return false;/);
});
