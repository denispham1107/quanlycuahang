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
const APP_STATE_COLLECTION =
  process.env.APP_STATE_COLLECTION || process.env.FIRESTORE_COLLECTION || "quanlycuahang";
const APP_STATE_DOCUMENT =
  process.env.APP_STATE_DOCUMENT || process.env.FIRESTORE_DOCUMENT || "shared-state";
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "Asia/Ho_Chi_Minh";
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-5.4";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_ATTACHMENT_COUNT = Number(process.env.MAX_AI_ATTACHMENT_COUNT || 5);
const MAX_ATTACHMENT_CHARS = Number(process.env.MAX_AI_ATTACHMENT_CHARS || 120000);
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

const SYSTEM_PROMPT = [
  "Bạn là trợ lý quản lý cửa hàng.",
  "Quy tắc bắt buộc:",
  "1. Không được tự bịa số liệu.",
  "2. Không được tự thêm tên người, sản phẩm, cửa hàng, ngày tháng, ghi chú nếu dữ liệu hệ thống không cung cấp.",
  "3. Không được tự cộng nhẩm tổng tiền hoặc tổng số lượng.",
  "4. Mọi tổng tiền, tổng số lượng, tồn kho, doanh thu, chi phí, lợi nhuận phải lấy từ kết quả backend đã tính.",
  "5. Nếu backend trả về không có dữ liệu, phải nói “Chưa có dữ liệu phù hợp”, không được tự tạo số liệu mẫu.",
  "6. Nếu câu hỏi thiếu ngày, thiếu cửa hàng hoặc thiếu phạm vi dữ liệu, phải hỏi lại hoặc dùng mặc định rõ ràng.",
  "7. Khi báo cáo, phải ghi rõ cửa hàng, khoảng thời gian, số bản ghi đã dùng, danh sách khoản đã tính và tổng cuối cùng.",
  "8. Nếu có khoản bị nghi trùng, phải báo riêng, không tự xóa trùng nếu người dùng chưa yêu cầu.",
  "9. Khi người dùng yêu cầu không tính trùng, chỉ loại các khoản trùng 100%.",
  "10. Không được kết luận người nào lấy tiền, ăn cắp, chi sai nếu dữ liệu không chứng minh rõ ràng.",
  "Bạn chỉ được diễn giải JSON đã được backend tính sẵn. Không sửa số liệu."
].join("\n");

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin || "*");
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Pin");
}

function sendError(res, status, message, extra = {}) {
  res.status(status).json({ error: message, ...extra });
}

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "unknown";
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
    const decoded = await admin.auth().verifyIdToken(authHeader.slice("Bearer ".length));
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
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value) {
  return `${money(value).toLocaleString("vi-VN")} đ`;
}

function toDateKey(value) {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split("/");
      return `${year}-${month}-${day}`;
    }
    return value.slice(0, 10);
  }
  if (value.toDate) return value.toDate().toISOString().slice(0, 10);
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch (error) {
    return "";
  }
}

function displayDate(ymd) {
  if (!ymd) return "";
  const [year, month, day] = ymd.split("-");
  return `${day}/${month}/${year}`;
}

function vietnamDateParts(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return { year: get("year"), month: get("month"), day: get("day") };
}

function todayKey(timeZone = DEFAULT_TIMEZONE) {
  const parts = vietnamDateParts(new Date(), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00+07:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekStart(dateKey) {
  const date = new Date(`${dateKey}T00:00:00+07:00`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function monthStart(dateKey) {
  return `${dateKey.slice(0, 7)}-01`;
}

function monthEnd(dateKey) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function previousMonthRange(dateKey) {
  const [year, month] = dateKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 2, 1));
  const key = first.toISOString().slice(0, 10);
  return { fromDate: monthStart(key), toDate: monthEnd(key), label: "Tháng trước" };
}

function parseVietnameseDate(raw) {
  const text = String(raw || "");
  const slash = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    return `${slash[3]}-${month}-${day}`;
  }
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return iso ? iso[0] : "";
}

function hasExplicitDateRangeQuestion(question) {
  const text = normalizeText(question);
  return Boolean(
    String(question || "").match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/) ||
      [
        "hom nay",
        "hom qua",
        "thang nay",
        "thang truoc",
        "tuan nay",
        "7 ngay qua",
        "bay ngay qua",
        "nam nay",
        "toan thoi gian",
        "tat ca",
        "tu ngay",
        "den ngay"
      ].some((keyword) => text.includes(keyword))
  );
}

