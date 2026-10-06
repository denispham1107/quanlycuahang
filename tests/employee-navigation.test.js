const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function section(startText, endText) {
  const start = app.indexOf(startText);
  const end = app.indexOf(endText, start);
  assert.ok(start >= 0 && end > start);
  return app.slice(start, end);
}

function classes() {
  const values = new Set();
  return {
    toggle(name, enabled) { if (enabled) values.add(name); else values.delete(name); },
    contains(name) { return values.has(name); }
  };
}

test("all four informational tabs and the employee account controls remain available", () => {
  for (const tab of ["stores", "overview", "income", "expense"]) {
    assert.match(html, new RegExp(`data-tab="${tab}"`));
    assert.match(html, new RegExp(`data-tab-panel="${tab}"`));
  }
  assert.match(html, /id="signedInUserName"/);
  assert.match(html, /id="signOutButton"[^>]*>Đăng xuất/);
  assert.match(app, /els\.signedInUserName\.textContent = profile\.displayName/);
  assert.match(css, /body\.employee-session \.tab-panel\[data-employee-empty="true"\] > \*\s*\{\s*display: none !important;/);
  assert.match(css, /body\.employee-session \.signed-in-user-name\s*\{\s*display: block;/);
  assert.match(css, /body\.employee-session:not\(\.mobile-secondary-tab\) \.topbar/);
  assert.match(css, /body\.employee-session \.active-store-hero\s*\{\s*display: none !important;/);
});

test("employee tabs stay clickable while their panels are empty and inert", () => {
  const tabs = ["stores", "overview", "income", "expense", "purchase", "sales"]
    .map((tab) => ({ dataset: { tab }, disabled: false }));
  const panels = tabs.map((button) => ({ dataset: { tabPanel: button.dataset.tab }, inert: false }));
  const adminOnly = [{ dataset: {} }];
  const sidebar = { setAttribute(name, value) { this[name] = value; } };
  const body = { classList: classes() };
  let employee = true;
  const control = () => ({ dataset: {}, disabled: false });
  const context = vm.createContext({
    isEmployeeUser: () => employee,
    employeeCan: (area, action) => area === "purchase" && action === "view",
    document: {
      body,
      querySelectorAll(selector) {
        if (selector === "[data-admin-only]") return adminOnly;
        if (selector === "[data-tab]") return tabs;
        if (selector === "[data-tab-panel]") return panels;
        return [];
      },
      querySelector: () => sidebar
    },
    els: {
      activeStorePanel: control(), openCustomers: control(), openBulkPurchase: control(),
      toggleInventory: control(), saveSalesDraft: control(), deleteSalesDraft: control(),
      openActivityHistory: control()
    },
    USE_MOBILE_APP_THEME: true
  });
  vm.runInContext(
    section("const EMPLOYEE_EMPTY_TABS =", "function getFirstEmployeeTab() {") +
    section("function applyRoleAccess() {", "async function loadUserProfile("), context
  );
  context.applyRoleAccess();

  assert.equal(body.classList.contains("employee-session"), true);
  for (const tab of tabs.slice(0, 4)) {
    assert.equal(tab.disabled, false, tab.dataset.tab);
    assert.equal(tab.dataset.roleHidden, "false", tab.dataset.tab);
  }
  assert.equal(tabs[4].dataset.roleHidden, "false");
  assert.equal(tabs[5].dataset.roleHidden, "true");
  for (const panel of panels.slice(0, 4)) {
    assert.equal(panel.dataset.employeeEmpty, "true", panel.dataset.tabPanel);
    assert.equal(panel.inert, true, panel.dataset.tabPanel);
  }
  assert.equal(panels[4].inert, false);
  assert.equal(adminOnly[0].dataset.roleHidden, "true");

  employee = false;
  context.applyRoleAccess();
  assert.equal(body.classList.contains("employee-session"), false);
  assert.ok(tabs.every((tab) => !tab.disabled && tab.dataset.roleHidden === "false"));
  assert.ok(panels.every((panel) => !panel.inert && panel.dataset.employeeEmpty === "false"));
});

test("employee can open blank tabs without redirection but still cannot open ungranted sales", () => {
  const tabs = ["stores", "overview", "income", "expense", "purchase", "sales"]
    .map((tab) => ({ dataset: { tab }, classList: classes(), setAttribute() {} }));
  const panels = tabs.map((button) => ({ dataset: { tabPanel: button.dataset.tab }, classList: classes(), hidden: false }));
  const body = { classList: classes() };
  const context = vm.createContext({
    isEmployeeUser: () => true,
    employeeCan: (area, action) => area === "purchase" && action === "view",
    getFirstEmployeeTab: () => "purchase",
    USE_MOBILE_APP_THEME: true,
    document: { body },
    uiState: {},
    els: { tabButtons: tabs, tabPanels: panels },
    clearTimeFiltersAutoCollapse() {}, updateTimeFiltersVisibility() {},
    updateQuickEntryButton() {}, updatePinnedTabs() {}, updateDesktopCategoryFilter() {},
    updateDesktopPageChrome() {}, renderDesktopInsights() {}, getActiveStore() {}
  });
  vm.runInContext(
    section("const EMPLOYEE_EMPTY_TABS =", "function getFirstEmployeeTab() {") +
    section("function activateTab(tabName) {", "function getActiveTabName() {"), context
  );

  for (const name of ["stores", "overview", "income", "expense"]) {
    context.activateTab(name);
    assert.equal(panels.find((panel) => panel.dataset.tabPanel === name).hidden, false, name);
    assert.equal(tabs.find((tab) => tab.dataset.tab === name).classList.contains("active"), true, name);
    assert.equal(body.classList.contains("mobile-secondary-tab"), name !== "stores");
  }
  context.activateTab("sales");
  assert.equal(tabs.find((tab) => tab.dataset.tab === "purchase").classList.contains("active"), true);
});

test("protected empty tabs do not expose time filters or desktop summary chrome", () => {
  assert.match(app, /const filtersAvailable = Boolean\(store\) && visibleTabs\.has\(tabName\) && !suppressed && !isEmployeeEmptyTab\(tabName\)/);
  assert.match(app, /desktopUi\.filterRail\.hidden = employeeEmpty/);
  assert.match(app, /desktopUi\.heading\.hidden = employeeEmpty/);
  assert.match(app, /desktopUi\.insights\.hidden = employeeEmpty/);
  assert.match(app, /els\.aiButton\.hidden = !\(store && tabName === "overview" && !isEmployeeEmptyTab\(tabName\)\)/);
});
