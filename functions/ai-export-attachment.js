"use strict";

const COMPLETE_EXPORT_SOURCE = "automatic_state_export";
const MAX_COMPLETE_EXPORT_BYTES = 8 * 1024 * 1024;

function isCompleteExportAttachment(file) {
  return file?.source === COMPLETE_EXPORT_SOURCE;
}

function normalizeCompleteExportAttachment(file) {
  const reject = (status, message) => { throw Object.assign(new Error(message), { status }); };
  if (file.truncated || typeof file.text !== "string") reject(400, "Tệp xuất phải là JSON đầy đủ, không rút gọn.");
  const size = Buffer.byteLength(file.text, "utf8");
  if (size > MAX_COMPLETE_EXPORT_BYTES) reject(413, "Tệp xuất lớn hơn 8 MB. Dữ liệu chưa được gửi cho AI và không bị cắt bớt.");
  let parsed;
  try { parsed = JSON.parse(file.text); } catch (_) { reject(400, "Tệp xuất JSON không hợp lệ."); }
  if (!parsed || Array.isArray(parsed) || !Array.isArray(parsed.stores)) reject(400, "Tệp xuất không đúng định dạng Xuất dữ liệu.");
  return {
    name: String(file.name || "du-lieu-thu-chi.json").slice(0, 180),
    type: "application/json", kind: "json", source: COMPLETE_EXPORT_SOURCE,
    size, text: file.text, truncated: false
  };
}

function normalizeGeneralFileAttachments(value, { maxCount = 5, maxManualChars = 120000 } = {}) {
  if (!Array.isArray(value)) return [];
  if (value.filter(isCompleteExportAttachment).length > 1) throw Object.assign(new Error("Chỉ gửi một tệp xuất đầy đủ trong mỗi yêu cầu."), { status: 400 });
  // Complete exports are validated and passed intact; never use the preview/text-file clamp.
  const complete = value.find(isCompleteExportAttachment);
  const files = complete ? [normalizeCompleteExportAttachment(complete)] : [];
  let remaining = maxManualChars;
  for (const file of value) {
    if (files.length >= maxCount || remaining <= 0) break;
    if (!file || typeof file !== "object" || isCompleteExportAttachment(file)) continue;
    const original = String(file.text || ""), text = original.slice(0, remaining);
    remaining -= text.length;
    files.push({ name: String(file.name || "file").slice(0,180), kind: file.kind || file.type || "file", text, truncated: Boolean(file.truncated) || text.length < original.length });
  }
  return files;
}

module.exports = { COMPLETE_EXPORT_SOURCE, MAX_COMPLETE_EXPORT_BYTES, isCompleteExportAttachment, normalizeCompleteExportAttachment, normalizeGeneralFileAttachments };