function getDateRangeFromUserQuestion(question, timeZone = DEFAULT_TIMEZONE, options = {}) {
  const text = normalizeText(question);
  const today = todayKey(timeZone);
  const dates = [...String(question || "").matchAll(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g)]
    .map((match) => parseVietnameseDate(match[0]))
    .filter(Boolean);

  if (dates.length >= 2) {
    const [fromDate, toDate] = dates[0] <= dates[1] ? [dates[0], dates[1]] : [dates[1], dates[0]];
    return makeDateRange(fromDate, toDate, timeZone, `${displayDate(fromDate)} - ${displayDate(toDate)}`);
  }
  if (dates.length === 1) return makeDateRange(dates[0], dates[0], timeZone, displayDate(dates[0]));
  if (text.includes("hom qua")) {
    const day = addDays(today, -1);
    return makeDateRange(day, day, timeZone, "Hôm qua");
  }
  if (text.includes("thang truoc")) {
    const range = previousMonthRange(today);
    return makeDateRange(range.fromDate, range.toDate, timeZone, range.label);
  }
  if (text.includes("thang nay")) {
    return makeDateRange(monthStart(today), today, timeZone, "Tháng này");
  }
  if (text.includes("tuan nay")) {
    return makeDateRange(weekStart(today), today, timeZone, "Tuần này");
  }
  if (text.includes("7 ngay qua") || text.includes("bay ngay qua")) {
    return makeDateRange(addDays(today, -6), today, timeZone, "7 ngày qua");
  }
  if (text.includes("nam nay")) {
    return makeDateRange(`${today.slice(0, 4)}-01-01`, today, timeZone, "Năm nay");
  }
  if (text.includes("toan thoi gian") || text.includes("tat ca")) {
    return makeDateRange("", today, timeZone, "Toàn thời gian");
  }
  if (options.defaultRange === "all_time") {
    return makeDateRange("", today, timeZone, "Toàn thời gian");
  }
  return makeDateRange(today, today, timeZone, "Hôm nay");
}

function makeDateRange(fromDate, toDate, timeZone, label) {
  return {
    fromDate,
    toDate,
    timezone: timeZone,
    label,
    from: fromDate ? `${fromDate}T00:00:00+07:00` : "",
    to: toDate ? `${toDate}T23:59:59+07:00` : ""
  };
}

function inDateRange(value, range) {
  const key = toDateKey(value);
  if (!key) return false;
  if (range.fromDate && key < range.fromDate) return false;
  if (range.toDate && key > range.toDate) return false;
  return true;
}

function isCancelled(item) {
  const status = normalizeText(item?.status);
  return Boolean(item?.cancelled || item?.deleted || item?.deletedAt || item?.cancelledAt) ||
    ["cancelled", "canceled", "deleted", "huy", "da huy"].includes(status);
}

function categoryName(store, type, categoryId) {
  const categories = store?.categories?.[type] || [];
  return categories.find((category) => category.id === categoryId)?.name || "";
}

function getInventorySalePrice(item) {
  return money(item?.salePrice ?? item?.lastPrice ?? item?.price);
}

function orderTotal(order) {
  if (Number.isFinite(Number(order?.total))) return money(order.total);
  if (Number.isFinite(Number(order?.remainingTotal))) return money(order.remainingTotal);
  const subtotal = (order?.items || []).reduce(
    (sum, item) => sum + money(item.price) * Math.max(1, money(item.quantity || 1)),
    0
  );
  return Math.max(0, subtotal - money(order?.discountTotal || order?.discountAmount));
}

function orderCost(order) {
  let missingCost = false;
  const cost = (order?.items || []).reduce((sum, item) => {
    const quantity = Math.max(1, money(item.quantity || 1));
    const explicit =
      item.costPrice ?? item.lastPrice ?? item.originalCost ?? item.capitalPrice ?? item.importPrice;
    const unitCost = explicit === undefined || explicit === null || explicit === "" ? 0 : money(explicit);
    if (unitCost <= 0) missingCost = true;
    return sum + unitCost * quantity;
  }, 0);
  return { cost, missingCost };
}

function loadStores(state) {
  return Array.isArray(state?.stores) ? state.stores : [];
}

function getActiveStore(state) {
  const stores = loadStores(state);
  return stores.find((store) => store.id === state?.activeStoreId) || stores[0] || null;
}

function resolveStore(question, stores, state) {
  const text = normalizeText(question);
  const matched = stores.find((store) => store?.name && text.includes(normalizeText(store.name)));
  const active = getActiveStore(state);
  return matched || active || stores[0] || null;
}

function detectIntent(question) {
  const text = normalizeText(question);
  if (text.includes("trung")) return "duplicate_report";
  if (text.includes("chinh sua so luong") || text.includes("sua so luong") || text.includes("dieu chinh")) {
    return "quantity_edit_report";
  }
  if (text.includes("xuat kho thu cong") || text.includes("xuat thu cong")) return "manual_export_report";
  if (text.includes("xuat kho do ban") || text.includes("xuat do ban")) return "sales_export_report";
  if (text.includes("xuat kho")) return "inventory_export_report";
  if (text.includes("nhap kho") || text.includes("nhap hang")) return "inventory_import_report";
  if (text.includes("ban chay")) return "best_selling_products";
  if (text.includes("ton kho") || text.includes("kho hang") || text.includes("con hang")) return "inventory_report";
  if (text.includes("khach hang")) return "customer_report";
  if (text.includes("don hang") || text.includes("bill")) return "order_report";
  if (text.includes("loi nhuan") || text.includes("loi hay lo") || /\blo\b/.test(text)) return "profit_report";
  if (text.includes("chi") || text.includes("chi tieu") || text.includes("khoan chi")) return "expense_report";
  if (text.includes("doanh thu") || text.includes("tong thu") || text.includes("ban hang")) return "revenue_report";
  return "overview_report";
}

