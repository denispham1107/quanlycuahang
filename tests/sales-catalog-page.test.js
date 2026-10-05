const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("goods catalog is a dedicated page with back navigation and constrained fields", () => {
  assert.match(html, /<main class="sales-catalog-page" id="salesCatalogPage"[^>]*hidden>/);
  assert.doesNotMatch(html, /id="salesCatalogModal"/);
  for (const id of ["closeSalesCatalog", "salesCatalogSearch", "salesCatalogFilter", "salesCatalogList", "salesCatalogTotalCount", "salesCatalogAvailableCount", "salesCatalogGroupCount"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /\.sales-catalog-page\[hidden\]\s*\{\s*display: none;/);
  assert.match(css, /\.sales-catalog-filter-grid input,\s*\.sales-catalog-filter-grid select\s*\{[^}]*max-width: 100%;[^}]*min-width: 0;/);
  assert.match(css, /@media \(max-width: 360px\)\s*\{[^}]*\.sales-catalog-page-content/);
  assert.match(app, /window\.location\.hash === "#sales-catalog"[\s\S]*openSalesCatalogPage\(uiState\.salesCatalogRow, \{ fromHistory: true \}\)/);
});

test("opening the page preserves the sales row and closing returns to the draft", () => {
  const start = app.indexOf("function openSalesCatalogPage(row, { fromHistory = false } = {}) {");
  const end = app.indexOf("function updateSalesCatalogViewport()", start);
  assert.ok(start >= 0 && end > start);
  const row = { isConnected: true, querySelector: () => ({ focus() {} }) };
  const attrs = new Set();
  const page = { hidden: true, scrollTop: 10, style: { setProperty() {} } };
  const quickEntry = { hidden: false, inert: false, setAttribute: (key) => attrs.add(key), removeAttribute: (key) => attrs.delete(key) };
  const bodyClasses = new Set();
  const historyCalls = [];
  const context = {
    getActiveStore: () => ({ inventory: [] }),
    uiState: { salesCatalogRow: null, salesCatalogSearch: "old", salesCatalogFilter: "group:old" },
    els: {
      quickEntryModal: quickEntry,
      salesCatalogPage: page,
      salesCatalogSearch: { value: "old" },
      closeSalesCatalog: { focus() {} },
      appShell: { inert: false, setAttribute() {}, removeAttribute() {} },
      tabBar: { inert: false },
      customersPage: { hidden: true }
    },
    document: { body: { classList: { add: (name) => bodyClasses.add(name), remove: (name) => bodyClasses.delete(name) } } },
    window: {
      location: { hash: "", pathname: "/quanlycuahang/", search: "" },
      history: {
        state: {},
        pushState(state, title, hash) { this.state = state; context.window.location.hash = hash; historyCalls.push("push"); },
        back() { historyCalls.push("back"); }
      }
    },
    USE_MOBILE_APP_THEME: true,
    renderSalesCatalog() {},
    updateSalesCatalogViewport() {},
    updateTimeFiltersVisibility() {}
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.openSalesCatalogPage(row);
  assert.equal(page.hidden, false);
  assert.equal(context.uiState.salesCatalogRow, row);
  assert.equal(quickEntry.inert, true);
  assert.ok(attrs.has("aria-hidden"));
  assert.ok(bodyClasses.has("sales-catalog-page-open"));
  assert.equal(context.window.location.hash, "#sales-catalog");
  context.closeSalesCatalogPage();
  assert.deepEqual(historyCalls, ["push", "back"]);
  context.window.location.hash = "";
  context.hideSalesCatalogPage();
  assert.equal(page.hidden, true);
  assert.equal(quickEntry.inert, false);
  assert.equal(context.uiState.salesCatalogRow, row);
  assert.ok(!attrs.has("aria-hidden"));
});

test("catalog shows real stock totals and never enables out-of-stock items", () => {
  const start = app.indexOf("function renderSalesCatalog() {");
  const end = app.indexOf("function selectSalesCatalogItem(itemId)", start);
  assert.ok(start >= 0 && end > start);
  const elements = Object.fromEntries(["salesCatalogList", "salesCatalogFilter", "salesCatalogCount", "salesCatalogTotalCount", "salesCatalogAvailableCount", "salesCatalogGroupCount"].map((id) => [id, { innerHTML: "", textContent: "", value: "" }]));
  const store = { inventory: [
    { id: "a", name: "Tắm VS 3kg", groupName: "Spa", quantity: 1, salePrice: 150000 },
    { id: "b", name: "Sản phẩm đã hết", groupName: "Spa", quantity: 0, salePrice: 10000 }
  ] };
  const context = {
    getActiveStore: () => store,
    els: elements,
    uiState: { salesCatalogFilter: "all", salesCatalogSearch: "" },
    normalizeSearchText: (value) => String(value).toLowerCase(),
    escapeHtml: (value) => String(value),
    formatCurrency: (value) => `${value} đ`,
    getInventorySalePrice: (item) => item.salePrice
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.renderSalesCatalog();
  assert.equal(elements.salesCatalogTotalCount.textContent, "2");
  assert.equal(elements.salesCatalogAvailableCount.textContent, "1");
  assert.equal(elements.salesCatalogGroupCount.textContent, "1");
  assert.match(elements.salesCatalogList.innerHTML, /Tắm VS 3kg/);
  assert.match(elements.salesCatalogList.innerHTML, /aria-disabled="true"/);
  assert.match(elements.salesCatalogList.innerHTML, /Hết hàng/);
  context.uiState.salesCatalogSearch = "không có";
  context.renderSalesCatalog();
  assert.match(elements.salesCatalogList.innerHTML, /Chưa tìm thấy hàng hoá/);
});

test("choosing goods updates only the current sales row and keeps the order draft", () => {
  const start = app.indexOf("function selectSalesCatalogItem(itemId) {");
  const end = app.indexOf("function openSalesCustomerCatalogModal()", start);
  assert.ok(start >= 0 && end > start);
  const fields = Object.fromEntries(["name", "price", "quantity", "discount", "discountAmount"].map((name) => [name, { value: "old" }]));
  const row = { dataset: {}, querySelector: (selector) => fields[selector.match(/data-sales-item="([^"]+)"/)[1]] };
  const customer = { name: "Khách đang soạn", phone: "012345" };
  let closed = 0;
  let totals = 0;
  const context = {
    getActiveStore: () => ({ inventory: [{ id: "a", name: "Tắm VS 3kg", quantity: 1, salePrice: 150000 }, { id: "b", name: "Hết hàng", quantity: 0, salePrice: 10000 }] }),
    uiState: { salesCatalogRow: row },
    getInventorySalePrice: (item) => item.salePrice,
    formatAmountInput: (amount) => String(amount),
    updateSalesOrderTotal: () => { totals++; },
    closeSalesCatalogPage: () => { closed++; },
    customer
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.selectSalesCatalogItem("b");
  assert.equal(closed, 0);
  context.selectSalesCatalogItem("a");
  assert.equal(fields.name.value, "Tắm VS 3kg");
  assert.equal(fields.price.value, "150000");
  assert.equal(fields.quantity.value, 1);
  assert.equal(row.dataset.originalPrice, "150000");
  assert.deepEqual(customer, { name: "Khách đang soạn", phone: "012345" });
  assert.equal(totals, 1);
  assert.equal(closed, 1);
});

test("catalog page scrolls a focused search control into the keyboard viewport", () => {
  const start = app.indexOf("function updateSalesCatalogViewport() {");
  const end = app.indexOf("function renderSalesCatalog()", start);
  assert.ok(start >= 0 && end > start);
  const input = { getBoundingClientRect: () => ({ top: 380, bottom: 430 }) };
  const page = {
    hidden: false,
    scrollTop: 0,
    style: { setProperty() {} },
    contains: (target) => target === input,
    getBoundingClientRect: () => ({ top: 0, bottom: 400 })
  };
  const context = {
    USE_MOBILE_APP_THEME: true,
    els: { salesCatalogPage: page },
    document: { activeElement: input },
    window: { innerHeight: 400, visualViewport: { height: 400, offsetTop: 0 } }
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.updateSalesCatalogViewport();
  assert.equal(page.scrollTop, 48);
});
