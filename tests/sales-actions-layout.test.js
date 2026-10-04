const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("mobile sales actions reserve enough space for the discount label", () => {
  const start = css.indexOf('html.mobile-app-theme .sales-page-mode #quickEntryForm[data-type="sales"] .modal-actions {');
  const end = css.indexOf("/* Purchase has a different set of fields", start);
  assert.ok(start >= 0 && end > start);
  const salesActions = css.slice(start, end);
  assert.match(salesActions, /display: flex;\s*flex-direction: row;\s*flex-wrap: wrap;/);
  assert.match(salesActions, /#openOrderDiscount\s*\{\s*flex: 1\.35 0 112px;\s*min-width: 112px;\s*white-space: normal;/);
  assert.match(salesActions, /#quickEntrySubmit\s*\{\s*order: -1;\s*flex: 0 0 100%;/);
  assert.match(salesActions, /#deleteSalesDraft\s*\{\s*order: 3;\s*flex: 0 0 100%;/);
  assert.match(html, /id="openOrderDiscount"[^>]*>Chiết Khấu<\/button>/);
  assert.match(html, /id="saveSalesDraft"[^>]*>Lưu<\/button>/);
});