function makeFilters(question, store) {
  const text = normalizeText(question);
  const productNames = new Set([
    ...(store.inventory || []).map((item) => item.name),
    ...(store.orders || []).flatMap((order) => (order.items || []).map((item) => item.name)),
    ...(store.inventoryLogs || []).map((log) => log.itemName)
  ].filter(Boolean));
  const productName = [...productNames].find((name) => text.includes(normalizeText(name))) || "";
  const customers = store.customers || [];
  const customer = customers.find((item) => {
    const name = normalizeText(item.name);
    const phone = normalizeText(item.phone);
    return (name && text.includes(name)) || (phone && text.includes(phone));
  });
  const categoryNames = [
    ...(store.categories?.income || []),
    ...(store.categories?.expense || []),
    ...(store.purchaseCategories || [])
  ];
  const category = categoryNames.find((item) => item?.name && text.includes(normalizeText(item.name)))?.name || "";
  const person = customer?.name || "";
  return { productName, customerName: person, customerPhone: customer?.phone || "", category };
}

function getTransactions(store, fromDate, toDate, filters = {}) {
  const range = makeDateRange(fromDate, toDate, DEFAULT_TIMEZONE, "");
  return (store.entries || [])
    .filter((entry) => !isCancelled(entry))
    .filter((entry) => inDateRange(entry.date, range))
    .filter((entry) => {
      if (filters.type && entry.type !== filters.type) return false;
      const text = normalizeText([
        entry.note,
        entry.createdBy,
        entry.productName,
        categoryName(store, entry.type, entry.categoryId),
        entry.categoryName
      ].join(" "));
      if (filters.category && !text.includes(normalizeText(filters.category))) return false;
      if (filters.person && !text.includes(normalizeText(filters.person))) return false;
      if (filters.productName && !text.includes(normalizeText(filters.productName))) return false;
      return true;
    })
    .map((entry) => ({
      id: entry.id || "",
      type: entry.type,
      date: toDateKey(entry.date),
      amount: money(entry.amount),
      note: entry.note || "",
      category: categoryName(store, entry.type, entry.categoryId) || entry.categoryName || "",
      categoryId: entry.categoryId || "",
      createdBy: entry.createdBy || ""
    }));
}

function getExpenses(store, fromDate, toDate, filters = {}) {
  return getTransactions(store, fromDate, toDate, { ...filters, type: "expense" });
}

function getRevenueEntries(store, fromDate, toDate, filters = {}) {
  return getTransactions(store, fromDate, toDate, { ...filters, type: "income" });
}

function getOrders(store, fromDate, toDate, filters = {}) {
  const range = makeDateRange(fromDate, toDate, DEFAULT_TIMEZONE, "");
  return (store.orders || [])
    .filter((order) => !isCancelled(order))
    .filter((order) => inDateRange(order.date || order.createdAt, range))
    .filter((order) => {
      const text = normalizeText([
        order.customerName,
        order.customerPhone,
        ...(order.items || []).flatMap((item) => [item.name, item.groupName])
      ].join(" "));
      if (filters.productName && !text.includes(normalizeText(filters.productName))) return false;
      if (filters.customerName && !text.includes(normalizeText(filters.customerName))) return false;
      if (filters.person && !text.includes(normalizeText(filters.person))) return false;
      return true;
    })
    .map((order) => ({
      ...order,
      date: toDateKey(order.date || order.createdAt),
      total: orderTotal(order)
    }));
}

function getInventoryMovements(store, fromDate, toDate, filters = {}) {
  const range = makeDateRange(fromDate, toDate, DEFAULT_TIMEZONE, "");
  return (store.inventoryLogs || [])
    .filter((log) => inDateRange(log.date || log.updatedAt, range))
    .filter((log) => {
      const productMatch = !filters.productName ||
        normalizeText(log.itemName).includes(normalizeText(filters.productName));
      const reasonMatch = !filters.exportReason ||
        normalizeText(log.exportReason).includes(normalizeText(filters.exportReason));
      return productMatch && reasonMatch;
    })
    .map((log) => ({
      id: log.id || "",
      date: toDateKey(log.date || log.updatedAt),
      type: log.type || "",
      itemName: log.itemName || "",
      groupName: log.groupName || "",
      oldQuantity: money(log.oldQuantity),
      newQuantity: money(log.newQuantity),
      oldPrice: money(log.oldPrice),
      newPrice: money(log.newPrice),
      oldSalePrice: money(log.oldSalePrice),
      newSalePrice: money(log.newSalePrice),
      exportReason: log.exportReason || "",
      purpose: getInventoryMovementPurpose(log),
      total: getInventoryMovementTotal(log)
    }));
}

function getInventoryMovementPurpose(log) {
  const oldQuantity = money(log.oldQuantity);
  const newQuantity = money(log.newQuantity);
  if (newQuantity > oldQuantity) return "Nhập kho";
  if (newQuantity < oldQuantity) return "Xuất kho";
  return "Cập nhật kho";
}

function getInventoryMovementTotal(log) {
  const diff = Math.abs(money(log.newQuantity) - money(log.oldQuantity));
  if (diff === 0) return 0;
  return diff * money(log.newPrice || log.oldPrice);
}

