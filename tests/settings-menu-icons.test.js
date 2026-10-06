const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

test("the approved glass icon set is shared by desktop and mobile settings", () => {
  const asset = fs.readFileSync(path.join(root, "icons", "settings-glass-v1.webp"));
  assert.equal(asset.toString("ascii", 0, 4), "RIFF");
  assert.equal(asset.toString("ascii", 8, 12), "WEBP");
  assert.match(css, /\.settings-action-icon\s*\{[^}]*background-image:\s*url\("icons\/settings-glass-v1\.webp"\)/);
  assert.match(worker, /\.\/icons\/settings-glass-v1\.webp/);

  const menu = html.match(/<div class="settings-actions" id="settingsActions"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/header>/)?.[1];
  assert.ok(menu, "settings menu must use one shared DOM on both platforms");
  for (const icon of ["import-data-icon", "export-data-icon", "employee-manager-icon", "activity-history-icon"]) {
    assert.match(menu, new RegExp(`<span class="settings-action-icon ${icon}" aria-hidden="true"><\\/span>`));
    assert.match(css, new RegExp(`\\.${icon}\\s*\\{[^}]*background-position:`));
  }
  assert.doesNotMatch(menu, /<svg\b/, "the old line icons must not remain in the menu");
});
