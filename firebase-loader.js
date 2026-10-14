(function () {
  "use strict";
  let pending = null;
  let attempts = 0;
  const base = "https://www.gstatic.com/firebasejs/10.12.5/";
  function load(file, available, attempt) {
    if (available()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let finished = false;
      const finish = error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); } else resolve();
      };
      const timer = setTimeout(() => finish(new Error("Tải Firebase quá thời gian chờ.")), 10000);
      // A removed script may leave its HTTP request in flight; don't reuse that stalled request.
      script.src = base + file + (attempt > 1 ? `?retry=${attempt}` : "");
      script.async = true;
      script.onload = () => finish(available() ? null : new Error("Firebase chưa khởi tạo đầy đủ."));
      script.onerror = () => finish(new Error("Không tải được Firebase. Kiểm tra mạng rồi thử lại."));
      document.head.append(script);
    });
  }
  window.ensureFirebaseSdk = function () {
    if (window.firebase?.auth && window.firebase?.firestore) return Promise.resolve();
    if (pending) return pending;
    const attempt = ++attempts;
    pending = (async () => {
      await load("firebase-app-compat.js", () => Boolean(window.firebase?.initializeApp), attempt);
      await Promise.all([
        load("firebase-auth-compat.js", () => Boolean(window.firebase?.auth), attempt),
        load("firebase-firestore-compat.js", () => Boolean(window.firebase?.firestore), attempt)
      ]);
    })().finally(() => { pending = null; });
    return pending;
  };
})();
