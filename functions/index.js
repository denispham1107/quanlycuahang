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
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || OPENAI_MODEL;
const MAX_MESSAGE_LENGTH = 2000;
const GENERAL_MAX_MESSAGE_LENGTH = 4000;
const GENERAL_HISTORY_LIMIT = 20;
const GENERAL_DAILY_LIMIT = Number(process.env.AI_GENERAL_DAILY_LIMIT || 30);
const GENERAL_MIN_INTERVAL_MS = Number(process.env.AI_GENERAL_MIN_INTERVAL_MS || 1200);
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
const dailyBuckets = new Map();
const lastRequestAt = new Map();

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

const GENERAL_SYSTEM_PROMPT = [
  "Bạn là trợ lý AI tổng quát trên website của Pham Quan.",
  "Bạn trả lời như một ChatGPT thật sự, có thể hỗ trợ nhiều chủ đề: học tập, kinh doanh, marketing, viết nội dung, dịch thuật, lập trình, phân tích dữ liệu, lên kế hoạch, giải thích kiến thức, tư vấn ý tưởng và hỗ trợ công việc hằng ngày.",
  "Mặc định trả lời bằng tiếng Việt, trừ khi người dùng yêu cầu ngôn ngữ khác.",
  "Không tự giới hạn vào dữ liệu cửa hàng. Chỉ dùng dữ liệu cửa hàng khi người dùng hỏi rõ về cửa hàng, thu chi, kho hàng, khách hàng hoặc đơn hàng.",
  "Không bịa số liệu. Nếu không có dữ liệu phù hợp, hãy nói rõ là chưa có đủ dữ liệu.",
  "Với thông tin mới, giá cả, luật, tin tức, thời tiết, thị trường, model/API hoặc dữ liệu có thể thay đổi theo thời gian, hãy dùng web search khi công cụ được bật; nếu không có web search thì nói rõ dữ liệu có thể chưa cập nhật.",
  "Không hỗ trợ nội dung nguy hiểm, bất hợp pháp, lừa đảo, xâm nhập tài khoản, đánh cắp dữ liệu, hướng dẫn gây hại, tự làm hại bản thân hoặc nội dung người lớn."
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

function getDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function checkGeneralDailyLimit(key) {
  const todayKey = getDayKey();
  const bucketKey = `${todayKey}:${key}`;
  const count = dailyBuckets.get(bucketKey) || 0;
  if (count >= GENERAL_DAILY_LIMIT) return false;
  dailyBuckets.set(bucketKey, count + 1);
  return true;
}

function checkMinInterval(key) {
  const now = Date.now();
  const last = lastRequestAt.get(key) || 0;
  if (now - last < GENERAL_MIN_INTERVAL_MS) return false;
  lastRequestAt.set(key, now);
  return true;
}

function normalizeChatHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role,
      content: String(item.content || "").slice(0, GENERAL_MAX_MESSAGE_LENGTH)
    }))
    .filter((item) => item.content.trim())
    .slice(-GENERAL_HISTORY_LIMIT);
}

function shouldUseWebSearch(message) {
  const text = normalizeText(message);
  return /\b(tin moi|hom nay|hien tai|moi nhat|gia vang|gia bac|chung khoan|crypto|bitcoin|thoi tiet|luat moi|lich thi dau|su kien|api|model openai|gpt|ti gia|lai suat)\b/.test(text);
}

function normalizeGeneralAttachments(attachments) {
  return normalizeAIFileAttachments(attachments).map((file) => ({
    name: file.name,
    kind: file.kind || file.type || "file",
    text: String(file.text || "").slice(0, MAX_ATTACHMENT_CHARS),
    truncated: Boolean(file.truncated)
  }));
}

function buildGeneralInput(message, history, attachments) {
  const input = history.map((item) => ({ role: item.role, content: item.content }));
  let userContent = message;
  if (attachments.length) {
    userContent += "\n\nNgười dùng gửi kèm các file sau. Hãy đọc nội dung file để trả lời câu hỏi, nhưng không bịa nếu file không có dữ liệu liên quan:\n";
    attachments.forEach((file, index) => {
      userContent += `\n--- FILE ${index + 1}: ${file.name} (${file.kind}${file.truncated ? ", đã rút gọn" : ""}) ---\n${file.text}\n`;
    });
  }
  input.push({ role: "user", content: userContent });
  return input;
}

