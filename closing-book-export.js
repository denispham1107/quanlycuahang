(function (root) {
  const valueLabels = {
    opening: 'Tiền trong két đếm đầu ca', pos: 'POS · Tổng tất cả bill',
    vcb: 'Bill VCB', momo: 'Bill Momo', zalop: 'Bill Zalop', cash: 'Bill Tiền mặt',
    actualVcb: 'VCB thực tế', actualMomo: 'Momo thực tế', actualZalop: 'Zalop thực tế',
    ending: 'Tiền trong két đếm cuối ca'
  };
  const totalLabels = {
    income: 'Tổng thu', expense: 'Tổng chi', bookCash: 'Tiền két theo sổ sách',
    difference: 'Kiểm tra tiền két', actualPos: 'POS thực tế',
    posDifference: 'POS chênh lệch', vcbDifference: 'VCB chênh lệch',
    momoDifference: 'Momo chênh lệch', zalopDifference: 'Zalop chênh lệch'
  };

  // A derived, read-only companion to closingMonths. Never modify the backup source
  // or validate/rewrite old rows just to export them; unknown metadata stays intact.
  function buildReport(store, core, auditReports) {
    const errors = [];
    const entries = Array.isArray(store.entries) ? store.entries : [];
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const byRow = new Map(entries.filter(entry => entry.closingBookRowId).map(entry => [entry.closingBookRowId, entry]));
    const linkedEntry = (row, type) => {
      const entry = (row.transferredEntryId ? byId.get(row.transferredEntryId) : null) || (row.id ? byRow.get(row.id) : null);
      const category = (store.categories?.[type] || []).find(item => item.id === row.categoryId);
      return {
        ...row, categoryName: category?.name || null,
        transferred: Boolean(row.transferredEntryId || entry),
        linkedEntry: entry ? { ...entry } : null
      };
    };
    const months = (store.closingMonths || []).map(month => {
      const days = (Array.isArray(month.days) ? month.days : []).map(day => ({
        date: day.date, updatedAt: day.updatedAt || null,
        shifts: (Array.isArray(day.shifts) ? day.shifts : []).map((raw, index) => {
          const context = { month: month.month, date: day.date, shiftIndex: index + 1 };
          try {
            const shift = core.normalizeShift(raw), totals = core.calculate(shift);
            const values = Object.fromEntries(core.moneyKeys.map(key => [key, core.parseMoney(shift[key])]));
            const details = Object.fromEntries(core.groups.map(type => {
              const rows = (shift[type] || []).map(row => linkedEntry(row, type));
              return [type, { total: totals[type], count: rows.length, transferredCount: rows.filter(row => row.transferred).length, rows }];
            }));
            return {
              index: index + 1, name: String(shift.name || ''), values,
              payments: {
                pos: { label: 'POS', book: values.pos, actual: totals.actualPos, difference: totals.posDifference },
                vcb: { label: 'VCB', book: values.vcb, actual: values.actualVcb, difference: totals.vcbDifference },
                momo: { label: 'Momo', book: values.momo, actual: values.actualMomo, difference: totals.momoDifference },
                zalop: { label: 'Zalop', book: values.zalop, actual: values.actualZalop, difference: totals.zalopDifference }
              },
              totals, details, posTransfer: shift.posTransfer ? linkedEntry(shift.posTransfer, 'income') : null,
              result: String(shift.result || ''), recheck: String(shift.recheck || '')
            };
          } catch (error) {
            const message = String(error.message || error);
            errors.push({ ...context, message });
            return { index: index + 1, name: String(raw?.name || ''), error: message };
          }
        })
      }));
      let audit;
      try {
        // Reuse precisely the five independent, daily-netted reports shown by
        // Kiểm kê. Do not add together different payment/cash discrepancies.
        audit = {
          shortage: auditReports(month, 'all', 'shortage'),
          surplus: auditReports(month, 'all', 'surplus')
        };
      } catch (error) {
        const message = String(error.message || error);
        errors.push({ month: month.month, section: 'audit', message });
        audit = { error: message };
      }
      return { month: month.month, savedDays: days.length, shiftCount: days.reduce((sum, day) => sum + day.shifts.length, 0), days, audit };
    });
    return {
      schemaVersion: 1, storeId: store.id, storeName: store.name, currency: 'VND',
      savedDataOnly: true, source: 'closingMonths',
      labels: { values: { ...valueLabels }, totals: { ...totalLabels }, result: 'Kết quả chốt két', recheck: 'Các bill đã hủy' },
      monthCount: months.length, savedDays: months.reduce((sum, month) => sum + month.savedDays, 0),
      shiftCount: months.reduce((sum, month) => sum + month.shiftCount, 0),
      complete: errors.length === 0, errors, months
    };
  }
  const api = { buildReport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClosingBookExport = api;
})(typeof window === 'undefined' ? globalThis : window);
