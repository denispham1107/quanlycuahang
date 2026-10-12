const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("mobile purchase fields never share the sales action-button column", () => {
  const start = css.indexOf("/* Purchase has a different set of fields from sales:");
  const end = css.indexOf("/* Mobile Store tab:", start);
  assert.ok(start > css.indexOf(".sales-page-mode .sales-item-row"));
  assert.ok(end > start);
  const layout = css.slice(start, end);
  assert.match(layout, /@media \(max-width: 920px\)/);
  assert.match(layout, /\.purchase-item-row\s*\{\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) 40px;/);

  const positions = {
    name: ["1 / 3", "1"],
    group: ["1 / -1", "2"],
    price: ["1", "5"],
    salePrice: ["2 / -1", "5"]
  };
  for (const [field, [column, row]] of Object.entries(positions)) {
    assert.match(layout, new RegExp(`\\[data-purchase-item="${field}"\\]\\s*\\{\\s*grid-column: ${column.replace("/", "\\/")};\\s*grid-row: ${row};`));
    assert.match(app, new RegExp(`data-purchase-item="${field}"`));
  }
  assert.match(layout, /\.purchase-item-row > \.quantity-stepper\s*\{\s*grid-column: 1 \/ -1;\s*grid-row: 4;/);
  assert.match(layout, /\.purchase-item-row > \.delete-small\s*\{\s*grid-column: 3;\s*grid-row: 1;/);
});

test("desktop purchase stays on one compact row with room for native arrows", () => {
  assert.match(css, /@media \(min-width: 701px\)[\s\S]*grid-template-columns: minmax\(92px,1\.3fr\) minmax\(124px,1\.3fr\) minmax\(104px,\.8fr\)/);
  assert.match(css, /purchase-item-row > \* \{ grid-column: auto; grid-row: 1; \}/);
  assert.match(css, /padding-inline: 8px; font-size: clamp\(11px,1\.05vw,13px\)/);
  assert.match(css, /padding-inline: 8px 24px/);
});

test("valid-line badge has automatic height and an accented-text-safe line box", () => {
  const rule=css.match(/\.bulk-purchase-summary\s*\{([^}]+)\}/)[1];
  for(const expected of ['display: inline-flex','align-items: center','justify-content: center','height: auto','min-height: 40px','line-height: 1.5','padding: 9px 14px','overflow: visible'])assert.ok(rule.includes(expected),expected);
  assert.doesNotMatch(rule,/overflow:\s*hidden/);
});
