"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const OpenAI = require("openai");

admin.initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const ADMIN_PIN = defineSecret("ADMIN_PIN");

const db = admin.firestore();
const REGION = process.env.FUNCTION_REGION || "asia-southeast1";
const APP_STATE_COLLECTION = process.env.APP_STATE_COLLECTION || "quanlycuahang";
const APP_STATE_DOCUMENT = process.env.APP_STATE_DOCUMENT || "shared-state";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_CHARS = 14000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const allowedOrigins = new Set([
  "https://denispham1107.github.io",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5500"
]);

const rateBuckets = new Map();

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin || "*");
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Pin");
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

function getClientIp(req) {
  return (
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.ip ||
    "unknown"
  );
}

function checkRateLimit(key) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}

async function requireAdmin(req) {
  const authHeader = String(req.headers.authorization || "");
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.admin === true || decoded.email_verified === true) {
      return { userId: decoded.uid, authMode: "firebase_auth" };
    }
  }

  const expectedPin = ADMIN_PIN.value();
  const pin = String(req.body?.pin || req.headers["x-admin-pin"] || "");
  if (expectedPin && pin && pin === expectedPin) {
    return { userId: "admin_pin", authMode: "admin_pin" };
  }

  const error = new Error("UNAUTHORIZED");
  error.status = 401;
  throw error;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function toDateKey(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value.toDate) return value.toDate().toISOString().slice(0, 10);
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch (error) {
    return "";
  }
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function limited(items, limit = 80) {
  return Array.isArray(items) ? items.slice(-limit) : [];
}

function getActiveStore(state) {
  const stores = Array.isArray(state?.stores) ? state.stores : [];
  return stores.find((store) => store.id === state.activeStoreId) || stores[0] || null;
}

function categoryName(store, type, categoryId) {
  const categories = store?.categories?.[type] || [];
  return categories.find((category) => category.id === categoryId)?.name || "";
}

function orderTotal(order) {
  if (typeof order.total === "number") return order.total;
  if (typeof order.remainingTotal === "number") return order.remainingTotal;
  const items = Array.isArray(order.items) ? order.items : [];
  const total = items.reduce((sum, item) => sum + money(item.price) * money(item.quantity || 1), 0);
  return Math.max(0, total - money(order.discountAmount));
}

function detectContextNeed(message) {
  const text = normalizeText(message);
  return {
    inventory: /ton kho|kho|hang hoa|san pham|het hang/.test(text),
    customers: /khach|thanh vien|vip|so dien thoai/.test(text),
    orders: /don hang|ban hang|bill|ban chay|doanh thu ban/.test(text),
    income: /thu|doanh thu|khoan thu/.test(text),
    expense: /chi|chi phi|khoan chi|lo|loi nhuan/.test(text),
    overview: /tong quan|bao cao|hom nay|thang|tuan|loi nhuan|lai|lo/.test(text)
  };
}

