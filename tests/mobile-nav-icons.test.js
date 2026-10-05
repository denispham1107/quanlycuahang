const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("four primary mobile tabs have distinct detailed two-tone SVGs", () => {
  const icons = new Set();
  for (const tab of ["stores", "overview", "income", "expense"]) {
    const button = html.match(new RegExp(`<button class="tab-button[^\"]*"[^>]*data-tab="${tab}"[\\s\\S]*?<\\/button>`))?.[0];
    assert.ok(button, `Missing ${tab} tab`);
    const icon = button.match(/<span class="tab-icon"[^>]*><svg viewBox="0 0 32 32">([\s\S]*?)<\/svg><\/span>/)?.[1];
    assert.ok(icon, `${tab} needs its own 32x32 mobile SVG`);
    assert.ok((icon.match(/<(?:path|rect|circle)\b/g) || []).length >= 3, `${tab} icon lacks detail`);
    assert.match(icon, /class="icon-accent"/);
    icons.add(icon);
    assert.match(button, /class="desktop-tab-icon"/);
  }
  assert.equal(icons.size, 4);
});

test("mobile icon colors have selected and compact landscape states without touching desktop", () => {
  assert.match(css, /html\.mobile-app-theme \.tab-button\[data-tab="stores"\] \{ --mobile-nav-icon-ink:/);
  assert.match(css, /html\.mobile-app-theme \.tab-button\[data-tab="expense"\] \{ --mobile-nav-icon-ink:/);
  assert.match(css, /\.tab-icon \.icon-accent \{ stroke: var\(--mobile-nav-icon-accent\)/);
  assert.match(css, /\.tab-icon \.icon-accent-fill \{ fill: var\(--mobile-nav-icon-accent\)/);
  assert.match(css, /\.active \{\s*--mobile-nav-icon-ink: #fff;\s*--mobile-nav-icon-accent: #fff;/);
  assert.match(css, /@media \(orientation: landscape\) \{[\s\S]*flex-basis: 23px;/);
  assert.match(css, /html:not\(\.mobile-app-theme\) \.desktop-nav-host \.desktop-tab-icon/);
});
