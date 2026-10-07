const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

function pngSize(name) {
  const buffer = fs.readFileSync(path.join(root, "icons", name));
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${name} is not PNG`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("desktop, Android and iOS installation icons use the approved store-chart set", () => {
  const expected = [
    ["icon-v3-192.png", 192, "any"],
    ["icon-v3-512.png", 512, "any"],
    ["icon-v3-maskable-512.png", 512, "maskable"],
  ];
  for (const [name, size, purpose] of expected) {
    assert.deepEqual(pngSize(name), [size, size]);
    assert.ok(manifest.icons.some((icon) => icon.src === `icons/${name}` && icon.sizes === `${size}x${size}` && icon.purpose === purpose));
    assert.ok(worker.includes(`./icons/${name}`));
  }
  assert.deepEqual(pngSize("apple-touch-icon-v3.png"), [180, 180]);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="icons\/apple-touch-icon-v3\.png"/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="icons\/icon-v3\.svg"/);
  assert.match(html, /rel="manifest" href="manifest\.webmanifest\?v=107"/);
  assert.match(worker, /\.\/manifest\.webmanifest\?v=107/);
  assert.match(worker, /\.\/icons\/icon-v3\.svg/);
  assert.ok(!fs.readFileSync(path.join(root, "icons", "icon-v3-512.png"))
    .equals(fs.readFileSync(path.join(root, "icons", "icon-v3-maskable-512.png"))));
});