function buildContext(state, message) {
  const store = getActiveStore(state);
  if (!store) {
    return { notice: "Chưa có cửa hàng trong dữ liệu Firestore." };
  }

  const need = detectContextNeed(message);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const entries = Array.isArray(store.entries) ? store.entries : [];
  const orders = Array.isArray(store.orders) ? store.orders : [];
  const inventory = Array.isArray(store.inventory) ? store.inventory : [];
  const customers = Array.isArray(store.customers) ? store.customers : [];

  const activeEntries = entries.filter((entry) => entry.status !== "cancelled");
  const activeOrders = orders.filter((order) => order.status !== "cancelled");
  const incomeEntries = activeEntries.filter((entry) => entry.type === "income");
  const expenseEntries = activeEntries.filter((entry) => entry.type === "expense");
  const todayIncome = incomeEntries.filter((entry) => entry.date === today).reduce((sum, entry) => sum + money(entry.amount), 0);
  const todayExpense = expenseEntries.filter((entry) => entry.date === today).reduce((sum, entry) => sum + money(entry.amount), 0);
  const todaySales = activeOrders.filter((order) => toDateKey(order.date) === today).reduce((sum, order) => sum + orderTotal(order), 0);
  const monthIncome = incomeEntries.filter((entry) => String(entry.date || "").startsWith(month)).reduce((sum, entry) => sum + money(entry.amount), 0);
  const monthExpense = expenseEntries.filter((entry) => String(entry.date || "").startsWith(month)).reduce((sum, entry) => sum + money(entry.amount), 0);
  const monthSales = activeOrders.filter((order) => toDateKey(order.date).startsWith(month)).reduce((sum, order) => sum + orderTotal(order), 0);

  const context = {
    store: {
      id: store.id,
      name: store.name,
      today,
      summary: {
        todayIncome,
        todayExpense,
        todaySales,
        todayProfitEstimate: todayIncome + todaySales - todayExpense,
        monthIncome,
        monthExpense,
        monthSales,
        monthProfitEstimate: monthIncome + monthSales - monthExpense,
        inventoryCount: inventory.length,
        customerCount: customers.length,
        orderCount: activeOrders.length
      }
    }
  };

  if (need.income || need.expense || need.overview) {
    context.transactions = limited(activeEntries, 100).map((entry) => ({
      id: entry.id,
      type: entry.type,
      date: entry.date,
      category: categoryName(store, entry.type, entry.categoryId) || entry.categoryName || "",
      note: entry.note || "",
      amount: money(entry.amount)
    }));
  }

  if (need.orders || need.overview) {
    context.orders = limited(activeOrders, 80).map((order) => ({
      id: order.id,
      date: toDateKey(order.date),
      time: order.time || "",
      customerName: order.customerName || "",
      customerPhone: order.customerPhone || "",
      total: orderTotal(order),
      discountAmount: money(order.discountAmount),
      items: limited(order.items, 20).map((item) => ({
        name: item.name,
        groupName: item.groupName || "",
        quantity: money(item.quantity || 1),
        price: money(item.price),
        originalPrice: money(item.originalPrice || item.price)
      }))
    }));
  }

  if (need.inventory || need.orders || need.overview) {
    context.inventory = limited(inventory, 100).map((item) => ({
      id: item.id,
      name: item.name,
      groupName: item.groupName || "",
      quantity: money(item.quantity),
      costPrice: money(item.price),
      salePrice: money(item.salePrice || item.price),
      valueAtCost: money(item.quantity) * money(item.price),
      updatedAt: item.updatedAt || ""
    }));
  }

  if (need.customers || need.orders) {
    context.customers = limited(customers, 100).map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone || "",
      memberTier: customer.memberTier || "Thường",
      createdAt: customer.createdAt || ""
    }));
  }

  const serialized = JSON.stringify(context);
  if (serialized.length <= MAX_CONTEXT_CHARS) return context;
  return {
    ...context,
    note: "Context đã được rút gọn vì dữ liệu cửa hàng lớn."
  };
}

function getOutputText(response) {
  if (response.output_text) return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function parseAIEnvelope(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.reply === "string") {
      return {
        reply: parsed.reply,
        actions: Array.isArray(parsed.actions) ? parsed.actions : []
      };
    }
  } catch (error) {
    // Plain text responses are acceptable.
  }
  return { reply: text, actions: [] };
}

async function loadSharedState() {
  const snapshot = await db.collection(APP_STATE_COLLECTION).doc(APP_STATE_DOCUMENT).get();
  return snapshot.exists ? snapshot.data().state || snapshot.data() : {};
}

