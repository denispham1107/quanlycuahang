const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const core = require('../closing-book-core'), exporter = require('../closing-book-export');
const ui = fs.readFileSync('closing-book.js', 'utf8'), app = fs.readFileSync('app.js', 'utf8');
const context = { ClosingBookCore: core, ClosingBookExport: exporter, today: '2026-10-15', Blob };
vm.createContext(context);
vm.runInContext(ui.slice(ui.indexOf('function buildClosingBookAudit('), ui.indexOf('function openClosingBookAudit(')), context);
vm.runInContext(app.slice(app.indexOf('function createStateExportPayload('), app.indexOf('function createAIClientStateSnapshot(')), context);
const shift = (changes = {}) => ({ ...core.emptyShift(), ...changes });
function fixture() {
  return { activeStoreId: 'second', stores: [{
    id: 'first', name: 'Cửa hàng QA', categories: { income: [{ id: 'i', name: 'Thu QA' }], expense: [{ id: 'e', name: 'Chi QA' }] },
    entries: [{ id: 'linked', closingBookRowId: 'r1', type: 'income', amount: 10000, status: 'cancelled' }, { id: 'pos-entry', type: 'income', amount: 3934000 }],
    closingMonths: [{ month: '2026-10', customMetadata: 'PRESERVE', days: [{ date: '2026-10-01', updatedAt: '2026-10-10T13:19:00Z', shifts: [shift({
      name: 'Tiên QA', opening: 1300000, pos: 3934000, vcb: 3140000, cash: 794000, ending: 580000,
      actualVcb: 3141000, actualMomo: 100, actualZalop: 200, result: 'Kết quả QA', recheck: 'Bill hủy QA',
      posTransfer: { id: 'pos-row', transferredEntryId: 'pos-entry', categoryId: 'i', amount: 3934000, note: 'POS QA', createdAt: '2026-10-01T10:00:00Z' },
      income: [{ id: 'r1', note: 'Thu đầy đủ', amount: 10000, categoryId: 'i', createdAt: '2026-10-01T09:00:00Z', timeSource: 'saved' }],
      expense: [{ id: 'r2', note: 'Chi đầy đủ', amount: 5000, categoryId: 'e', unknownMetadata: 'KEPT_IN_SOURCE' }]
    })] }, { date: '2026-10-02', shifts: [shift({ opening: 100 }), shift({ ending: 100 })] }] },
    { month: '2024-02', days: [{ date: '2024-02-29', shifts: [shift({ ending: 250 })] }] }]
  }, { id: 'second', name: 'Cửa hàng rỗng', closingMonths: [] }] };
}
function exportState(state) { context.state = state; return JSON.parse(context.createStateExportDocument().text); }
test('exports every saved store/month/day/shift and preserves raw backup data without mutation', () => {
  const state = fixture(), before = JSON.stringify(state), result = exportState(state);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(result.stores[0].closingMonths, state.stores[0].closingMonths);
  const report = result.stores[0].closingBookReport;
  assert.equal(report.complete, true); assert.deepEqual(report.errors, []);
  assert.equal(report.monthCount, 2); assert.equal(report.savedDays, 3); assert.equal(report.shiftCount, 4);
  assert.equal(report.savedDataOnly, true); assert.equal(report.currency, 'VND');
  assert.equal(result.stores[1].closingBookReport.monthCount, 0);
  // A report from an imported file must always be regenerated, never trusted.
  state.stores[0].closingBookReport = { stale: true };
  assert.deepEqual(exportState(state).stores[0].closingBookReport, report);
});
test('all payment reconciliation, cash totals and notes equal the UI calculation', () => {
  const state = fixture(), raw = state.stores[0].closingMonths[0].days[0].shifts[0];
  const report = exportState(state).stores[0].closingBookReport, exported = report.months[0].days[0].shifts[0];
  assert.deepEqual(exported.totals, core.calculate(raw));
  assert.deepEqual(Object.keys(exported.values), core.moneyKeys);
  assert.deepEqual(exported.payments.pos, { label: 'POS', book: 3934000, actual: 3934000, difference: 0 });
  assert.equal(exported.payments.vcb.difference, 1000); assert.equal(exported.payments.momo.difference, 100); assert.equal(exported.payments.zalop.difference, 200);
  assert.equal(exported.totals.bookCash, 2099000); assert.equal(exported.totals.difference, -1519000);
  assert.equal(exported.result, raw.result); assert.equal(exported.recheck, raw.recheck);
  assert.equal(report.labels.result, 'Kết quả chốt két'); assert.equal(report.labels.recheck, 'Các bill đã hủy');
});
test('details retain category names, timestamps, linked-entry status and POS transfer metadata', () => {
  const row = exportState(fixture()).stores[0].closingBookReport.months[0].days[0].shifts[0];
  assert.equal(row.details.income.count, 1); assert.equal(row.details.income.transferredCount, 1);
  assert.equal(row.details.income.rows[0].categoryName, 'Thu QA'); assert.equal(row.details.income.rows[0].linkedEntry.status, 'cancelled');
  assert.equal(row.details.income.rows[0].createdAt, '2026-10-01T09:00:00Z'); assert.equal(row.details.income.rows[0].timeSource, 'saved');
  assert.equal(row.details.expense.rows[0].unknownMetadata, 'KEPT_IN_SOURCE'); assert.equal(row.details.expense.rows[0].transferred, false);
  assert.equal(row.posTransfer.transferred, true); assert.equal(row.posTransfer.linkedEntry.id, 'pos-entry'); assert.equal(row.posTransfer.categoryName, 'Thu QA');
});
test('monthly audit exports all five independent shortages/surpluses, netted per day just like Kiểm kê', () => {
  const state = fixture(), report = exportState(state).stores[0].closingBookReport;
  report.months.forEach((month, index) => {
    for (const direction of ['shortage', 'surplus']) {
      assert.deepEqual(month.audit[direction], JSON.parse(JSON.stringify(context.buildClosingBookAuditReports(state.stores[0].closingMonths[index], 'all', direction))));
      assert.equal(month.audit[direction].length, 5);
      assert.ok(month.audit[direction].every(item => !item.rows.some(day => day.date === '2026-10-02')), 'offsetting shifts are not a shortage/surplus day');
    }
  });
});
test('legacy split income/expense columns are included without rewriting raw historical records', () => {
  const state = fixture(), raw = shift({ income1: [{ note: 'Cũ 1', amount: 10 }], income2: [{ note: 'Cũ 2', amount: 20 }], expense1: [{ note: 'Chi cũ', amount: 5 }], expense2: [] });
  delete raw.income; delete raw.expense;
  state.stores[0].closingMonths[0].days[0].shifts = [raw];
  const result = exportState(state), exported = result.stores[0].closingBookReport.months[0].days[0].shifts[0];
  assert.equal(exported.details.income.count, 2); assert.equal(exported.totals.income, 30); assert.equal(exported.totals.expense, 5);
  assert.deepEqual(result.stores[0].closingMonths[0].days[0].shifts[0], raw);
});
test('bad or overflowing old calculations keep the complete raw backup and explicit errors, never fake zero totals', () => {
  for (const changes of [{ opening: 'invalid' }, { opening: Number.MAX_SAFE_INTEGER, income: [{ amount: 1 }] }]) {
    const state = fixture(); Object.assign(state.stores[0].closingMonths[0].days[0].shifts[0], changes);
    const result = exportState(state), report = result.stores[0].closingBookReport;
    assert.deepEqual(result.stores[0].closingMonths, state.stores[0].closingMonths); assert.equal(report.complete, false);
    assert.ok(report.errors.length); assert.ok(report.months[0].days[0].shifts[0].error); assert.equal(report.months[0].days[0].shifts[0].totals, undefined);
    assert.equal(report.months[1].audit.surplus[4].total, 250);
  }
});
test('export-only reports are discarded on import while all saved closing-month data round-trips', () => {
  const state = fixture(), exported = exportState(state), ctx = { today: '2026-10-15', createId: () => 'id', getEarliestEntryDate: () => '', normalizeExportReasons: () => [], normalizeStoreSalesBills: store => ({ orders: store.orders || [], salesBillSequences: store.salesBillSequences || {} }) };
  vm.createContext(ctx); vm.runInContext(app.slice(app.indexOf('function normalizeState('), app.indexOf('function saveAndRender(')), ctx);
  const imported = JSON.parse(JSON.stringify(ctx.normalizeState(exported)));
  assert.deepEqual(imported.stores[0].closingMonths, state.stores[0].closingMonths);
  assert.equal(Object.hasOwn(imported.stores[0], 'closingBookReport'), false);
});
test('even structurally damaged legacy closing data can still be backed up without loss', () => {
  for (const damaged of [[null], [{ month: '2026-10', days: [null] }]]) {
    const state = fixture(); state.stores[0].closingMonths = damaged;
    const result = exportState(state);
    assert.deepEqual(result.stores[0].closingMonths, damaged);
    assert.equal(result.stores[0].closingBookReport.complete, false);
    assert.ok(result.stores[0].closingBookReport.errors.length);
    assert.equal(result.stores[1].closingBookReport.complete, true);
  }
});
