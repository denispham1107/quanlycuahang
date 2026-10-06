(function (root) {
  const moneyKeys = ['opening', 'pos', 'vcb', 'momo', 'zalop', 'cash', 'actualVcb', 'actualMomo', 'actualZalop', 'cancelled', 'ending'];
  const groups = ['income1', 'income2', 'expense1', 'expense2'];
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
    const shift = { name: String(raw.name || '').trim(), result: String(raw.result || '').trim(), recheck: String(raw.recheck || '').trim() };
    if ([shift.name,shift.result,shift.recheck].some(v=>v.length>2000)) throw new Error('Nội dung quá dài (tối đa 2.000 ký tự).');
    moneyKeys.forEach(key => { shift[key] = parseMoney(raw[key]); });
    groups.forEach(key => {
      if (!Array.isArray(raw[key]) || raw[key].length > 21) throw new Error('Mỗi nhóm thu/chi có tối đa 21 dòng theo mẫu.');
      shift[key] = raw[key].filter(row=>String(row.note||'').trim() || String(row.amount??'').trim()).map(row=> {
        const note = String(row.note||'').trim();
        if (!note || note.length>1000) throw new Error('Mỗi khoản thu/chi cần nội dung (tối đa 1.000 ký tự).');
        if (!String(row.amount??'').trim()) throw new Error(`Khoản "${note}" chưa có số tiền.`);
        return {note,amount:parseMoney(row.amount)};
      });
    });
    return shift;
  }
  function calculate(shift) {
    const sums = Object.fromEntries(groups.map(key=>[key,(shift[key]||[]).reduce((sum,row)=>sum+parseMoney(row.amount),0)]));
    const income = sums.income1+sums.income2;
    const expense = sums.expense1+sums.expense2;
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
  const api={moneyKeys,groups,parseMoney,validMonth,monthDays,emptyShift,validateShift,calculate};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.ClosingBookCore=api;
})(typeof window === 'undefined' ? globalThis : window);
