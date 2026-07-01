"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const OpenAI = require("openai");

admin.initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const ADMIN_PIN = defineSecret("ADMIN_PIN");

const db = admin.firestore();
const REGION = process.env.FUNCTION_REGION || "asia-southeast1";
const APP_STATE_COLLECTION = process.env.APP_STATE_COLLECTION || "quanlycuahang";
const APP_STATE_DOCUMENT = process.env.APP_STATE_DOCUMENT || "shared-state";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_CHARS = Number(process.env.MAX_AI_CONTEXT_CHARS || 60000);
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

function getPublicError(error) {
  const status = error?.status || error?.code || 500;
  const message = String(error?.message || "");
  const type = String(error?.type || "");

  if (message === "UNAUTHORIZED") {
    return {
      status: 401,
      message: "Ban chua duoc phep dung AI. Hay nhap dung PIN admin roi thu lai."
    };
  }

  if (status === 401 || /invalid api key|incorrect api key|unauthorized/i.test(message)) {
    return {
      status: 500,
      message: "OpenAI API key chua dung hoac chua duoc cau hinh dung trong Firebase Secret Manager."
    };
  }

  if (status === 429 || /quota|rate limit|billing|insufficient_quota/i.test(`${message} ${type}`)) {
    return {
      status: 500,
      message: "OpenAI dang bi gioi han quota/rate limit hoac tai khoan OpenAI chua bat thanh toan."
    };
  }

  if (status === 404 || /model/i.test(message)) {
    return {
      status: 500,
      message: `Model OpenAI "${OPENAI_MODEL}" chua dung duoc voi API key hien tai. Hay doi OPENAI_MODEL hoac kiem tra quyen model.`
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: "AI tam thoi khong phan hoi. Vui long kiem tra Firebase Functions log roi thu lai."
  };
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
    .replace(/Ä‘/g, "d");
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
    inventory: true,
    customers: true,
    orders: true,
    income: true,
    expense: true,
    overview: true,
    matchedText: text
  };
}

