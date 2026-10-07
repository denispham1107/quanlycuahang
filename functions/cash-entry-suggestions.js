"use strict";
// Latest reusable values only, not financial history or transaction identifiers.
function getCashEntrySuggestions(store) {
  return Object.fromEntries(["income", "expense"].map(type => {
    const suggestions = new Map();
    [...(store.entries || [])]
      .filter(entry => entry.type === type && entry.status !== "cancelled" && String(entry.note || "").trim())
      .sort((a,b) => String(b.updatedAt || b.createdAt || b.date || "").localeCompare(String(a.updatedAt || a.createdAt || a.date || "")))
      .forEach(entry => {
        const note = String(entry.note || "").trim(), key = note.toLowerCase();
        if (suggestions.has(key)) return;
        const amount = Number(entry.orderUnitPrice || entry.amount || 0);
        if (!Number.isSafeInteger(amount) || amount < 0) return;
        const categoryId = (store.categories?.[type] || []).some(category => category.id === entry.categoryId) ? entry.categoryId : "";
        suggestions.set(key, {note, amount, categoryId});
      });
    return [type, [...suggestions.values()].sort((a,b) => a.note.localeCompare(b.note, "vi"))];
  }));
}
module.exports = {getCashEntrySuggestions};