function calculateExpenseReport(store, fromDate, toDate, options = {}) {
  const expenses = getExpenses(store, fromDate, toDate, {
    category: options.category,
    person: options.customerName || options.person,
    productName: options.productName
  });
  return {
    items: expenses,
    totals: { expense: sumBy(expenses, "amount") },
    recordCount: expenses.length
  };
}

function calculateRevenueReport(store, fromDate, toDate, options = {}) {
  const incomeEntries = getRevenueEntries(store, fromDate, toDate, options);
  const orders = getOrders(store, fromDate, toDate, options);
  const incomeTotal = sumBy(incomeEntries, "amount");
  const salesTotal = sumBy(orders, "total");
  return {
    items: [
      ...incomeEntries.map((item) => ({ source: "Thu", ...item })),
      ...orders.map((order) => ({
        id: order.id,
        source: "Bán hàng",
        date: order.date,
        customerName: order.customerName || "",
        customerPhone: order.customerPhone || "",
        total: order.total,
        items: order.items || []
      }))
    ],
    totals: { income: incomeTotal, sales: salesTotal, revenue: incomeTotal + salesTotal },
    recordCount: incomeEntries.length + orders.length
  };
}

function calculateProfitReport(store, fromDate, toDate, options = {}) {
  const revenue = calculateRevenueReport(store, fromDate, toDate, options);
  const expense = calculateExpenseReport(store, fromDate, toDate, options);
  let missingCost = false;
  const cogs = getOrders(store, fromDate, toDate, options).reduce((sum, order) => {
    const result = orderCost(order);
    if (result.missingCost) missingCost = true;
    return sum + result.cost;
  }, 0);
  const profit = missingCost ? null : revenue.totals.revenue - cogs - expense.totals.expense;
  return {
    items: [...revenue.items, ...expense.items],
    totals: { ...revenue.totals, expense: expense.totals.expense, costOfGoods: cogs, profit },
    warnings: missingCost ? ["Chưa đủ dữ liệu giá vốn để tính lợi nhuận chính xác."] : [],
    recordCount: revenue.recordCount + expense.recordCount
  };
}

function calculateInventoryReport(store, fromDate, toDate, options = {}) {
  const inventory = (store.inventory || [])
    .filter((item) => !options.productName || normalizeText(item.name).includes(normalizeText(options.productName)))
    .map((item) => ({
      id: item.id || "",
      name: item.name || "",
      groupName: item.groupName || "",
      quantity: money(item.quantity),
      costPrice: money(item.lastPrice),
      salePrice: getInventorySalePrice(item),
      valueAtCost: money(item.quantity) * money(item.lastPrice),
      updatedAt: item.updatedAt || item.createdAt || ""
    }));
  return {
    items: inventory,
    totals: {
      inventoryValue: sumBy(inventory, "valueAtCost"),
      quantityInStock: sumBy(inventory, "quantity")
    },
    recordCount: inventory.length
  };
}

function calculateManualExportReport(store, fromDate, toDate, options = {}) {
  const exports = getInventoryMovements(store, fromDate, toDate, options)
    .filter((log) => log.newQuantity < log.oldQuantity);
  return {
    items: exports,
    totals: {
      manualOut: exports.reduce((sum, log) => sum + (log.oldQuantity - log.newQuantity), 0),
      manualOutValue: sumBy(exports, "total")
    },
    recordCount: exports.length
  };
}

function calculateInventoryImportReport(store, fromDate, toDate, options = {}) {
  const imports = getInventoryMovements(store, fromDate, toDate, options)
    .filter((log) => log.newQuantity > log.oldQuantity);
  return {
    items: imports,
    totals: {
      quantityIn: imports.reduce((sum, log) => sum + (log.newQuantity - log.oldQuantity), 0),
      importValue: sumBy(imports, "total")
    },
    recordCount: imports.length
  };
}

function calculateSalesExportReport(store, fromDate, toDate, options = {}) {
  const orders = getOrders(store, fromDate, toDate, options);
  const items = [];
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (options.productName && !normalizeText(item.name).includes(normalizeText(options.productName))) return;
      items.push({
        orderId: order.id,
        date: order.date,
        customerName: order.customerName || "",
        productName: item.name || "",
        groupName: item.groupName || "",
        quantity: money(item.quantity || 1),
        saleAmount: money(item.price) * money(item.quantity || 1)
      });
    });
  });
  return {
    items,
    totals: { salesOut: sumBy(items, "quantity"), salesOutValue: sumBy(items, "saleAmount") },
    recordCount: items.length
  };
}

function calculateBestSellingProducts(store, fromDate, toDate, options = {}) {
  const orders = getOrders(store, fromDate, toDate, options);
  const map = new Map();
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (options.productName && !normalizeText(item.name).includes(normalizeText(options.productName))) return;
      const key = normalizeText(item.name);
      const current = map.get(key) || {
        productName: item.name || "",
        groupName: item.groupName || "",
        quantity: 0,
        revenue: 0
      };
      current.quantity += money(item.quantity || 1);
      current.revenue += money(item.price) * money(item.quantity || 1);
      map.set(key, current);
    });
  });
  const items = [...map.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
  return {
    items,
    totals: { quantitySold: sumBy(items, "quantity"), revenue: sumBy(items, "revenue") },
    recordCount: items.length
  };
}

