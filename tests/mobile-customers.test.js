const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("mobile customer manager has an accessible close control, search, filters and creation action", () => {
  for (const id of ["closeCustomersTop", "customerSearchInput", "customerMemberChips", "toggleCustomerForm", "customerForm", "customersList"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="customersTitle"/);
  assert.match(app, /els\.closeCustomersTop\.addEventListener\("click", closeCustomersModal\)/);
  assert.match(app, /els\.customerMemberChips\.addEventListener\("click"/);
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

test("mobile customer form and keyboard viewport are handled without affecting desktop", () => {
  assert.match(app, /els\.customersCard\.classList\.add\("customer-form-open"\)/);
  assert.match(app, /els\.customersCard\.classList\.remove\("customer-form-open"\)/);
  assert.match(app, /window\.visualViewport\?\.addEventListener\("resize", updateCustomersViewport\)/);
  assert.match(app, /ensureCustomerFocusVisible\(event\.target\)/);
  assert.match(css, /html\.mobile-app-theme \.customers-card\.customer-form-open \.customers-list/);
  assert.match(css, /html\.mobile-app-theme \.customer-member-chip\.is-active/);
  assert.match(css, /html\.mobile-app-theme \.customer-mobile-edit \{[\s\S]*?background: #edf2ff;[\s\S]*?color: #172e75;/);
});