async function isModerationFlagged(client, message) {
  if (process.env.OPENAI_DISABLE_MODERATION === "true") return false;
  try {
    const moderation = await client.moderations.create({
      model: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest",
      input: message
    });
    return Boolean(moderation.results?.some((result) => result.flagged));
  } catch (error) {
    logger.warn("OpenAI moderation unavailable", {
      status: error?.status || error?.code || 500,
      message: error?.message || ""
    });
    return false;
  }
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
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function firstKeyValue(object, keys) {
  if (!object || typeof object !== "object") return undefined;
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
  }
  const normalizedKeys = Object.keys(object).reduce((map, key) => {
    map.set(normalizeText(key), key);
    return map;
  }, new Map());
  for (const key of keys) {
    const realKey = normalizedKeys.get(normalizeText(key));
    if (realKey && object[realKey] !== undefined && object[realKey] !== null && object[realKey] !== "") {
      return object[realKey];
    }
  }
  return undefined;
}

function money(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    let text = value.trim();
    if (!text) return 0;
    text = text.replace(/[^\d,.-]/g, "");
    if (text.includes(",") && text.includes(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else if (text.includes(".") && /^\d{1,3}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, "");
    } else if (text.includes(",")) {
      text = text.replace(",", ".");
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value) {
  return `${money(value).toLocaleString("vi-VN")} đ`;
}

function toDateKey(value) {
  if (!value) return "";
  if (value.toDate) return value.toDate().toISOString().slice(0, 10);
  if (value.seconds) return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  if (typeof value === "string") {
    const slash = value.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
    if (slash) {
      const day = slash[1].padStart(2, "0");
      const month = slash[2].padStart(2, "0");
      const year = slash[3];
      return `${year}-${month}-${day}`;
    }
    const iso = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
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
  const categories = [
    ...asArray(store?.categories?.[type]),
    ...asArray(store?.categories?.income),
    ...asArray(store?.categories?.expense),
    ...asArray(store?.purchaseCategories)
  ];
  const normalizedId = normalizeText(categoryId);
  return categories.find((category) =>
    category?.id === categoryId || normalizeText(category?.name) === normalizedId
  )?.name || "";
}

function unwrapState(data, depth = 0) {
  if (!data || typeof data !== "object" || depth > 4) return data || {};
  const candidates = [data.state, data.appState, data.data, data.payload, data.snapshot];
  const nested = candidates.find((value) => value && typeof value === "object" && (value.stores || value.activeStoreId));
  return nested ? unwrapState(nested, depth + 1) : data;
}

function normalizeEntryType(value, fallback = "") {
  const text = normalizeText(value || fallback);
  if (text.includes("expense") || text === "chi" || text.includes("khoan chi")) return "expense";
  if (text.includes("income") || text === "thu" || text.includes("khoan thu")) return "income";
  return fallback || text || "";
}

function normalizeEntry(store, entry, fallbackType = "") {
  const rawType = firstDefined(
    entry.type,
    entry.kind,
    entry.entryType,
    entry.transactionType,
    firstKeyValue(entry, ["Loại", "Loai", "Kiểu", "Kieu"])
  );
  let type = normalizeEntryType(rawType, fallbackType);
  if (!type && firstKeyValue(entry, ["Khoản chi", "Khoan chi", "Tên khoản chi", "Ten khoan chi"])) type = "expense";
  if (!type && firstKeyValue(entry, ["Khoản thu", "Khoan thu", "Tên khoản thu", "Ten khoan thu"])) type = "income";
  const categoryId = firstDefined(
    entry.categoryId,
    entry.category,
    entry.categoryName,
    entry.groupName,
    firstKeyValue(entry, ["Mục", "Muc", "Nhóm", "Nhom", "Danh mục", "Danh muc", "Phân loại", "Phan loai"])
  );
  return {
    id: entry.id || entry.key || "",
    type,
    date: toDateKey(firstDefined(
      entry.date,
      entry.createdAt,
      entry.updatedAt,
      entry.timestamp,
      firstKeyValue(entry, ["Ngày", "Ngay", "Ngày nhập", "Ngay nhap", "Ngày tạo", "Ngay tao"])
    )),
    amount: money(firstDefined(
      entry.amount,
      entry.total,
      entry.value,
      entry.money,
      entry.price,
      firstKeyValue(entry, ["Số tiền", "So tien", "Tiền", "Tien", "Thành tiền", "Thanh tien"])
    )),
    note: firstDefined(
      entry.note,
      entry.name,
      entry.title,
      entry.description,
      entry.itemName,
      firstKeyValue(entry, ["Khoản chi", "Khoan chi", "Khoản thu", "Khoan thu", "Tên khoản", "Ten khoan", "Ghi chú", "Ghi chu"])
    ) || "",
    category: categoryName(store, type, categoryId) || entry.categoryName || entry.category || categoryId || "",
    categoryId: categoryId || "",
    createdBy: firstDefined(
      entry.createdBy,
      entry.person,
      entry.payer,
      entry.staff,
      entry.employeeName,
      entry.userName,
      firstKeyValue(entry, ["Người tạo", "Nguoi tao", "Người chi", "Nguoi chi", "Nhân viên", "Nhan vien"])
    ) || "",
    productName: firstDefined(entry.productName, entry.itemName, entry.goodsName, entry.name, firstKeyValue(entry, ["Hàng hóa", "Hang hoa"])) || "",
    quantity: money(firstDefined(entry.quantity, entry.qty, entry.count, firstKeyValue(entry, ["Số lượng", "So luong"])))
  };
}

function getStoreEntries(store) {
  return [
    ...asArray(store?.entries).map((entry) => normalizeEntry(store, entry)),
    ...asArray(store?.transactions).map((entry) => normalizeEntry(store, entry)),
    ...asArray(store?.incomeEntries).map((entry) => normalizeEntry(store, entry, "income")),
    ...asArray(store?.expenseEntries).map((entry) => normalizeEntry(store, entry, "expense")),
    ...asArray(store?.incomes).map((entry) => normalizeEntry(store, entry, "income")),
    ...asArray(store?.expenses).map((entry) => normalizeEntry(store, entry, "expense"))
  ].filter((entry) => entry.date || entry.amount || entry.note || entry.category);
}

function normalizeOrderItem(item = {}) {
  const name = firstDefined(item.name, item.productName, item.itemName, item.goodsName, item.title) || "";
  const quantity = Math.max(1, money(firstDefined(item.quantity, item.qty, item.count, 1)) || 1);
  return {
    ...item,
    name,
    groupName: firstDefined(item.groupName, item.categoryName, item.category, item.group) || "",
    quantity,
    price: money(firstDefined(item.price, item.salePrice, item.unitPrice, item.amount, item.total)),
    costPrice: money(firstDefined(item.costPrice, item.lastPrice, item.originalCost, item.capitalPrice, item.importPrice))
  };
}

function normalizeOrder(order = {}) {
  const rawItems = asArray(order.items).length
    ? order.items
    : asArray(order.products).length
      ? order.products
      : asArray(order.lines).length
        ? order.lines
        : order.details;
  const items = asArray(rawItems).map(normalizeOrderItem);
  return {
    ...order,
    id: order.id || order.key || "",
    date: toDateKey(firstDefined(order.date, order.createdAt, order.updatedAt, order.timestamp)),
    createdAt: firstDefined(order.createdAt, order.updatedAt, order.date) || "",
    customerName: firstDefined(order.customerName, order.customer, order.name, order.buyerName) || "",
    customerPhone: firstDefined(order.customerPhone, order.phone, order.phoneNumber, order.mobile) || "",
    items
  };
}

function getStoreOrders(store) {
  return [
    ...asArray(store?.orders),
    ...asArray(store?.salesOrders),
    ...asArray(store?.sales),
    ...asArray(store?.completedOrders),
    ...asArray(store?.bills)
  ].map(normalizeOrder).filter((order) => order.date || order.items.length || order.customerName || order.total);
}

function getStoreDiagnostics(store) {
  return {
    rawEntries: asArray(store?.entries).length,
    normalizedEntries: getStoreEntries(store).length,
    rawOrders: asArray(store?.orders).length,
    normalizedOrders: getStoreOrders(store).length,
    rawInventoryLogs: asArray(store?.inventoryLogs).length,
    rawInventory: asArray(store?.inventory).length,
    customers: asArray(store?.customers).length
  };
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
  const root = unwrapState(state);
  return asArray(root?.stores || root?.shops || root?.storesById).filter((store) => store && typeof store === "object");
}

function getActiveStore(state) {
  const root = unwrapState(state);
  const stores = loadStores(root);
  const activeStoreId = root?.activeStoreId || root?.selectedStoreId || root?.currentStoreId;
  return stores.find((store) => store.id === activeStoreId) || stores[0] || null;
}

function resolveStore(question, stores, state) {
  const text = normalizeText(question);
  const matched = stores.find((store) => store?.name && text.includes(normalizeText(store.name)));
  const active = getActiveStore(state);
  if (matched) return matched;
  const scored = stores
    .map((store) => {
      const tokens = normalizeText(store?.name).split(" ").filter((token) => token.length >= 3);
      const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
      return { store, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.store || active || stores[0] || null;
}

const QUESTION_STOPWORDS = new Set([
  "bao", "cao", "tong", "tat", "ca", "cac", "khoan", "muc", "theo", "cho",
  "toi", "minh", "nay", "qua", "hom", "ngay", "thang", "nam", "tuan", "cua",
  "cua", "hang", "doanh", "thu", "chi", "tieu", "phi", "loi", "nhuan", "hay",
  "nhap", "xuat", "kho", "ban", "hang", "san", "pham", "don", "bill", "lich",
  "su", "ton", "con", "chay", "nhat", "bao", "nhiu", "nhieu", "bao nhieu"
]);

function extractQuestionKeywords(question, store) {
  const storeTokens = new Set(normalizeText(store?.name).split(" ").filter(Boolean));
  return normalizeText(question)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !QUESTION_STOPWORDS.has(token))
    .filter((token) => !storeTokens.has(token));
}

function getTransactionSearchText(entry, store) {
  return normalizeText([
    entry.note,
    entry.createdBy,
    entry.productName,
    entry.category,
    entry.categoryId,
    categoryName(store, entry.type, entry.categoryId),
    entry.name,
    entry.title,
    entry.description
  ].join(" "));
}

function scoreTransactionForQuestion(entry, store, options = {}) {
  const text = getTransactionSearchText(entry, store);
  let score = 0;
  const category = normalizeText(options.category);
  const person = normalizeText(options.customerName || options.person);
  const productName = normalizeText(options.productName);
  const keywordText = normalizeText(options.keywordText);

  if (category && text.includes(category)) score += 6;
  if (person && text.includes(person)) score += 5;
  if (productName && text.includes(productName)) score += 6;
  if (keywordText && text.includes(keywordText)) score += 4;

  for (const keyword of options.keywords || []) {
    if (text.includes(keyword)) score += 1;
  }
  return score;
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
    ...asArray(store.inventory).map((item) => item.name),
    ...getStoreOrders(store).flatMap((order) => asArray(order.items).map((item) => item.name)),
    ...asArray(store.inventoryLogs).map((log) => log.itemName),
    ...getStoreEntries(store).map((entry) => entry.productName)
  ].filter(Boolean));
  const productName = [...productNames].find((name) => text.includes(normalizeText(name))) || "";
  const customers = asArray(store.customers);
  const customer = customers.find((item) => {
    const name = normalizeText(item.name);
    const phone = normalizeText(item.phone);
    return (name && text.includes(name)) || (phone && text.includes(phone));
  });
  const categoryNames = [
    ...asArray(store.categories?.income),
    ...asArray(store.categories?.expense),
    ...asArray(store.purchaseCategories),
    ...getStoreEntries(store).map((entry) => ({ name: entry.category }))
  ];
  const category = categoryNames.find((item) => item?.name && text.includes(normalizeText(item.name)))?.name || "";
  const knownPeople = new Set([
    ...customers.map((item) => item.name),
    ...getStoreEntries(store).flatMap((entry) => [entry.createdBy, entry.note])
  ].filter(Boolean));
  const person = customer?.name || [...knownPeople].find((name) => name && text.includes(normalizeText(name))) || "";
  const keywords = extractQuestionKeywords(question, store);
  return {
    productName,
    customerName: person,
    customerPhone: customer?.phone || "",
    category,
    keywords,
    keywordText: keywords.join(" ")
  };
}

function getTransactions(store, fromDate, toDate, filters = {}) {
  const range = makeDateRange(fromDate, toDate, DEFAULT_TIMEZONE, "");
  return getStoreEntries(store)
    .filter((entry) => !isCancelled(entry))
    .filter((entry) => inDateRange(entry.date, range))
    .filter((entry) => {
      if (filters.type && entry.type !== filters.type) return false;
      const text = normalizeText([
        entry.note,
        entry.createdBy,
        entry.productName,
        entry.category,
        entry.categoryId,
        categoryName(store, entry.type, entry.categoryId),
        entry.name,
        entry.title,
        entry.description
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
      category: entry.category || categoryName(store, entry.type, entry.categoryId) || "",
      categoryId: entry.categoryId || "",
      createdBy: entry.createdBy || "",
      productName: entry.productName || "",
      quantity: money(entry.quantity)
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
  return getStoreOrders(store)
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
  return asArray(store.inventoryLogs)
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
  let expenses = getExpenses(store, fromDate, toDate, {
    category: options.category,
    person: options.customerName || options.person,
    productName: options.productName
  });
  const warnings = [];
  const baseExpenses = getExpenses(store, fromDate, toDate, {});

  if (!expenses.length && baseExpenses.length && (options.keywords?.length || options.keywordText)) {
    const scored = baseExpenses
      .map((entry) => ({ entry, score: scoreTransactionForQuestion(entry, store, options) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length) {
      const threshold = Math.min(2, Math.max(1, options.keywords?.length || 1));
      expenses = scored.filter((item) => item.score >= threshold).map((item) => item.entry);
      if (!expenses.length) expenses = scored.slice(0, 20).map((item) => item.entry);
      warnings.push(
        "Backend đã dùng tìm kiếm mềm theo nội dung khoản chi vì bộ lọc trường cố định không tìm thấy bản ghi."
      );
    }
  }

  return {
    items: expenses,
    totals: { expense: sumBy(expenses, "amount") },
    warnings,
    debug: {
      baseExpenseCount: baseExpenses.length,
      strictExpenseCount: expenses.length,
      keywords: options.keywords || []
    },
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
  const inventory = asArray(store.inventory)
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
  asArray(store.customers).forEach((customer) => {
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
  getStoreOrders(store).forEach((order) => {
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

function parseAttachmentJson(file) {
  const text = String(file?.text || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (nestedError) {
        return null;
      }
    }
    return null;
  }
}

function ensureMutableStores(state) {
  const root = unwrapState(state);
  const stores = loadStores(root).map((store) => ({
    ...store,
    entries: asArray(store.entries).slice(),
    transactions: asArray(store.transactions).slice(),
    incomeEntries: asArray(store.incomeEntries).slice(),
    expenseEntries: asArray(store.expenseEntries).slice(),
    orders: asArray(store.orders).slice(),
    inventory: asArray(store.inventory).slice(),
    inventoryLogs: asArray(store.inventoryLogs).slice(),
    customers: asArray(store.customers).slice()
  }));
  return { ...root, stores };
}

function mergeStore(target, source) {
  const keys = [
    "entries",
    "transactions",
    "incomeEntries",
    "expenseEntries",
    "orders",
    "salesOrders",
    "sales",
    "inventory",
    "inventoryLogs",
    "customers"
  ];
  for (const key of keys) {
    const items = asArray(source?.[key]);
    if (items.length) target[key] = [...asArray(target[key]), ...items];
  }
  if (!target.name && source?.name) target.name = source.name;
  if (!target.id && source?.id) target.id = source.id;
}

function appendRowsToStore(target, rows) {
  const normalizedRows = asArray(rows).filter((row) => row && typeof row === "object");
  if (!normalizedRows.length) return;
  const hasExpense = normalizedRows.some((row) =>
    firstKeyValue(row, ["Khoản chi", "Khoan chi", "Tên khoản chi", "Ten khoan chi"]) ||
    normalizeEntryType(firstDefined(row.type, row.kind, firstKeyValue(row, ["Loại", "Loai"]))) === "expense"
  );
  const hasIncome = normalizedRows.some((row) =>
    firstKeyValue(row, ["Khoản thu", "Khoan thu", "Tên khoản thu", "Ten khoan thu"]) ||
    normalizeEntryType(firstDefined(row.type, row.kind, firstKeyValue(row, ["Loại", "Loai"]))) === "income"
  );
  if (hasExpense && !hasIncome) target.expenseEntries = [...asArray(target.expenseEntries), ...normalizedRows];
  else if (hasIncome && !hasExpense) target.incomeEntries = [...asArray(target.incomeEntries), ...normalizedRows];
  else target.entries = [...asArray(target.entries), ...normalizedRows];
}

function mergeAttachmentDataIntoState(baseState, attachments, question) {
  const state = ensureMutableStores(baseState);
  if (!state.stores.length) state.stores.push({ id: "attachment-store", name: "Dữ liệu đính kèm" });
  const selectedStore = resolveStore(question, state.stores, state) || state.stores[0];

  for (const file of attachments) {
    const parsed = parseAttachmentJson(file);
    if (!parsed) continue;
    const root = unwrapState(parsed);
    const attachedStores = loadStores(root);
    if (attachedStores.length) {
      for (const attachedStore of attachedStores) {
        const attachedName = normalizeText(attachedStore.name);
        const attachedId = attachedStore.id || "";
        const target = state.stores.find((store) =>
          (attachedId && store.id === attachedId) ||
          (attachedName && normalizeText(store.name) === attachedName)
        ) || state.stores.find((store) => store.id === selectedStore.id) || selectedStore;
        mergeStore(target, attachedStore);
      }
      continue;
    }

    const storeName = firstDefined(root.storeName, root.shopName, root.store, root.name);
    const target = storeName
      ? state.stores.find((store) => normalizeText(store.name).includes(normalizeText(storeName)) || normalizeText(storeName).includes(normalizeText(store.name))) || selectedStore
      : selectedStore;

    mergeStore(target, root);
    if (Array.isArray(root)) appendRowsToStore(target, root);
    appendRowsToStore(target, firstDefined(root.rows, root.records, root.items, root.list, root.data));
  }

  return state;
}

function normalizeClientStateSnapshot(value) {
  if (!value || typeof value !== "object") return null;
  if (value.truncated) return null;

  const root = unwrapState(value);
  const stores = loadStores(root);
  if (!stores.length) return null;

  return root;
}

async function loadSharedState() {
  const snapshot = await db.collection(APP_STATE_COLLECTION).doc(APP_STATE_DOCUMENT).get();
  const data = snapshot.exists ? snapshot.data() : {};
  return unwrapState(data);
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

  warnings = [...warnings, ...(calculation.warnings || [])];

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
    diagnostics: getStoreDiagnostics(store),
    warnings,
    answerMarkdown: ""
  };

  if (report.recordCount === 0) {
    const d = report.diagnostics;
    if (d.normalizedEntries || d.normalizedOrders || d.rawInventoryLogs || d.rawInventory) {
      report.warnings = [
        ...(report.warnings || []),
        `Có dữ liệu trong cửa hàng nhưng không có bản ghi phù hợp với bộ lọc hiện tại. Raw: ${d.normalizedEntries} thu/chi, ${d.normalizedOrders} đơn hàng, ${d.rawInventoryLogs} lịch sử kho, ${d.rawInventory} hàng tồn.`
      ];
    }
  }

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

  const primaryModel = OPENAI_MODEL;
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

async function callGeneralOpenAI({ message, history, attachments, useWebSearch }) {
  const apiKey = OPENAI_API_KEY.value() || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY is not configured"), { status: 500 });
  }

  const client = new OpenAI({ apiKey });
  if (await isModerationFlagged(client, message)) {
    return {
      reply: "Xin loi, toi khong the ho tro noi dung nay.",
      usage: null,
      model: null,
      usedWebSearch: false
    };
  }

  const model = OPENAI_MODEL;
  const input = buildGeneralInput(message, history, attachments);
  const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 1200);
  const request = {
    model,
    instructions: GENERAL_SYSTEM_PROMPT,
    input,
    max_output_tokens: maxOutputTokens
  };

  if (useWebSearch) {
    request.tools = [{ type: "web_search_preview", search_context_size: "low" }];
  }

  try {
    const response = await client.responses.create(request);
    return {
      reply: getOutputText(response) || "Toi chua co cau tra loi phu hop.",
      usage: response.usage || null,
      model,
      usedWebSearch: Boolean(useWebSearch)
    };
  } catch (error) {
    if (useWebSearch) {
      logger.warn("General AI web search failed; retrying without web search", {
        status: error?.status || error?.code || 500,
        type: error?.type || "",
        message: error?.message || ""
      });
      const response = await client.responses.create({
        model,
        instructions: GENERAL_SYSTEM_PROMPT,
        input,
        max_output_tokens: maxOutputTokens
      });
      return {
        reply: getOutputText(response) || "Toi chua co cau tra loi phu hop.",
        usage: response.usage || null,
        model,
        usedWebSearch: false
      };
    }
    throw error;
  }
}

async function handleGeneralChatRequest(req, res) {
  const startedAt = Date.now();
  const ip = getClientIp(req);
  const sessionId =
    typeof req.body?.conversationId === "string" && req.body.conversationId.trim()
      ? req.body.conversationId.trim().slice(0, 120)
      : ip;
  const rateKey = `general:${sessionId}:${ip}`;

  if (!checkMinInterval(rateKey)) {
    return sendError(res, 429, "Ban gui qua nhanh. Vui long cho mot chut roi thu lai.");
  }
  if (!checkGeneralDailyLimit(rateKey)) {
    return sendError(res, 429, "Ban da vuot gioi han dung AI hom nay. Vui long thu lai sau.");
  }

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return sendError(res, 400, "message la bat buoc.");
  if (message.length > GENERAL_MAX_MESSAGE_LENGTH) {
    return sendError(res, 400, `message toi da ${GENERAL_MAX_MESSAGE_LENGTH} ky tu.`);
  }

  const history = normalizeChatHistory(req.body?.history);
  const attachments = normalizeGeneralAttachments(req.body?.attachments);
  const useWebSearch = shouldUseWebSearch(message);
  const result = await callGeneralOpenAI({ message, history, attachments, useWebSearch });

  await db.collection("ai_logs").add({
    conversationId: sessionId,
    mode: "general",
    userQuestionLength: message.length,
    historyCount: history.length,
    attachmentCount: attachments.length,
    usedWebSearch: result.usedWebSearch,
    model: result.model,
    elapsedMs: Date.now() - startedAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  res.json({
    reply: result.reply,
    actions: [],
    usage: result.usage,
    debug: {
      mode: "general",
      model: result.model,
      usedWebSearch: result.usedWebSearch
    }
  });
}

exports.chatGeneralAI = onRequest(
  {
    region: REGION,
    timeoutSeconds: 90,
    memory: "512MiB",
    secrets: [OPENAI_API_KEY]
  },
  async (req, res) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return sendError(res, 405, "Chi ho tro POST.");

    try {
      await handleGeneralChatRequest(req, res);
    } catch (error) {
      logger.error("chatGeneralAI failed", {
        status: error?.status || error?.code || 500,
        type: error?.type || "",
        message: error?.message || ""
      });
      sendError(res, 500, "AI dang ban hoac da vuot gioi han su dung, vui long thu lai sau.");
    }
  }
);

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

    if (req.body?.mode === "general") {
      try {
        return await handleGeneralChatRequest(req, res);
      } catch (error) {
        logger.error("chatWithAI general fallback failed", {
          status: error?.status || error?.code || 500,
          type: error?.type || "",
          message: error?.message || ""
        });
        return sendError(res, 500, "AI dang ban hoac da vuot gioi han su dung, vui long thu lai sau.");
      }
    }

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

      const clientState = normalizeClientStateSnapshot(req.body?.clientState);
      let state = clientState || await loadSharedState();
      const stateSource = clientState ? "frontend_client_state" : "firestore_shared_state";
      if (attachments.length) {
        state = mergeAttachmentDataIntoState(state, attachments, message);
      }
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
        stateSource,
        recordCount: report.recordCount || 0,
        recordIds: (report.items || []).slice(0, 100).map((item) => item.id || item.orderId || ""),
        totals: report.totals || {},
        model: formatted.model || OPENAI_MODEL,
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
          usedFallbackModel: formatted.usedFallback,
          stateSource
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