function calculateCustomerReport(store, fromDate, toDate, options = {}) {
  const range = makeDateRange(fromDate, toDate, DEFAULT_TIMEZONE, "");
  const customers = getStoreCustomers(store)
    .filter((customer) => inDateRange(customer.createdAt || customer.updatedAt, range))
    .filter((customer) => {
      const text = normalizeText([customer.name, customer.phone, customer.memberTier].join(" "));
      return !options.customerName || text.includes(normalizeText(options.customerName));
    });
  return {
    items: customers,
    totals: { customers: customers.length },
    recordCount: customers.length
  };
}

function calculateOrderReport(store, fromDate, toDate, options = {}) {
  const orders = getOrders(store, fromDate, toDate, options);
  return {
    items: orders.map((order) => ({
      id: order.id,
      date: order.date,
      time: getTimeFromISO(order.createdAt),
      customerName: order.customerName || "",
      customerPhone: order.customerPhone || "",
      total: order.total,
      items: order.items || []
    })),
    totals: { orders: orders.length, sales: sumBy(orders, "total") },
    recordCount: orders.length
  };
}

function findDuplicateTransactions(store, fromDate, toDate, options = {}) {
  const transactions = [
    ...getTransactions(store, fromDate, toDate, options),
    ...getOrders(store, fromDate, toDate, options).map((order) => ({
      id: order.id,
      type: "order",
      date: order.date,
      amount: order.total,
      note: order.customerName || "",
      category: "Bán hàng",
      productName: (order.items || []).map((item) => item.name).join(", "),
      quantity: (order.items || []).reduce((sum, item) => sum + money(item.quantity || 1), 0),
      createdBy: ""
    }))
  ];
  const groups = detectDuplicateTransactions(transactions, store.id);
  return {
    items: transactions,
    duplicates: groups,
    totals: { duplicateGroups: groups.length },
    recordCount: transactions.length
  };
}

function detectDuplicateTransactions(transactions, storeId) {
  const map = new Map();
  transactions.forEach((item) => {
    const key = [
      storeId,
      item.type || "",
      item.date || "",
      money(item.amount),
      normalizeText(item.note),
      normalizeText(item.category),
      normalizeText(item.productName),
      money(item.quantity),
      normalizeText(item.createdBy)
    ].join("|");
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  });
  return [...map.values()].filter((group) => group.length > 1);
}

function findQuantityEdits(store, productName, fromDate, toDate) {
  const edits = getInventoryMovements(store, fromDate, toDate, { productName })
    .filter((log) => normalizeText(log.type).includes("edit") || log.oldQuantity === log.newQuantity);
  return {
    items: edits,
    totals: { edits: edits.length },
    recordCount: edits.length
  };
}

function getStoreCustomers(store) {
  const map = new Map();
  (store.customers || []).forEach((customer) => {
    const name = String(customer.name || "").trim();
    const phone = String(customer.phone || "").trim();
    if (!name && !phone) return;
    map.set(`${normalizeText(name)}::${normalizeText(phone)}`, {
      id: customer.id || "",
      name,
      phone,
      memberTier: customer.memberTier || "Thường",
      createdAt: customer.createdAt || customer.updatedAt || "",
      updatedAt: customer.updatedAt || customer.createdAt || ""
    });
  });
  (store.orders || []).forEach((order) => {
    const name = String(order.customerName || "").trim();
    const phone = String(order.customerPhone || "").trim();
    if (!name || !phone) return;
    const key = `${normalizeText(name)}::${normalizeText(phone)}`;
    if (!map.has(key)) {
      map.set(key, {
        id: order.id || "",
        name,
        phone,
        memberTier: "Thường",
        createdAt: order.createdAt || order.date || "",
        updatedAt: order.createdAt || order.date || ""
      });
    }
  });
  return [...map.values()];
}

function sumBy(items, field) {
  return (items || []).reduce((sum, item) => sum + money(item[field]), 0);
}

function getTimeFromISO(value) {
  if (!value || typeof value !== "string" || !value.includes("T")) return "";
  return value.slice(11, 16);
}

function normalizeAIFileAttachments(value) {
  if (!Array.isArray(value)) return [];
  let remainingChars = MAX_ATTACHMENT_CHARS;
  const files = [];
  for (const file of value.slice(0, MAX_ATTACHMENT_COUNT)) {
    if (!file || typeof file !== "object") continue;
    const text = String(file.text || "").slice(0, Math.max(0, remainingChars));
    remainingChars -= text.length;
    files.push({
      name: String(file.name || "file").slice(0, 180),
      type: String(file.type || "").slice(0, 120),
      size: Number(file.size || 0),
      text,
      truncated: Boolean(file.truncated) || remainingChars <= 0
    });
    if (remainingChars <= 0) break;
  }
  return files;
}

async function loadSharedState() {
  const snapshot = await db.collection(APP_STATE_COLLECTION).doc(APP_STATE_DOCUMENT).get();
  const data = snapshot.exists ? snapshot.data() : {};
  return data.state || data || {};
}

