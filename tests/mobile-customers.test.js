const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("customer manager is a full page with a back control, search, filters and creation action", () => {
  for (const id of ["closeCustomersTop", "customerSearchInput", "customerMemberChips", "toggleCustomerForm", "customerForm", "customersList"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /<main class="customers-page" id="customersPage" aria-labelledby="customersTitle" hidden>/);
  assert.match(html, /class="customers-page-header"/);
  assert.doesNotMatch(html, /id="customersModal"/);
  assert.match(app, /els\.closeCustomersTop\.addEventListener\("click", closeCustomersPage\)/);
  assert.match(app, /els\.customerMemberChips\.addEventListener\("click"/);
  assert.match(css, /\.customers-page\s*\{\s*position: fixed;/);
  assert.match(css, /\.customers-page\[hidden\]\s*\{\s*display: none;/);
  assert.match(css, /\.customer-history-backdrop,\s*\.member-tier-backdrop\s*\{\s*z-index: 190;/);
  assert.match(css, /body\.customers-page-open > #tabBar,/);
  assert.match(css, /html\.mobile-app-theme \.customers-card/);
  assert.match(css, /html\.mobile-app-theme \.customers-card \.customer-form\[hidden\] \{\s*display: none;/);
  assert.match(css, /html\.mobile-app-theme \.customer-mobile-history,/);
  assert.match(css, /html\.mobile-app-theme \.customer-mobile-edit \{/);
});

test("mobile chips filter real customers without losing search or customer actions", () => {
  const start = app.indexOf("function renderCustomers(store) {");
  const end = app.indexOf("function renderCustomerSearchSuggestions(customers) {", start);
  assert.ok(start >= 0 && end > start);
  const els = {
    customerSearchInput: { value: "" },
    customerMemberFilter: { innerHTML: "", value: "all" },
    customerMemberChips: { innerHTML: "" },
    customerSearchSuggestions: { innerHTML: "" },
    customerForm: { hidden: true },
    customersCount: { textContent: "" },
    customersList: { innerHTML: "" }
  };
  const uiState = { customerMemberFilter: "all", customerSearch: "", customerFormOpen: false };
  const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const context = {
    els, uiState,
    today: "2026-10-05",
    getStoreCustomers: (store) => store.customers,
    renderCustomerSearchSuggestions() {},
    formatDate: (value) => value,
    formatTime: () => "",
    isRegularMemberTier: (value) => value === "Thường",
    normalizeSearchText: (value) => String(value).toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    escapeHtml
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  const store = { customers: [
    { id: "a", name: "An <script>", phone: "0123", memberTier: "Thường", createdAt: "2026-10-04T10:00:00" },
    { id: "b", name: "Bình", phone: "0987", memberTier: "Vàng", createdAt: "2026-10-03T10:00:00" }
  ] };
  context.renderCustomers(store);
  assert.equal(els.customersCount.textContent, "2 khách");
  assert.match(els.customersList.innerHTML, /An &lt;script&gt;/);
  assert.doesNotMatch(els.customersList.innerHTML, /An <script>/);
  assert.match(els.customersList.innerHTML, /data-customer-history="a"/);
  assert.match(els.customersList.innerHTML, /data-member-tier-customer="b"/);
  assert.match(els.customerMemberChips.innerHTML, /aria-pressed="true"/);

  uiState.customerMemberFilter = "other";
  context.renderCustomers(store);
  assert.equal(els.customersCount.textContent, "1 khách");
  assert.match(els.customersList.innerHTML, /Bình/);
  assert.doesNotMatch(els.customersList.innerHTML, /An &lt;script&gt;/);

  uiState.customerMemberFilter = "thuong";
  uiState.customerSearch = "0123";
  context.renderCustomers(store);
  assert.equal(els.customersCount.textContent, "1 khách");
  assert.match(els.customersList.innerHTML, /An &lt;script&gt;/);
});

test("mobile customer form and keyboard viewport remain usable in the full page", () => {
  assert.match(app, /els\.customersCard\.classList\.add\("customer-form-open"\)/);
  assert.match(app, /els\.customersCard\.classList\.remove\("customer-form-open"\)/);
  assert.match(app, /window\.visualViewport\?\.addEventListener\("resize", updateCustomersViewport\)/);
  assert.match(app, /els\.customersPage\.scrollTop \+= targetBounds\.bottom/);
  assert.match(app, /ensureCustomerFocusVisible\(event\.target\)/);
  assert.match(css, /html\.mobile-app-theme \.customers-card\.customer-form-open \.customers-list/);
  assert.match(css, /html\.mobile-app-theme \.customer-member-chip\.is-active/);
  assert.match(css, /html\.mobile-app-theme \.customer-mobile-edit \{[\s\S]*?background: #edf2ff;[\s\S]*?color: #172e75;/);
  assert.match(css, /html\.mobile-app-theme \.customer-form-toggle \{[^}]*align-items: center;[^}]*justify-content: center;[^}]*line-height: 1\.2;/);
  assert.match(css, /html\.mobile-app-theme \.customer-add-icon \{[^}]*align-items: center;[^}]*line-height: 1;/);
  assert.match(css, /html\.mobile-app-theme \.customers-card \.customer-form \{[^}]*min-width: 0;[^}]*width: 100%;/);
  assert.match(css, /html\.mobile-app-theme \.customers-card\.customer-form-open \.customer-form \.field \{\s*min-width: 0;/);
  assert.match(html, /id="customerCreatedDate" type="date"/);
  assert.match(html, /id="customerCreatedTime" type="time"/);
  assert.match(html, /id="customerCreatedAt" name="createdAt" type="datetime-local" required/);
  assert.match(css, /\.customer-created-mobile \{\s*display: none;/);
  assert.match(css, /html\.mobile-app-theme label\[for="customerCreatedAt"\],[\s\S]*?html\.mobile-app-theme #customerCreatedAt \{\s*display: none;/);
  assert.match(css, /html\.mobile-app-theme \.customer-created-mobile \{[^}]*display: grid;[^}]*width: 100%;[^}]*max-width: 100%;/);
  assert.match(app, /els\.customerCreatedAt\.required = false;[\s\S]*?els\.customerCreatedDate\.required = true;[\s\S]*?els\.customerCreatedTime\.required = true;/);
});

test("mobile customer date and time keep the original timestamp through edits", () => {
  const start = app.indexOf("function syncCustomerCreatedAtFromMobile() {");
  const end = app.indexOf("function closeCustomerForm() {", start);
  assert.ok(start >= 0 && end > start);
  const els = {
    customerCreatedAt: { value: "" },
    customerCreatedDate: { value: "2026-08-29" },
    customerCreatedTime: { value: "04:37" }
  };
  const context = { els };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.syncCustomerCreatedAtFromMobile();
  assert.equal(els.customerCreatedAt.value, "2026-08-29T04:37");
  els.customerCreatedTime.value = "15:08";
  context.syncCustomerCreatedAtFromMobile();
  assert.equal(els.customerCreatedAt.value, "2026-08-29T15:08");
  els.customerCreatedDate.value = "";
  context.syncCustomerCreatedAtFromMobile();
  assert.equal(els.customerCreatedAt.value, "");
  assert.match(app, /els\.customerCreatedAt\.value = toDateTimeLocalValue\(customer\?\.createdAt \|\| new Date\(\)\.toISOString\(\)\);[\s\S]*?els\.customerCreatedDate\.value = createdDate;[\s\S]*?els\.customerCreatedTime\.value = createdTime;/);
  assert.match(app, /if \(USE_MOBILE_APP_THEME\) syncCustomerCreatedAtFromMobile\(\);\s*saveCustomerFromForm\(new FormData\(els\.customerForm\)\)/);
});

test("opening an existing customer loads both compact date and time controls", () => {
  const start = app.indexOf("function openCustomerForm(customer = null) {");
  const end = app.indexOf("function syncCustomerCreatedAtFromMobile() {", start);
  const classes = new Set();
  const els = {
    customerForm: { hidden: true, elements: { customerId: { value: "" } } },
    customersCard: { classList: { add: (name) => classes.add(name) } },
    customersPage: { scrollTop: 50 },
    customerNameInput: { value: "", focus() {} },
    customerPhoneInput: { value: "" },
    customerMemberTier: { value: "" },
    customerCreatedAt: { value: "" },
    customerCreatedDate: { value: "" },
    customerCreatedTime: { value: "" }
  };
  const context = { els, uiState: {}, toDateTimeLocalValue: () => "2026-08-29T04:37" };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.openCustomerForm({ id: "customer-1", name: "An", phone: "0123", memberTier: "Thường", createdAt: "2026-08-28T21:37:00.000Z" });
  assert.equal(els.customerForm.hidden, false);
  assert.equal(els.customerCreatedDate.value, "2026-08-29");
  assert.equal(els.customerCreatedTime.value, "04:37");
  assert.equal(els.customerCreatedAt.value, "2026-08-29T04:37");
  assert.ok(classes.has("customer-form-open"));
});

test("customer page has browser back navigation and cleans up on sign-out", () => {
  assert.match(app, /window\.history\.pushState\(\{ \.\.\.window\.history\.state, customersPage: true \}, "", "#customers"\)/);
  assert.match(app, /window\.addEventListener\("popstate"/);
  assert.match(app, /window\.history\.back\(\)/);
  assert.match(app, /function showLoginScreen[\s\S]*?hideCustomersPage\(\{ restoreFocus: false \}\)/);
  assert.match(app, /function showAuthenticatedApp[\s\S]*?openCustomersPage\(\{ fromHistory: true \}\)/);
  assert.match(app, /function openCustomersPage\([\s\S]*?if \(isEmployeeUser\(\)\)/);
  assert.match(app, /els\.appShell\.inert = true;/);
  assert.match(app, /els\.appShell\.inert = false;/);
});

test("opening and leaving the customer page preserves browser history and background focus", () => {
  const start = app.indexOf("function openCustomersPage(");
  const end = app.indexOf("function openCustomerForm(", start);
  assert.ok(start >= 0 && end > start);
  const classes = new Set();
  const location = { hash: "", pathname: "/quanlycuahang/", search: "" };
  let pushes = 0;
  let backs = 0;
  let focusReturned = 0;
  let activeTab = "stores";
  let employee = false;
  const history = {
    state: null,
    pushState(state, _title, url) { this.state = state; location.hash = url; pushes += 1; },
    replaceState(_state, _title, url) { location.hash = url.includes("#") ? url.slice(url.indexOf("#")) : ""; },
    back() { backs += 1; }
  };
  const els = {
    customersPage: { hidden: true, scrollTop: 0, style: { setProperty() {} }, contains: () => false },
    appShell: { inert: false, setAttribute() {}, removeAttribute() {} },
    tabBar: { inert: false },
    closeCustomersTop: { focus() {} },
    openCustomers: { focus() { focusReturned += 1; } }
  };
  const context = {
    els, window: { location, history, innerHeight: 760, visualViewport: null },
    document: { body: { classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } }, activeElement: null },
    USE_MOBILE_APP_THEME: true,
    uiState: {},
    isEmployeeUser: () => employee,
    getActiveTabName: () => activeTab,
    activateTab: (tab) => { activeTab = tab; },
    getActiveStore: () => ({ customers: [] }),
    closeCustomerForm() {}, renderCustomers() {}, updateTimeFiltersVisibility() {},
    closeCustomerHistoryModal() {}, closeMemberTierModal() {}
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.openCustomersPage();
  assert.equal(pushes, 1);
  assert.equal(activeTab, "sales");
  assert.equal(location.hash, "#customers");
  assert.equal(els.customersPage.hidden, false);
  assert.equal(els.appShell.inert, true);
  assert.equal(els.tabBar.inert, true);
  assert.ok(classes.has("customers-page-open"));

  context.closeCustomersPage();
  assert.equal(backs, 1);
  location.hash = "";
  context.hideCustomersPage();
  assert.equal(els.customersPage.hidden, true);
  assert.equal(els.appShell.inert, false);
  assert.equal(els.tabBar.inert, false);
  assert.equal(focusReturned, 1);
  assert.ok(!classes.has("customers-page-open"));

  employee = true;
  location.hash = "#customers";
  context.openCustomersPage({ fromHistory: true });
  assert.equal(els.customersPage.hidden, true);
  assert.equal(location.hash, "");
});
