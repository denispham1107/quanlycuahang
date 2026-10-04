const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function lastRule(selector) {
  const start = css.lastIndexOf(selector);
  assert.ok(start >= 0, `Missing ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function color(rule, property) {
  const value = rule.match(new RegExp(`${property}:\\s*(#[0-9a-f]{6});`, "i"))?.[1];
  assert.ok(value, `Missing solid ${property}`);
  return value;
}

function contrast(foreground, background) {
  function luminance(hex) {
    const channels = [1, 3, 5].map((position) => parseInt(hex.slice(position, position + 2), 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("sales, purchase and export stepper buttons keep readable symbols", () => {
  const rule = lastRule(".quantity-stepper .quantity-step,");
  assert.ok(contrast(color(rule, "color"), color(rule, "background")) >= 4.5);
  assert.match(app, /data-sales-quantity-step/);
  assert.match(app, /data-purchase-quantity-step/);
  assert.match(html, /data-export-quantity-step/);
});

test("sales catalog and customer picker icons keep readable colors", () => {
  const catalog = lastRule(".quantity-stepper .quantity-step,");
  const customer = lastRule(".customer-name-picker .catalog-button {");
  assert.ok(contrast(color(catalog, "color"), color(catalog, "background")) >= 4.5);
  assert.ok(contrast(color(customer, "color"), color(customer, "background")) >= 4.5);
  assert.match(app, /data-open-sales-catalog/);
  assert.match(html, /id="openSalesCustomerCatalog"/);
});

test("export reason delete stays legible on its own warning background", () => {
  const rule = lastRule(".export-inventory-card .export-reason-delete {");
  assert.ok(contrast(color(rule, "color"), color(rule, "background")) >= 4.5);
  assert.match(html, /id="deleteExportInventoryReason"/);
});
