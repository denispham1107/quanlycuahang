"use strict";
// Latest reusable values only, not financial history or transaction identifiers.
function getSuggestionsForType(store, type) {
  const suggestions = new Map();
  const entries = store.entries || [];
  const entryIds = new Set(entries.map(entry => entry.id).filter(Boolean));
  const transferredRowIds = new Set(entries.map(entry => entry.closingBookRowId).filter(Boolean));
  const candidates = entries.filter(entry => entry.type === type && entry.status !== "cancelled");
  // Only persisted days are used: editor drafts never become shared suggestions.
  for (const month of store.closingMonths || []) {
    for (const day of month.days || []) {
      for (const shift of day.shifts || []) {
        const rows = Array.isArray(shift[type]) ? shift[type] : [...(shift[type + "1"] || []), ...(shift[type + "2"] || [])];
        for (const row of rows) {
          // The actual transaction remains authoritative after transfer, including cancellation.
          if (entryIds.has(row.transferredEntryId) || transferredRowIds.has(row.id)) continue;
          candidates.push({...row, updatedAt: day.updatedAt || row.createdAt || day.date || "", date: day.date});
        }
      }
    }
  }
  candidates
    .filter(entry => String(entry.note || "").trim())
    .sort((a, b) => String(b.updatedAt || b.createdAt || b.date || "").localeCompare(String(a.updatedAt || a.createdAt || a.date || "")) ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .forEach(entry => {
      const note = String(entry.note || "").trim(), key = note.toLowerCase();
      if (suggestions.has(key)) return;
      const amount = Number(entry.orderUnitPrice || entry.amount || 0);
      if (!Number.isSafeInteger(amount) || amount < 0) return;
      const categoryId = (store.categories?.[type] || []).some(category => category.id === entry.categoryId) ? entry.categoryId : "";
      suggestions.set(key, {note, amount, categoryId});
    });
  return [...suggestions.values()].sort((a, b) => a.note.localeCompare(b.note, "vi"));
}
function getCashEntrySuggestions(store) {
  return Object.fromEntries(["income", "expense"].map(type => [type, getSuggestionsForType(store, type)]));
}
module.exports = {getCashEntrySuggestions};
