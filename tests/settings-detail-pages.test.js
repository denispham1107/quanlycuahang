const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("employee and activity history open as accessible full pages", () => {
  assert.match(html, /<main class="settings-detail-page" id="employeeManagerPage" aria-labelledby="employeeManagerTitle" hidden>/);
  assert.match(html, /<main class="settings-detail-page" id="activityHistoryPage" aria-labelledby="activityHistoryTitle" hidden>/);
  assert.doesNotMatch(html, /id="(?:employeeManager|activityHistory)Modal"/);
  assert.match(html, /id="closeEmployeeManager"[^>]*>.*Quay lại/);
  assert.match(html, /id="closeActivityHistory"[^>]*>.*Quay lại/);
  for (const id of ["employeeCreateForm", "employeeAccountList", "activityHistoryRangeMode", "activityHistoryAreaFilter", "activityHistoryActorFilter", "activityHistoryList"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("settings pages use browser history, role guards and restore the app on exit", () => {
  assert.match(app, /function openEmployeeManagerPage\(\{ fromHistory = false \} = \{\}\)/);
  assert.match(app, /if \(!isAdminUser\(\) \|\| !els\.employeeManagerPage\) return;/);
  assert.match(app, /pushState\(\{ \.\.\.window\.history\.state, employeeManagerPage: true \}, "", "#employees"\)/);
  assert.match(app, /pushState\(\{ \.\.\.window\.history\.state, activityHistoryPage: true \}, "", "#activity-history"\)/);
  assert.match(app, /if \(isEmployeeUser\(\) && !employeeCan\("history", "viewOwn"\)\) return;/);
  assert.match(app, /function finishSettingsDetailPageClose\(\)/);
  assert.match(app, /els\.appShell\.inert = anotherPageOpen;/);
  assert.match(app, /window\.visualViewport\?\.addEventListener\("resize", updateSettingsDetailViewport\)/);
  assert.match(app, /hideEmployeeManagerPage\(\{ restoreFocus: false \}\);\s*hideActivityHistoryPage\(\{ restoreFocus: false \}\);/);
});

test("mobile page layout has bounded fields and one-column filters", () => {
  assert.match(css, /\.settings-detail-page\[hidden\]\s*\{ display: none; \}/);
  assert.match(css, /\.settings-detail-card input:not\(\[type="checkbox"\]\),\s*\.settings-detail-card select\s*\{ width: 100%; min-width: 0; \}/);
  assert.match(css, /\.settings-detail-card \.activity-history-custom-range\s*\{ grid-column: 1 \/ -1; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /@media \(max-width: 700px\)\s*\{[\s\S]*?\.settings-detail-card \.activity-history-custom-range\s*\{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /body\.settings-detail-page-open > #tabBar,/);
  assert.match(css, /html\.mobile-app-theme \.settings-detail-card\.employee-manager-card,\s*html\.mobile-app-theme \.settings-detail-card\.activity-history-card\s*\{\s*max-width: 100%;/);
});
