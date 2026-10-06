const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

test("the approved flat icon set is shared and optically aligned in desktop and mobile settings", () => {
  const asset = fs.readFileSync(path.join(root, "icons", "settings-flat-v1.webp"));
  assert.equal(asset.toString("ascii", 0, 4), "RIFF");
  assert.equal(asset.toString("ascii", 8, 12), "WEBP");
  assert.match(css, /\.settings-action-icon\s*\{[^}]*background-image:\s*url\("icons\/settings-flat-v1\.webp"\)/);
  assert.match(css, /\.settings-action-icon\s*\{[^}]*flex:\s*0 0 48px;[^}]*width:\s*48px;[^}]*height:\s*48px;/);
  assert.match(css, /\.settings-action-icon\s*\{[^}]*mix-blend-mode:\s*multiply;[^}]*clip-path:\s*inset\(5px 0 6px\)/);
  assert.match(worker, /\.\/icons\/settings-flat-v1\.webp/);

  const menu = html.match(/<div class="settings-actions" id="settingsActions"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/header>/)?.[1];
  assert.ok(menu, "settings menu must use one shared DOM on both platforms");
  const iconCenters = [
    ["import-data-icon", 433, 265],
    ["export-data-icon", 1103.5, 252.5],
    ["employee-manager-icon", 448, 732],
    ["activity-history-icon", 1108, 737]
  ];
  for (const [icon, sourceX, sourceY] of iconCenters) {
    assert.match(menu, new RegExp(`<span class="settings-action-icon ${icon}" aria-hidden="true"><\\/span>`));
    const position = css.match(new RegExp(`\\.${icon}\\s*\\{[^}]*background-position:\\s*(-?\\d+)px\\s+(-?\\d+)px`));
    assert.ok(position, `${icon} needs a sprite position`);
    const centerX = sourceX * (128 / 1536) + Number(position[1]);
    const centerY = sourceY * (128 / 1536) + Number(position[2]);
    assert.ok(Math.abs(centerX - 24) <= 1.5, `${icon} is horizontally off-center`);
    assert.ok(Math.abs(centerY - 24) <= 1.5, `${icon} is vertically off-center`);
  }
  assert.doesNotMatch(menu, /<svg\b/, "the old line icons must not remain in the menu");
});
