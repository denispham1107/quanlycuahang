const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createWorker() {
  const listeners = {};
  const stored = new Map();
  let fetchCount = 0;
  let offline = false;
  let slow = false;
  const caches = {
    match: async (request) => stored.get(request.url),
    open: async () => ({
      put: async (request, response) => stored.set(request.url, response)
    })
  };
  const context = {
    URL,
    Response,
    caches,
    self: {
      location: { origin: "https://example.com" },
      addEventListener: (type, handler) => { listeners[type] = handler; }
    },
    fetch: async (request) => {
      fetchCount += 1;
      if (offline) throw new Error("offline");
      if (slow) return new Promise(() => {});
      const response = { ok: true, type: request.url.includes("gstatic.com") ? "opaque" : "basic" };
      response.clone = () => response;
      return response;
    }
  };
  const code = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");
  vm.runInNewContext(code, context);
  return {
    async request(url, destination, mode = "no-cors") {
      let response;
      listeners.fetch({
        request: { url, method: "GET", destination, mode },
        waitUntil: () => {},
        respondWith: (promise) => { response = promise; }
      });
      return response;
    },
    get fetchCount() { return fetchCount; },
    goOffline() { offline = true; },
    goSlow() { slow = true; }
  };
}

test("Firebase SDK scripts are cached for later PWA launches", async () => {
  const worker = createWorker();
  const url = "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js";
  assert.ok(await worker.request(url, "script"));
  assert.ok(await worker.request(url, "script"));
  assert.equal(worker.fetchCount, 1);
});

test("stylesheet uses the network when available and cached copy when offline", async () => {
  const worker = createWorker();
  const url = "https://example.com/styles.css";
  assert.ok(await worker.request(url, "style"));
  assert.ok(await worker.request(url, "style"));
  assert.equal(worker.fetchCount, 2);
  worker.goOffline();
  assert.ok(await worker.request(url, "style"));
});

test("a cached page opens while the network request is stalled", async () => {
  const worker = createWorker();
  const url = "https://example.com/";
  assert.ok(await worker.request(url, "document", "navigate"));
  worker.goSlow();
  assert.ok(await Promise.race([
    worker.request(url, "document", "navigate"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("cached page blocked")), 100))
  ]));
});