function buildReport(state, question) {
  const stores = loadStores(state);
  const store = resolveStore(question, stores, state);
  const intent = detectIntent(question);
  const wideDefaultIntents = new Set([
    "best_selling_products",
    "inventory_report",
    "customer_report",
    "duplicate_report",
    "quantity_edit_report"
  ]);
  const dateRange = getDateRangeFromUserQuestion(question, DEFAULT_TIMEZONE, {
    defaultRange: wideDefaultIntents.has(intent) && !hasExplicitDateRangeQuestion(question) ? "all_time" : "today"
  });

  if (!store) {
    return {
      ok: false,
      reason: "missing_store",
      message: "Bạn cần tạo hoặc chọn cửa hàng trước khi xem báo cáo."
    };
  }

  const filters = makeFilters(question, store);
  let calculation = {};
  let warnings = [];
  switch (intent) {
    case "expense_report":
      calculation = calculateExpenseReport(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "revenue_report":
      calculation = calculateRevenueReport(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "profit_report":
      calculation = calculateProfitReport(store, dateRange.fromDate, dateRange.toDate, filters);
      warnings = calculation.warnings || [];
      break;
    case "inventory_report":
      calculation = calculateInventoryReport(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "manual_export_report":
    case "inventory_export_report":
      calculation = calculateManualExportReport(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "sales_export_report":
      calculation = calculateSalesExportReport(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "inventory_import_report":
      calculation = calculateInventoryImportReport(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "best_selling_products":
      calculation = calculateBestSellingProducts(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "customer_report":
      calculation = calculateCustomerReport(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "order_report":
      calculation = calculateOrderReport(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "duplicate_report":
      calculation = findDuplicateTransactions(store, dateRange.fromDate, dateRange.toDate, filters);
      break;
    case "quantity_edit_report":
      calculation = findQuantityEdits(store, filters.productName, dateRange.fromDate, dateRange.toDate);
      if (!filters.productName) warnings.push("Câu hỏi chưa nêu rõ tên hàng hóa cần kiểm tra chỉnh sửa số lượng.");
      break;
    default: {
      const revenue = calculateRevenueReport(store, dateRange.fromDate, dateRange.toDate, filters);
      const expense = calculateExpenseReport(store, dateRange.fromDate, dateRange.toDate, filters);
      const inventory = calculateInventoryReport(store, dateRange.fromDate, dateRange.toDate, filters);
      calculation = {
        items: [...revenue.items.slice(0, 30), ...expense.items.slice(0, 30), ...inventory.items.slice(0, 30)],
        totals: {
          income: revenue.totals.income,
          sales: revenue.totals.sales,
          revenue: revenue.totals.revenue,
          expense: expense.totals.expense,
          profit: revenue.totals.revenue - expense.totals.expense,
          inventoryValue: inventory.totals.inventoryValue,
          inventoryCount: inventory.recordCount
        },
        recordCount: revenue.recordCount + expense.recordCount + inventory.recordCount
      };
    }
  }

  const report = {
    ok: true,
    intent,
    store: { id: store.id || "", name: store.name || "" },
    dateRange: {
      from: dateRange.from,
      to: dateRange.to,
      timezone: dateRange.timezone,
      label: dateRange.label
    },
    recordCount: calculation.recordCount || 0,
    filters,
    totals: {
      revenue: 0,
      income: 0,
      sales: 0,
      expense: 0,
      profit: null,
      costOfGoods: 0,
      quantityIn: 0,
      quantityOut: 0,
      manualOut: 0,
      salesOut: 0,
      inventoryValue: 0,
      ...(calculation.totals || {})
    },
    items: calculation.items || [],
    duplicates: calculation.duplicates || [],
    warnings,
    answerMarkdown: ""
  };

  report.answerMarkdown = buildDeterministicMarkdown(report);
  return report;
}

function buildDeterministicMarkdown(report) {
  if (!report.ok) return report.message || "Không thể tạo báo cáo.";
  const lines = [
    `**Cửa hàng:** ${report.store.name || "Chưa rõ"}`,
    `**Khoảng thời gian:** ${report.dateRange.label || `${report.dateRange.from} - ${report.dateRange.to}`}`,
    `**Dữ liệu dùng để tính:** ${report.recordCount} bản ghi.`
  ];

  if (report.warnings?.length) {
    lines.push("", ...report.warnings.map((warning) => `- Cảnh báo: ${warning}`));
  }

  lines.push("");
  switch (report.intent) {
    case "expense_report":
      lines.push(`**Tổng chi:** ${formatCurrency(report.totals.expense)}`);
      break;
    case "revenue_report":
      lines.push(`**Tổng thu:** ${formatCurrency(report.totals.income)}`);
      lines.push(`**Tổng bán hàng:** ${formatCurrency(report.totals.sales)}`);
      lines.push(`**Tổng doanh thu:** ${formatCurrency(report.totals.revenue)}`);
      break;
    case "profit_report":
      lines.push(`**Doanh thu:** ${formatCurrency(report.totals.revenue)}`);
      lines.push(`**Giá vốn:** ${formatCurrency(report.totals.costOfGoods)}`);
      lines.push(`**Chi phí:** ${formatCurrency(report.totals.expense)}`);
      lines.push(`**Lợi nhuận:** ${report.totals.profit === null ? "Chưa đủ dữ liệu" : formatCurrency(report.totals.profit)}`);
      break;
    case "inventory_report":
      lines.push(`**Tổng giá trị kho theo giá vốn:** ${formatCurrency(report.totals.inventoryValue)}`);
      lines.push(`**Tổng số lượng tồn:** ${report.totals.quantityInStock || 0}`);
      break;
    case "manual_export_report":
    case "inventory_export_report":
      lines.push(`**Tổng xuất kho thủ công:** ${report.totals.manualOut || 0}`);
      lines.push(`**Giá trị xuất kho:** ${formatCurrency(report.totals.manualOutValue)}`);
      break;
    case "sales_export_report":
      lines.push(`**Tổng xuất kho do bán hàng:** ${report.totals.salesOut || 0}`);
      lines.push(`**Doanh số hàng đã bán:** ${formatCurrency(report.totals.salesOutValue)}`);
      break;
    case "inventory_import_report":
      lines.push(`**Tổng nhập kho:** ${report.totals.quantityIn || 0}`);
      lines.push(`**Giá trị nhập kho:** ${formatCurrency(report.totals.importValue)}`);
      break;
    case "best_selling_products":
      lines.push(`**Tổng số lượng bán:** ${report.totals.quantitySold || 0}`);
      lines.push(`**Doanh thu:** ${formatCurrency(report.totals.revenue)}`);
      break;
    case "duplicate_report":
      lines.push(`**Nhóm trùng 100%:** ${report.totals.duplicateGroups || 0}`);
      break;
    default:
      Object.entries(report.totals || {}).forEach(([key, value]) => {
        if (value !== null && value !== 0) lines.push(`**${key}:** ${typeof value === "number" ? formatCurrency(value) : value}`);
      });
  }

  if (!report.recordCount) {
    lines.push("", "Chưa có dữ liệu phù hợp.");
    return lines.join("\n");
  }

  lines.push("", "**Danh sách đã tính:**");
  report.items.slice(0, 20).forEach((item, index) => {
    lines.push(`- ${index + 1}. ${formatReportItem(item, report.intent)}`);
  });
  if (report.items.length > 20) lines.push(`- ... còn ${report.items.length - 20} bản ghi khác.`);
  return lines.join("\n");
}

function formatReportItem(item, intent) {
  if (intent === "best_selling_products") {
    return `${item.productName} (${item.groupName || "Chưa phân nhóm"}): ${item.quantity} món, ${formatCurrency(item.revenue)}`;
  }
  if (intent.includes("inventory") || intent.includes("export")) {
    return `${displayDate(item.date)} - ${item.itemName || item.name || item.productName} (${item.groupName || ""}): ${item.oldQuantity ?? ""} -> ${item.newQuantity ?? item.quantity ?? ""}, ${formatCurrency(item.total || item.valueAtCost || item.saleAmount || 0)}`;
  }
  if (item.source === "Bán hàng" || item.customerName) {
    return `${displayDate(item.date)} - ${item.customerName || "Khách lẻ"}: ${formatCurrency(item.total || 0)}`;
  }
  return `${displayDate(item.date)} - ${item.category || item.type || ""} - ${item.note || ""}: ${formatCurrency(item.amount || item.total || 0)}`;
}

async function askOpenAIToFormat(report, message) {
  const apiKey = OPENAI_API_KEY.value() || process.env.OPENAI_API_KEY;
  if (!apiKey) return { text: report.answerMarkdown, usage: null, model: null, usedFallback: false };

  const primaryModel = process.env.OPENAI_MODEL || "gpt-5.5";
  const client = new OpenAI({ apiKey });
  const input = [
    {
      role: "user",
      content: [
        "Hãy trình bày báo cáo sau bằng tiếng Việt dễ đọc.",
        "Không thay đổi, không tự cộng lại, không thêm số liệu ngoài JSON.",
        `Câu hỏi người dùng: ${message}`,
        `JSON backend đã tính:\n${JSON.stringify(report)}`
      ].join("\n\n")
    }
  ];

  try {
    const response = await client.responses.create({
      model: primaryModel,
      instructions: SYSTEM_PROMPT,
      input
    });
    return {
      text: getOutputText(response) || report.answerMarkdown,
      usage: response.usage || null,
      model: primaryModel,
      usedFallback: false
    };
  } catch (error) {
    if (OPENAI_FALLBACK_MODEL && OPENAI_FALLBACK_MODEL !== primaryModel) {
      try {
        const response = await client.responses.create({
          model: OPENAI_FALLBACK_MODEL,
          instructions: SYSTEM_PROMPT,
          input
        });
        return {
          text: getOutputText(response) || report.answerMarkdown,
          usage: response.usage || null,
          model: OPENAI_FALLBACK_MODEL,
          usedFallback: true
        };
      } catch (fallbackError) {
        logger.warn("OpenAI formatting fallback failed", {
          status: fallbackError?.status || fallbackError?.code || 500,
          type: fallbackError?.type || "",
          message: fallbackError?.message || ""
        });
      }
    }
    logger.warn("OpenAI formatting failed; deterministic report returned", {
      status: error?.status || error?.code || 500,
      type: error?.type || "",
      message: error?.message || ""
    });
    return {
      text: `${report.answerMarkdown}\n\n_Ghi chú: AI chỉ dùng báo cáo backend đã tính; OpenAI tạm thời không định dạng được câu trả lời._`,
      usage: null,
      model: primaryModel,
      usedFallback: false
    };
  }
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

function getPublicError(error) {
  if (error?.message === "UNAUTHORIZED") {
    return { status: 401, message: "Bạn chưa được phép dùng AI. Hãy nhập đúng PIN admin rồi thử lại." };
  }
  return {
    status: error?.status >= 400 && error?.status < 600 ? error.status : 500,
    message: "AI tạm thời không phản hồi. Vui lòng kiểm tra Firebase Functions log rồi thử lại."
  };
}

exports.chatWithAI = onRequest(
  {
    region: REGION,
    timeoutSeconds: 90,
    memory: "512MiB",
    secrets: [OPENAI_API_KEY, ADMIN_PIN]
  },
  async (req, res) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return sendError(res, 405, "Chỉ hỗ trợ POST.");

    const startedAt = Date.now();
    try {
      const adminUser = await requireAdmin(req);
      const rateKey = `${adminUser.userId}:${getClientIp(req)}`;
      if (!checkRateLimit(rateKey)) {
        return sendError(res, 429, "Bạn gửi quá nhanh. Vui lòng thử lại sau một phút.");
      }

      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      const conversationId =
        typeof req.body?.conversationId === "string" ? req.body.conversationId.slice(0, 120) : "";
      const mode = req.body?.mode === "propose_action" ? "propose_action" : "read_only";
      const attachments = normalizeAIFileAttachments(req.body?.attachments);

      if (!message) return sendError(res, 400, "message là bắt buộc.");
      if (message.length > MAX_MESSAGE_LENGTH) {
        return sendError(res, 400, `message tối đa ${MAX_MESSAGE_LENGTH} ký tự.`);
      }

      const state = await loadSharedState();
      const report = buildReport(state, message);
      if (attachments.length) {
        report.attachments = attachments;
        report.answerMarkdown += "\n\nCó file đính kèm. Nội dung file được gửi cho AI để đọc thêm, nhưng số liệu quản lý cửa hàng vẫn ưu tiên dữ liệu Firestore đã tính.";
      }

      const formatted = await askOpenAIToFormat(report, message);
      report.answerMarkdown = formatted.text;

      const logPayload = {
        conversationId,
        userId: adminUser.userId,
        mode,
        userQuestion: message,
        resolvedIntent: report.intent || "",
        resolvedStore: report.store || null,
        dateRange: report.dateRange || null,
        firestoreCollections: [`${APP_STATE_COLLECTION}/${APP_STATE_DOCUMENT}`],
        recordCount: report.recordCount || 0,
        recordIds: (report.items || []).slice(0, 100).map((item) => item.id || item.orderId || ""),
        totals: report.totals || {},
        model: formatted.model || process.env.OPENAI_MODEL || "gpt-5.5",
        usedFallbackModel: formatted.usedFallback,
        responsePreview: formatted.text.slice(0, 2000),
        elapsedMs: Date.now() - startedAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await db.collection("ai_logs").add(logPayload);

      res.json({
        reply: formatted.text,
        actions: [],
        usage: formatted.usage,
        report,
        debug: {
          intent: report.intent,
          store: report.store,
          dateRange: report.dateRange,
          recordCount: report.recordCount,
          totals: report.totals,
          model: formatted.model,
          usedFallbackModel: formatted.usedFallback
        }
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
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return sendError(res, 405, "Chỉ hỗ trợ POST.");

    try {
      const adminUser = await requireAdmin(req);
      const actionId = typeof req.body?.actionId === "string" ? req.body.actionId.trim() : "";
      if (!actionId) return sendError(res, 400, "actionId là bắt buộc.");

      const actionRef = db.collection("ai_action_requests").doc(actionId);
      await db.runTransaction(async (transaction) => {
        const actionSnap = await transaction.get(actionRef);
        if (!actionSnap.exists) throw Object.assign(new Error("ACTION_NOT_FOUND"), { status: 404 });
        const action = actionSnap.data();
        if (action.status !== "pending_confirmation") {
          throw Object.assign(new Error("ACTION_DONE"), { status: 409 });
        }
        throw Object.assign(new Error("UNSUPPORTED_ACTION"), { status: 400 });
      });

      await db.collection("ai_logs").add({
        actionId,
        userId: adminUser.userId,
        event: "confirm_ai_action",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ ok: true });
    } catch (error) {
      const messages = {
        ACTION_NOT_FOUND: "Không tìm thấy thao tác AI.",
        ACTION_DONE: "Thao tác này đã được xử lý.",
        UNSUPPORTED_ACTION: "Vì an toàn dữ liệu, thao tác ghi từ AI hiện chỉ được ghi nhận để chủ shop xử lý thủ công."
      };
      const status = error.status || (error.message === "UNAUTHORIZED" ? 401 : 500);
      sendError(
        res,
        status,
        messages[error.message] || (status === 401 ? "Bạn chưa được phép xác nhận." : "Không thể xác nhận thao tác.")
      );
    }
  }
);
