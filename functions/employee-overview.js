"use strict";

// Only daily totals are exposed when staff cannot view individual sales orders.
function getEmployeeOverviewSales(store) {
  const days = new Map();
  for (const order of Array.isArray(store.orders) ? store.orders : []) {
    if (order.status === "cancelled" || !/^\d{4}-\d{2}-\d{2}$/.test(order.date || "")) continue;
    const total = Number(order.total || 0);
    if (!Number.isFinite(total) || total < 0) continue;
    const day = days.get(order.date) || { date: order.date, total: 0, count: 0 };
    day.total += total;
    day.count += 1;
    days.set(order.date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = { getEmployeeOverviewSales };
