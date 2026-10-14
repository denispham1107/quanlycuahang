(function (root) {
  "use strict";
  function withDeadline(work, milliseconds = 12000) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        const error = new Error("Kết nối quá thời gian chờ. Hãy thử đồng bộ lại.");
        error.code = "deadline-exceeded";
        reject(error);
      }, milliseconds);
    });
    return Promise.race([Promise.resolve().then(() => work(controller.signal)), timeout])
      .finally(() => clearTimeout(timer));
  }
  function decodeValue(value) {
    if ("nullValue" in value) return null;
    if ("stringValue" in value) return value.stringValue;
    if ("booleanValue" in value) return value.booleanValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("timestampValue" in value) return value.timestampValue;
    if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
    if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
    throw new Error("Kiểu dữ liệu cloud không hợp lệ.");
  }
  function decodeFields(fields) {
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
  }
  function readDocument(config, user, collection, document, milliseconds = 12000) {
    return withDeadline(async signal => {
      if (!config?.projectId || !user?.getIdToken) throw new Error("Chưa xác định được tài khoản cloud.");
      let token = await user.getIdToken();
      if (signal.aborted) throw new Error("Yêu cầu đã hết thời gian chờ.");
      const parts = [collection, document].flatMap(part => String(part).split("/")).map(encodeURIComponent);
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/${parts.join("/")}`;
      const request = () => fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal });
      let response = await request();
      if (response.status === 401 && !signal.aborted) {
        // Refresh an expired cached ID token once; this is still the same authorized, read-only GET.
        token = await user.getIdToken(true);
        if (signal.aborted) throw new Error("Yêu cầu đã hết thời gian chờ.");
        response = await request();
      }
      if (response.status === 404) return { exists: false, metadata: { fromCache: false }, data: () => null };
      const body = await response.json();
      if (!response.ok) {
        const error = new Error(body.error?.message || "Không đọc được dữ liệu cloud.");
        error.code = response.status === 403 ? "permission-denied" : response.status === 401 ? "unauthenticated" : "unavailable";
        throw error;
      }
      if (!body.fields || !body.name) throw new Error("Phản hồi cloud không hợp lệ.");
      const data = decodeFields(body.fields);
      return { exists: true, metadata: { fromCache: false, hasPendingWrites: false }, data: () => data, updateTime: body.updateTime };
    }, milliseconds);
  }
  function readWithFallback(primary, fallback, { delay = 1200, timeout = 15000 } = {}) {
    return withDeadline(() => new Promise((resolve, reject) => {
      let done = false, fallbackStarted = false, failures = 0, timer;
      const finish = (callback, value) => { if (!done) { done = true; clearTimeout(timer); callback(value); } };
      const accept = snapshot => {
        if (snapshot.metadata?.fromCache) return fail(Object.assign(new Error("Chưa xác nhận dữ liệu máy chủ."), { code: "cache-only" }));
        finish(resolve, snapshot);
      };
      const fail = error => {
        if (done) return;
        if (["permission-denied", "unauthenticated", "auth/user-disabled", "auth/user-token-expired", "auth/invalid-user-token"].includes(error?.code)) return finish(reject, error);
        if (++failures >= 2) finish(reject, error);
        else startFallback();
      };
      const startFallback = () => {
        if (done || fallbackStarted) return;
        fallbackStarted = true;
        Promise.resolve().then(fallback).then(accept, fail);
      };
      timer = setTimeout(startFallback, delay);
      Promise.resolve().then(primary).then(accept, fail);
    }), timeout);
  }
  root.CloudSyncCore = { withDeadline, decodeFields, readDocument, readWithFallback };
  if (typeof module !== "undefined" && module.exports) module.exports = root.CloudSyncCore;
})(typeof window !== "undefined" ? window : globalThis);
