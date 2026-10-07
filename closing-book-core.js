(function (root) {
  const moneyKeys = ['opening', 'pos', 'vcb', 'momo', 'zalop', 'cash', 'actualVcb', 'actualMomo', 'actualZalop', 'ending'];
  const groups = ['income', 'expense'];
  const maxRows = 42; // Preserve the capacity of both former 21-row groups.
  function normalizeShift(raw) {
    const {income1, income2, expense1, expense2, ...shift} = raw;
    groups.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        shift[key] = Array.isArray(raw[key]) ? raw[key].map(row => ({...row})) : raw[key];
      } else {
        const legacy = key === 'income' ? [income1, income2] : [expense1, expense2];
        shift[key] = legacy.every(rows => rows === undefined || Array.isArray(rows))
          ? legacy.flatMap(rows => (rows || []).map(row => ({...row}))) : null;
      }
    });
    return shift;
  }
  function parseMoney(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return 0;
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(raw)) throw new Error('Số tiền phải là số nguyên không âm; có thể dùng dấu chấm ngăn hàng nghìn.');
    const number = Number(raw.replace(/\./g, ''));
    if (!Number.isSafeInteger(number)) throw new Error('Số tiền quá lớn.');
    return number;
  }
  function validMonth(value) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0,4)) >= 1900 && Number(value.slice(0,4)) <= 9999; }
  function monthDays(month) {
    if (!validMonth(month)) throw new Error('Tháng không hợp lệ.');
    return new Date(Number(month.slice(0,4)), Number(month.slice(5)), 0).getDate();
  }
  function emptyShift() {
    return { name: '', result: '', recheck: '', ...Object.fromEntries(moneyKeys.map(k => [k, ''])), ...Object.fromEntries(groups.map(k => [k, [{note:'',amount:''}]])) };
  }
  function validateShift(raw) {
    raw = normalizeShift(raw);
    const shift = { name: String(raw.name || '').trim(), result: String(raw.result || '').trim(), recheck: String(raw.recheck || '').trim() };
    // The removed numeric field is retained only as legacy metadata, never in calculations.
    if (Object.prototype.hasOwnProperty.call(raw, 'cancelled')) shift.cancelled = raw.cancelled;
    if ([shift.name,shift.result,shift.recheck].some(v=>v.length>2000)) throw new Error('Nội dung quá dài (tối đa 2.000 ký tự).');
    moneyKeys.forEach(key => { shift[key] = parseMoney(raw[key]); });
    groups.forEach(key => {
      if (!Array.isArray(raw[key]) || raw[key].length > maxRows) throw new Error('Mỗi cột thu/chi có tối đa 42 dòng.');
      shift[key] = raw[key].filter(row=>String(row.note||'').trim() || String(row.amount??'').trim()).map(row=> {
        const note = String(row.note||'').trim();
        if (!note || note.length>1000) throw new Error('Mỗi khoản thu/chi cần nội dung (tối đa 1.000 ký tự).');
        if (!String(row.amount??'').trim()) throw new Error(`Khoản "${note}" chưa có số tiền.`);
        const result = {note,amount:parseMoney(row.amount)};
        ['id','createdAt','categoryId','transferredEntryId'].forEach(key=> {
          if (typeof row[key] === 'string' && row[key]) result[key] = row[key];
        });
        if (row.timeSource === 'saved') result.timeSource = 'saved';
        return result;
      });
    });
    return shift;
  }
  function transferEntry(row, {type,date,categories,entries,entryId}) {
    if (!groups.includes(type)) throw new Error('Loại khoản không hợp lệ.');
    if (row.transferredEntryId || entries.some(entry=>entry.closingBookRowId===row.id)) throw new Error('Khoản này đã được chuyển, không tạo trùng.');
    if (!categories.some(category=>category.id===row.categoryId)) throw new Error('Vui lòng chọn Mục cho khoản '+(type==='income'?'Thu.':'Chi.'));
    const amount=parseMoney(row.amount);
    if (amount<=0) throw new Error('Số tiền chuyển phải lớn hơn 0.');
    if (!row.id || !row.createdAt || !Number.isFinite(Date.parse(row.createdAt))) throw new Error('Khoản chưa có thời điểm tạo. Hãy lưu chốt sổ trước.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Ngày chốt sổ không hợp lệ.');
    return {id:entryId,type,categoryId:row.categoryId,date,amount,note:row.note,createdAt:row.createdAt,closingBookRowId:row.id};
  }
  function calculate(shift) {
    shift = normalizeShift(shift);
    const sums = Object.fromEntries(groups.map(key=>[key,(shift[key]||[]).reduce((sum,row)=>sum+parseMoney(row.amount),0)]));
    const {income, expense} = sums;
    const actualPos = parseMoney(shift.vcb)+parseMoney(shift.momo)+parseMoney(shift.zalop)+parseMoney(shift.cash);
    const bookCash = parseMoney(shift.opening)+income-expense+parseMoney(shift.cash);
    const difference = parseMoney(shift.ending)-bookCash;
    const result = {...sums,income,expense,actualPos,bookCash,difference,
      posDifference:actualPos-parseMoney(shift.pos),
      vcbDifference:parseMoney(shift.actualVcb)-parseMoney(shift.vcb),
      momoDifference:parseMoney(shift.actualMomo)-parseMoney(shift.momo),
      zalopDifference:parseMoney(shift.actualZalop)-parseMoney(shift.zalop)};
    if (Object.values(result).some(value=>!Number.isSafeInteger(value))) throw new Error('Tổng tiền vượt giới hạn an toàn.');
    return result;
  }
  const api={moneyKeys,groups,maxRows,normalizeShift,parseMoney,validMonth,monthDays,emptyShift,validateShift,calculate,transferEntry};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.ClosingBookCore=api;
})(typeof window === 'undefined' ? globalThis : window);