exports.chatWithAI = onRequest(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: [OPENAI_API_KEY, ADMIN_PIN]
  },
  async (req, res) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      sendError(res, 405, "Chỉ hỗ trợ POST.");
      return;
    }

    try {
      const adminUser = await requireAdmin(req);
      const rateKey = `${adminUser.userId}:${getClientIp(req)}`;
      if (!checkRateLimit(rateKey)) {
        sendError(res, 429, "Bạn gửi quá nhanh. Vui lòng thử lại sau một phút.");
        return;
      }

      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId.slice(0, 120) : "";
      const mode = req.body?.mode === "propose_action" ? "propose_action" : "read_only";

      if (!message) {
        sendError(res, 400, "message là bắt buộc.");
        return;
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        sendError(res, 400, `message tối đa ${MAX_MESSAGE_LENGTH} ký tự.`);
        return;
      }

      const state = await loadSharedState();
      const context = buildContext(state, message);
      const systemPrompt = [
        "Bạn là trợ lý quản lý cửa hàng cho website quản lý cửa hàng của chủ shop.",
        "Bạn có thể phân tích thu chi, doanh thu, lợi nhuận, tồn kho, đơn hàng, sản phẩm và khách hàng dựa trên dữ liệu Firestore được cung cấp.",
        "Không bịa số liệu nếu không có dữ liệu. Nếu thiếu dữ liệu hãy nói rõ: Chưa có đủ dữ liệu để kết luận.",
        "Với các hành động thêm/sửa/xóa dữ liệu, không tự ý thực hiện ngay. Hãy tạo đề xuất hành động để chủ shop xác nhận.",
        "Trả lời bằng tiếng Việt, rõ ràng, ngắn gọn, có số liệu khi có dữ liệu.",
        mode === "propose_action"
          ? "Nếu cần đề xuất thao tác, trả về JSON hợp lệ dạng {\"reply\":\"...\",\"actions\":[{\"type\":\"create_transaction\",\"payload\":{...}}]}. Không thực hiện thao tác nguy hiểm như xóa toàn bộ dữ liệu."
          : "Chế độ hiện tại là read_only: chỉ trả lời, actions phải là mảng rỗng."
      ].join(" ");

      const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
      const response = await client.responses.create({
        model: OPENAI_MODEL,
        temperature: 0.2,
        input: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Dữ liệu cửa hàng đã được rút gọn:\n${JSON.stringify(context)}`
          },
          { role: "user", content: message }
        ]
      });

      const envelope = parseAIEnvelope(getOutputText(response));
      const actionRefs = [];
      if (mode === "propose_action") {
        for (const action of envelope.actions.slice(0, 5)) {
          const actionRef = await db.collection("ai_action_requests").add({
            type: action.type || "unknown",
            status: "pending_confirmation",
            payload: action.payload || {},
            conversationId,
            userId: adminUser.userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          actionRefs.push({ id: actionRef.id, ...action, status: "pending_confirmation" });
        }
      }

      await db.collection("ai_logs").add({
        conversationId,
        userId: adminUser.userId,
        mode,
        message,
        reply: envelope.reply,
        actionCount: actionRefs.length,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        reply: envelope.reply,
        actions: actionRefs,
        usage: response.usage || null
      });
    } catch (error) {
      const status = error.status || (error.message === "UNAUTHORIZED" ? 401 : 500);
      sendError(res, status, status === 401 ? "Bạn chưa được phép dùng AI." : "AI tạm thời không phản hồi. Vui lòng thử lại.");
    }
  }
);

exports.confirmAIAction = onRequest(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: [ADMIN_PIN]
  },
  async (req, res) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      sendError(res, 405, "Chỉ hỗ trợ POST.");
      return;
    }

    try {
      const adminUser = await requireAdmin(req);
      const actionId = typeof req.body?.actionId === "string" ? req.body.actionId.trim() : "";
      if (!actionId) {
        sendError(res, 400, "actionId là bắt buộc.");
        return;
      }

      const actionRef = db.collection("ai_action_requests").doc(actionId);
      await db.runTransaction(async (transaction) => {
        const actionSnap = await transaction.get(actionRef);
        if (!actionSnap.exists) throw Object.assign(new Error("ACTION_NOT_FOUND"), { status: 404 });
        const action = actionSnap.data();
        if (action.status !== "pending_confirmation") {
          throw Object.assign(new Error("ACTION_DONE"), { status: 409 });
        }

        if (action.type !== "create_transaction") {
          throw Object.assign(new Error("UNSUPPORTED_ACTION"), { status: 400 });
        }

        const stateRef = db.collection(APP_STATE_COLLECTION).doc(APP_STATE_DOCUMENT);
        const stateSnap = await transaction.get(stateRef);
        const root = stateSnap.exists ? stateSnap.data() : {};
        const state = root.state || root || { stores: [] };
        const store = getActiveStore(state);
        if (!store) throw Object.assign(new Error("NO_STORE"), { status: 400 });

        const payload = action.payload || {};
        const type = payload.kind === "expense" ? "expense" : "income";
        const categoryNameValue = String(payload.category || payload.categoryName || "AI").trim();
        store.categories = store.categories || { income: [], expense: [] };
        store.categories[type] = store.categories[type] || [];
        let category = store.categories[type].find((item) => normalizeText(item.name) === normalizeText(categoryNameValue));
        if (!category) {
          category = { id: `ai-${Date.now()}`, name: categoryNameValue };
          store.categories[type].push(category);
        }
        store.entries = store.entries || [];
        store.entries.push({
          id: `ai-entry-${Date.now()}`,
          type,
          categoryId: category.id,
          note: String(payload.note || "Tạo từ AI").slice(0, 200),
          amount: money(payload.amount),
          date: toDateKey(payload.date) || new Date().toISOString().slice(0, 10),
          status: "active",
          createdAt: new Date().toISOString()
        });

        transaction.set(
          stateRef,
          {
            state,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        transaction.update(actionRef, {
          status: "done",
          completedBy: adminUser.userId,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await db.collection("ai_logs").add({
        actionId,
        userId: adminUser.userId,
        event: "confirm_ai_action",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ ok: true, message: "Đã thực hiện thao tác AI và cập nhật Firestore." });
    } catch (error) {
      const status = error.status || (error.message === "UNAUTHORIZED" ? 401 : 500);
      const messages = {
        ACTION_NOT_FOUND: "Không tìm thấy thao tác AI.",
        ACTION_DONE: "Thao tác này đã được xử lý.",
        UNSUPPORTED_ACTION: "Loại thao tác này chưa được hỗ trợ tự động.",
        NO_STORE: "Chưa có cửa hàng để cập nhật."
      };
      sendError(res, status, messages[error.message] || (status === 401 ? "Bạn chưa được phép xác nhận." : "Không thể xác nhận thao tác."));
    }
  }
);
