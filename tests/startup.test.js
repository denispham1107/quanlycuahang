const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("function isProfileAccessDenied(");
const end = source.indexOf("function getFirestorePath(", start);
assert.ok(start >= 0 && end > start, "auth startup functions must be present");
const authStartupSource = source.slice(start, end);

function createHarness(loadUserProfile) {
  const calls = [];
  const timers = new Map();
  let nextTimer = 1;
  const auth = {
    currentUser: { uid: "user-1" },
    signOut: async () => calls.push("signOut")
  };
  const window = {
    addEventListener: () => {},
    setTimeout(callback) {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    location: { reload: () => calls.push("reload") }
  };
  const context = {
    window,
    console: { error: () => {}, warn: () => {} },
    authRestoreAttempt: 0,
    authSlowTimer: null,
    authDb: null,
    firebaseAuthInstance: auth,
    authState: { ready: false, user: null, profile: null, role: "" },
    state: { stores: [{ id: "cached" }] },
    STORAGE_KEY: "store-cashbook-v1",
    localStorage: { removeItem: () => calls.push("clearCache") },
    getFirebaseConfig: () => ({ apiKey: "key", projectId: "project" }),
    cloneDefaultData: () => ({ stores: [] }),
    loadUserProfile,
    stopCloudStorage: () => calls.push("stopCloud"),
    showAuthLoading: () => calls.push("loading"),
    showAuthProblem: (message) => calls.push(["problem", message]),
    showLoginScreen: (message) => calls.push(["login", message]),
    applyRoleAccess: () => calls.push("roleAccess"),
    showAuthenticatedApp: () => calls.push("app"),
    initCloudStorage: () => calls.push("cloud")
  };
  vm.createContext(context);
  vm.runInContext(authStartupSource, context);
  return { context, calls, timers, auth };
}

test("restores a valid session without showing the login form", async () => {
  const profile = { role: "admin", displayName: "Admin" };
  const { context, calls } = createHarness(async () => profile);
  await context.restoreAuthenticatedUser({}, { uid: "user-1" });
  assert.equal(context.authState.role, "admin");
  assert.deepEqual(calls, ["stopCloud", "loading", "roleAccess", "app", "cloud"]);
});

test("a slow profile request offers retry but still enters when it finishes", async () => {
  let resolveProfile;
  const { context, calls, timers } = createHarness(() => new Promise((resolve) => { resolveProfile = resolve; }));
  const pending = context.restoreAuthenticatedUser({}, { uid: "user-1" });
  for (const callback of timers.values()) callback();
  assert.equal(calls.some((call) => Array.isArray(call) && call[0] === "problem"), true);
  resolveProfile({ role: "admin" });
  await pending;
  assert.equal(calls.includes("app"), true);
});

test("a network error preserves the signed-in account for retry", async () => {
  const { context, calls } = createHarness(async () => { throw new Error("unavailable"); });
  await context.restoreAuthenticatedUser({}, { uid: "user-1" });
  assert.equal(calls.includes("signOut"), false);
  assert.equal(calls.some((call) => Array.isArray(call) && call[0] === "problem"), true);
});

test("a disabled profile is denied and signed out", async () => {
  const { context, calls } = createHarness(async () => { throw new Error("PROFILE_DISABLED"); });
  await context.restoreAuthenticatedUser({}, { uid: "user-1" });
  assert.equal(calls.includes("signOut"), true);
  assert.equal(calls.some((call) => Array.isArray(call) && call[0] === "login"), true);
});

test("employee startup does not reveal another account's cached store", async () => {
  const { context } = createHarness(async () => ({ role: "employee" }));
  await context.restoreAuthenticatedUser({}, { uid: "user-1" });
  assert.equal(context.state.stores.length, 0);
});

test("retry ignores an older profile response that arrives late", async () => {
  let resolveFirst;
  let requests = 0;
  const { context, calls } = createHarness(() => {
    requests += 1;
    return requests === 1
      ? new Promise((resolve) => { resolveFirst = resolve; })
      : Promise.resolve({ role: "admin" });
  });
  const first = context.restoreAuthenticatedUser({}, { uid: "user-1" });
  await context.restoreAuthenticatedUser({}, { uid: "user-1" });
  resolveFirst({ role: "employee" });
  await first;
  assert.equal(context.authState.role, "admin");
  assert.equal(calls.filter((call) => call === "app").length, 1);
});

test("a blocked localStorage clear cannot trap a signed-out user on startup", async () => {
  const { context, calls, auth } = createHarness(async () => ({ role: "admin" }));
  let observer;
  auth.onAuthStateChanged = (callback) => { observer = callback; };
  context.window.firebase = {
    apps: [],
    initializeApp: () => ({}),
    firestore: () => ({}),
    auth: () => auth
  };
  context.localStorage.removeItem = () => { throw new Error("storage blocked"); };
  await context.initAuthentication();
  observer(null);
  assert.equal(calls.some((call) => Array.isArray(call) && call[0] === "login"), true);
});

test("an empty offline Firestore snapshot never overwrites cloud data", () => {
  const begin = source.indexOf("function initCloudStorage(");
  const end = source.indexOf("function getEmployeeFunctionUrl(", begin);
  assert.ok(begin >= 0 && end > begin);
  let onSnapshot;
  let writes = 0;
  const docRef = {
    onSnapshot: (_options, callback) => {
      onSnapshot = callback;
      return () => {};
    }
  };
  const db = { collection: () => ({ doc: () => docRef }) };
  const context = {
    cloudStore: {},
    window: {
      firebase: {
        apps: [],
        initializeApp: () => ({}),
        firestore: () => db
      }
    },
    console: { error: () => {} },
    getFirebaseConfig: () => ({ apiKey: "key", projectId: "project" }),
    getFirestorePath: () => ({ collection: "data", document: "shared" }),
    updateSyncStatus: () => {},
    isEmployeeUser: () => false,
    saveStateToCloud: () => { writes += 1; }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(begin, end), context);
  context.initCloudStorage();
  onSnapshot({ exists: false, metadata: { fromCache: true } });
  assert.equal(writes, 0);
  onSnapshot({ exists: false, metadata: { fromCache: false } });
  assert.equal(writes, 1);
});