function buildContext(state, message) {
  const store = getActiveStore(state);
  if (!store) {
    return { notice: "ChÆ°a cÃ³ cá»­a hÃ ng trong dá»¯ liá»‡u Firestore." };
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
    schema: {
      rootKeys: Object.keys(state || {}),
      storeKeys: Object.keys(store || {}),
      storeCount: Array.isArray(state && state.stores) ? state.stores.length : 0,
      counts: {
        entries: entries.length,
        orders: orders.length,
        inventory: inventory.length,
        customers: customers.length,
        incomeCategories: Array.isArray(store.incomeCategories) ? store.incomeCategories.length : 0,
        expenseCategories: Array.isArray(store.expenseCategories) ? store.expenseCategories.length : 0,
        inventoryLogs: Array.isArray(store.inventoryLogs) ? store.inventoryLogs.length : 0,
        savedOrders: Array.isArray(store.savedOrders) ? store.savedOrders.length : 0
      }
    },
    allStores: limited(Array.isArray(state && state.stores) ? state.stores : [], 50).map((item) => ({
      id: item.id,
      name: item.name,
      keys: Object.keys(item || {}),
      entries: Array.isArray(item.entries) ? item.entries.length : 0,
      orders: Array.isArray(item.orders) ? item.orders.length : 0,
      inventory: Array.isArray(item.inventory) ? item.inventory.length : 0,
      customers: Array.isArray(item.customers) ? item.customers.length : 0
    })),
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

  const fullStateJson = JSON.stringify(state || {});
  if (fullStateJson.length <= MAX_CONTEXT_CHARS) {
    context.fullState = state;
  } else {
    context.fullStateNote = "Full Firestore state is larger than MAX_AI_CONTEXT_CHARS, so the assistant receives schema, counts, summaries and high-limit arrays instead.";
  }

  if (need.income || need.expense || need.overview) {
    context.transactions = limited(activeEntries, 1000).map((entry) => ({
      id: entry.id,
      type: entry.type,
      date: entry.date,
      category: categoryName(store, entry.type, entry.categoryId) || entry.categoryName || "",
      note: entry.note || "",
      amount: money(entry.amount)
    }));
  }

  if (need.orders || need.overview) {
    context.orders = limited(activeOrders, 1000).map((order) => ({
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
    context.inventory = limited(inventory, 1000).map((item) => ({
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
    context.customers = limited(customers, 1000).map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone || "",
      memberTier: customer.memberTier || "ThÆ°á»ng",
      createdAt: customer.createdAt || ""
    }));
  }

  const serialized = JSON.stringify(context);
  if (serialized.length <= MAX_CONTEXT_CHARS) return context;
  return {
    ...context,
    note: "Context Ä‘Ã£ Ä‘Æ°á»£c rÃºt gá»n vÃ¬ dá»¯ liá»‡u cá»­a hÃ ng lá»›n."
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
      sendError(res, 405, "Chá»‰ há»— trá»£ POST.");
      return;
    }

    try {
      const adminUser = await requireAdmin(req);
      const rateKey = `${adminUser.userId}:${getClientIp(req)}`;
      if (!checkRateLimit(rateKey)) {
        sendError(res, 429, "Báº¡n gá»­i quÃ¡ nhanh. Vui lÃ²ng thá»­ láº¡i sau má»™t phÃºt.");
        return;
      }

      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId.slice(0, 120) : "";
      const mode = req.body?.mode === "propose_action" ? "propose_action" : "read_only";

      if (!message) {
        sendError(res, 400, "message lÃ  báº¯t buá»™c.");
        return;
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        sendError(res, 400, `message tá»‘i Ä‘a ${MAX_MESSAGE_LENGTH} kÃ½ tá»±.`);
        return;
      }

      const state = await loadSharedState();
      const context = buildContext(state, message);
      const systemPrompt = [
        "Báº¡n lÃ  trá»£ lÃ½ quáº£n lÃ½ cá»­a hÃ ng cho website quáº£n lÃ½ cá»­a hÃ ng cá»§a chá»§ shop.",
        "Báº¡n cÃ³ thá»ƒ phÃ¢n tÃ­ch thu chi, doanh thu, lá»£i nhuáº­n, tá»“n kho, Ä‘Æ¡n hÃ ng, sáº£n pháº©m vÃ  khÃ¡ch hÃ ng dá»±a trÃªn dá»¯ liá»‡u Firestore Ä‘Æ°á»£c cung cáº¥p.",
        "Báº¡n Ä‘Æ°á»£c cung cáº¥p snapshot/schema rá»™ng nháº¥t cÃ³ thá»ƒ cá»§a dá»¯ liá»‡u hiá»‡n táº¡i. Khi website cÃ³ thÃªm trÆ°á»ng hoáº·c chá»©c nÄƒng má»›i, hÃ£y Ä‘á»c schema/fullState Ä‘á»ƒ hiá»ƒu dá»¯ liá»‡u má»›i thay vÃ¬ giáº£ Ä‘á»‹nh.",
        "Báº¡n cÃ³ thá»ƒ phÃ¢n tÃ­ch táº¥t cáº£ module Ä‘ang cÃ³ trong dá»¯ liá»‡u; vá»›i thao tÃ¡c ghi/sá»­a/xÃ³a, chá»‰ táº¡o Ä‘á» xuáº¥t action vÃ  chá» chá»§ shop xÃ¡c nháº­n.",
        "KhÃ´ng bá»‹a sá»‘ liá»‡u náº¿u khÃ´ng cÃ³ dá»¯ liá»‡u. Náº¿u thiáº¿u dá»¯ liá»‡u hÃ£y nÃ³i rÃµ: ChÆ°a cÃ³ Ä‘á»§ dá»¯ liá»‡u Ä‘á»ƒ káº¿t luáº­n.",
        "Vá»›i cÃ¡c hÃ nh Ä‘á»™ng thÃªm/sá»­a/xÃ³a dá»¯ liá»‡u, khÃ´ng tá»± Ã½ thá»±c hiá»‡n ngay. HÃ£y táº¡o Ä‘á» xuáº¥t hÃ nh Ä‘á»™ng Ä‘á»ƒ chá»§ shop xÃ¡c nháº­n.",
        "Tráº£ lá»i báº±ng tiáº¿ng Viá»‡t, rÃµ rÃ ng, ngáº¯n gá»n, cÃ³ sá»‘ liá»‡u khi cÃ³ dá»¯ liá»‡u.",
        mode === "propose_action"
          ? "Náº¿u cáº§n Ä‘á» xuáº¥t thao tÃ¡c, tráº£ vá» JSON há»£p lá»‡ dáº¡ng {\"reply\":\"...\",\"actions\":[{\"type\":\"create_transaction\",\"payload\":{...}}]}. KhÃ´ng thá»±c hiá»‡n thao tÃ¡c nguy hiá»ƒm nhÆ° xÃ³a toÃ n bá»™ dá»¯ liá»‡u."
          : "Cháº¿ Ä‘á»™ hiá»‡n táº¡i lÃ  read_only: chá»‰ tráº£ lá»i, actions pháº£i lÃ  máº£ng rá»—ng."
      ].join(" ");

      const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
      const response = await client.responses.create({
        model: OPENAI_MODEL,
        temperature: 0.2,
        instructions: systemPrompt,
        input: [
          {
            role: "user",
            content: `Dá»¯ liá»‡u cá»­a hÃ ng/schema Firestore hiá»‡n táº¡i:\n${JSON.stringify(context)}`
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
      logger.error("chatWithAI failed", {
        status: error?.status || error?.code || 500,
        type: error?.type || "",
        message: error?.message || ""
      });
      const publicError = getPublicError(error);
      sendError(res, publicError.status, publicError.message);
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
      sendError(res, 405, "Chá»‰ há»— trá»£ POST.");
      return;
    }

    try {
      const adminUser = await requireAdmin(req);
      const actionId = typeof req.body?.actionId === "string" ? req.body.actionId.trim() : "";
      if (!actionId) {
        sendError(res, 400, "actionId lÃ  báº¯t buá»™c.");
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
          note: String(payload.note || "Táº¡o tá»« AI").slice(0, 200),
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

      res.json({ ok: true, message: "ÄÃ£ thá»±c hiá»‡n thao tÃ¡c AI vÃ  cáº­p nháº­t Firestore." });
    } catch (error) {
      const status = error.status || (error.message === "UNAUTHORIZED" ? 401 : 500);
      const messages = {
        ACTION_NOT_FOUND: "KhÃ´ng tÃ¬m tháº¥y thao tÃ¡c AI.",
        ACTION_DONE: "Thao tÃ¡c nÃ y Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½.",
        UNSUPPORTED_ACTION: "Loáº¡i thao tÃ¡c nÃ y chÆ°a Ä‘Æ°á»£c há»— trá»£ tá»± Ä‘á»™ng.",
        NO_STORE: "ChÆ°a cÃ³ cá»­a hÃ ng Ä‘á»ƒ cáº­p nháº­t."
      };
      sendError(res, status, messages[error.message] || (status === 401 ? "Báº¡n chÆ°a Ä‘Æ°á»£c phÃ©p xÃ¡c nháº­n." : "KhÃ´ng thá»ƒ xÃ¡c nháº­n thao tÃ¡c."));
    }
  }
);
