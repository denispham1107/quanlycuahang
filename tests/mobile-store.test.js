const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("mobile Store dashboard keeps its create, rename, delete and switch controls", () => {
  assert.match(html, /id="mobileAddStoreToggle"[^>]+aria-controls="storeForm"[^>]+aria-expanded="false"/);
  assert.match(html, /id="storeHeroEntryCount"/);
  assert.match(html, /id="storeHeroTotalCount"/);
  assert.match(html, /id="renameStore"/);
  assert.match(html, /id="deleteStore"/);
  assert.match(css, /html\.mobile-app-theme #storeForm\.is-open\s*\{\s*display: grid;/);
  assert.match(css, /html\.mobile-app-theme \[data-tab-panel="stores"\] > \.toolbar/);
  assert.match(app, /els\.mobileAddStoreToggle\.addEventListener\("click"/);
  assert.match(app, /els\.storeHeroEntryCount\.textContent = `\$\{store\.entries\.length\} dòng`/);
});

test("Store list shows active state and counts while escaping names", () => {
  const start = app.indexOf("function renderStores() {");
  const end = app.indexOf("function setDefaultEntryDates()", start);
  assert.ok(start >= 0 && end > start);
  const context = {
    state: {
      activeStoreId: "store-1",
      stores: [
        { id: "store-1", name: "Cù Lao <Petshop>", entries: [{}, {}] },
        { id: "store-2", name: "Hào vị quán", entries: [{}] }
      ]
    },
    els: { storeList: { innerHTML: "" } },
    escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  context.renderStores();
  assert.match(context.els.storeList.innerHTML, /aria-pressed="true"/);
  assert.match(context.els.storeList.innerHTML, /Cù Lao &lt;Petshop&gt;/);
  assert.match(context.els.storeList.innerHTML, /Đang chọn · 2 dòng dữ liệu/);
  assert.match(context.els.storeList.innerHTML, /Hào vị quán/);
  assert.match(context.els.storeList.innerHTML, /1 dòng dữ liệu/);
  assert.doesNotMatch(context.els.storeList.innerHTML, /Cù Lao <Petshop>/);
});
