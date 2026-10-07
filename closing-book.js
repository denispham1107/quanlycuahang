/* Separate daily cash reconciliation; never creates income/expense entries. */
const closingBook = {
  page: document.querySelector('#closingBookPage'),
  form: document.querySelector('#closingBookForm'),
  month: document.querySelector('#closingBookMonth'),
  day: document.querySelector('#closingBookDay'),
  shift: document.querySelector('#closingBookShift'),
  message: document.querySelector('#closingBookMessage'),
  storeId: null, draft: null, dirty: false, monthKey: '', dayKey: '', shiftIndex: 0,
  shifts: [], saving: false
};
const closingBookIcon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="bookCover" x2="1" y2="1"><stop stop-color="#8e49ee"/><stop offset="1" stop-color="#176bd2"/></linearGradient></defs><path d="M15 8h33c4 0 6 3 6 6v39H20c-7 0-10-4-10-9V15c0-4 2-7 5-7Z" fill="#254283"/><path d="M19 6h30c3 0 5 2 5 5v35H20c-4 0-7 2-7 5V13c0-4 2-7 6-7Z" fill="url(#bookCover)"/><path d="M21 6v39" stroke="#c3bcff" stroke-width="2"/><path d="M21 46h31v9H21c-6 0-8-2-8-5s3-4 8-4Z" fill="#fff5de"/><path d="M24 49h25M23 52h25" stroke="#baa6cc" stroke-width="1.4"/><path d="M29 17h16M29 22h12M29 27h16" stroke="#eee7ff" stroke-width="2.2" stroke-linecap="round"/><path d="M43 35v22l-5-4-5 4V35Z" fill="#ffbd60"/><path d="m35 35 3 3 5-6" fill="none" stroke="#653488" stroke-width="2.3" stroke-linecap="round"/><path d="M15 16h3M15 23h3M15 30h3M15 37h3" stroke="#ded5ff" stroke-width="1.5"/><path d="M24 9h23" stroke="#c3b4ff" stroke-linecap="round" opacity=".55"/></svg>`;
// SVG gradient IDs are unique per displayed button.
document.querySelectorAll('.closing-book-icon, .closing-book-emblem').forEach((element,index)=> {
  element.innerHTML=closingBookIcon.replaceAll('bookCover',`bookCover${index}`);
});

function closingBookAllowed() { return isAdminUser() && els.authScreen.hidden && Boolean(getActiveStore()); }
function closingBookNotice(message, error=false) {
  closingBook.message.textContent=message;
  closingBook.message.classList.toggle('is-error',error);
}
function closingBookDiscard() {
  if (closingBook.dirty && !window.confirm('Sổ đang có thay đổi chưa lưu. Bạn muốn bỏ thay đổi này?')) return false;
  closingBook.dirty=false;
  return true;
}
function refreshClosingBookAccess() {
  const allowed=closingBookAllowed();
  document.querySelector('#openClosingBookDesktop').hidden=!allowed || getActiveTabName()!=='overview';
  document.querySelector('#openClosingBookMobile').hidden=!allowed;
  if (!closingBook.page.hidden && (!allowed || closingBook.storeId!==getActiveStore()?.id)) hideClosingBookPage({force:true});
  if (allowed && closingBook.page.hidden && window.location.hash==='#closing-book') openClosingBookPage({fromHistory:true});
}
function openClosingBookPage({fromHistory=false}={}) {
  if (!closingBookAllowed()) return;
  if (!closingBook.page.hidden) return;
  closingBook.storeId=getActiveStore().id;
  closingBook.dirty=false;
  closingBook.page.hidden=false;
  document.body.classList.add('closing-book-open');
  els.appShell.inert=true;
  els.appShell.setAttribute('aria-hidden','true');
  els.tabBar.inert=true;
  if (!fromHistory) window.history.pushState({closingBookPage:true},'', '#closing-book');
  document.querySelector('#closingBookStore').textContent=getActiveStore().name;
  const now=new Date();
  document.querySelector('#closingBookNewMonth').value=`${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  renderClosingBookMonths();
  updateTimeFiltersVisibility();
  closingBook.page.scrollTop=0;
  document.querySelector('#closeClosingBook').focus({preventScroll:true});
}
function hideClosingBookPage({force=false}={}) {
  if (closingBook.page.hidden) return true;
  if (!force && !closingBookDiscard()) return false;
  closingBook.page.hidden=true;
  closingBook.dirty=false;
  closingBook.draft=null;
  closingBook.shifts=[];
  document.body.classList.remove('closing-book-open');
  els.appShell.inert=false;
  els.appShell.removeAttribute('aria-hidden');
  els.tabBar.inert=false;
  if (window.location.hash==='#closing-book') window.history.replaceState(window.history.state,'',`${window.location.pathname}${window.location.search}`);
  updateTimeFiltersVisibility();
  return true;
}
window.refreshClosingBookAccess=refreshClosingBookAccess;
window.hideClosingBookPage=hideClosingBookPage;
window.refreshClosingBookSync=(message,status)=> {
  const element=document.querySelector('#closingBookSync');
  element.textContent=message;
  element.classList.toggle('is-error',status==='error');
};
document.querySelectorAll('.closing-book-icon').forEach(button=>button.addEventListener('click',()=>openClosingBookPage()));
document.querySelector('#closeClosingBook').addEventListener('click',()=> {
  if (!closingBookDiscard()) return;
  if (window.history.state?.closingBookPage && window.location.hash==='#closing-book') window.history.back();
  else hideClosingBookPage();
});
window.addEventListener('popstate',()=> {
  if (window.location.hash==='#closing-book' && closingBookAllowed()) openClosingBookPage({fromHistory:true});
  else if (!hideClosingBookPage()) window.history.pushState({closingBookPage:true},'','#closing-book');
});
window.addEventListener('beforeunload',event=> {
  if (closingBook.dirty) { event.preventDefault(); event.returnValue=''; }
});
function closingBookMonthData() { return (getActiveStore()?.closingMonths||[]).find(month=>month.month===closingBook.monthKey); }
function renderClosingBookMonths(preferred='') {
  const months=(getActiveStore().closingMonths||[]).slice().sort((a,b)=>b.month.localeCompare(a.month));
  closingBook.month.innerHTML=months.map(month=>`<option value="${escapeHtml(month.month)}">Tháng ${escapeHtml(month.month.slice(5))}/${escapeHtml(month.month.slice(0,4))}</option>`).join('');
  closingBook.month.disabled=!months.length;
  closingBook.month.value=months.some(m=>m.month===preferred)?preferred:(months[0]?.month||'');
  document.querySelector('#closingBookEmpty').hidden=months.length>0;
  document.querySelector('#closingBookEditor').hidden=!months.length;
  closingBook.day.disabled=!months.length;
  if (months.length) loadClosingBookMonth();
  else { closingBook.day.replaceChildren(); closingBookNotice(''); }
}
function loadClosingBookMonth() {
  closingBook.monthKey=closingBook.month.value;
  const month=closingBookMonthData();
  const days=ClosingBookCore.monthDays(closingBook.monthKey);
  closingBook.day.innerHTML=Array.from({length:days},(_,index)=> {
    const date=`${closingBook.monthKey}-${String(index+1).padStart(2,'0')}`;
    const saved=month.days?.some(day=>day.date===date);
    return `<option value="${date}">Ngày ${index+1}${saved?' · Đã lưu':''}</option>`;
  }).join('');
  loadClosingBookDay();
}
function loadClosingBookDay() {
  closingBook.dayKey=closingBook.day.value;
  const saved=closingBookMonthData().days?.find(day=>day.date===closingBook.dayKey);
  closingBook.shifts=JSON.parse(JSON.stringify(saved?.shifts?.length?saved.shifts:[ClosingBookCore.emptyShift()])).map(ClosingBookCore.normalizeShift);
  closingBook.shiftIndex=0;
  document.querySelector('#closingBookSaved').textContent=saved?`Đã lưu ${formatActivityDateTime(saved.updatedAt)}`:'Ngày chưa lưu';
  renderClosingBookShiftOptions();
  renderClosingBookShift();
  closingBookNotice('');
}
function renderClosingBookShiftOptions() {
  closingBook.shift.innerHTML=closingBook.shifts.map((shift,index)=>`<option value="${index}">Ca ${index+1}${shift.name?' · '+escapeHtml(shift.name):''}</option>`).join('');
  closingBook.shift.value=String(closingBook.shiftIndex);
  document.querySelector('#closingBookAddShift').disabled=closingBook.shifts.length>=4;
}
const closingBookLabels={opening:'Tiền trong két đếm đầu ca',pos:'POS · Tổng tất cả bill',vcb:'Bill VCB',momo:'Bill Momo',zalop:'Bill Zalop',cash:'Bill Tiền mặt',actualVcb:'VCB thực tế',actualMomo:'Momo thực tế',actualZalop:'Zalop thực tế',ending:'Tiền trong két đếm cuối ca'};
function closingBookMoneyField(key,value) { return `<label>${closingBookLabels[key]}<input name="${key}" type="text" inputmode="numeric" autocomplete="off" value="${escapeHtml(String(value??''))}" placeholder="0" /></label>`; }
function renderClosingBookShift() {
  closingBook.draft=closingBook.shifts[closingBook.shiftIndex];
  const shift=closingBook.draft;
  document.querySelector('#closingBookFields').innerHTML=`<label>Tên / Người chốt ca<input name="name" type="text" maxlength="2000" value="${escapeHtml(shift.name||'')}" /></label>`+['opening','pos','vcb','momo','zalop','cash','ending'].map(key=>closingBookMoneyField(key,shift[key])).join('');
  document.querySelector('#closingBookPayments').innerHTML=['POS','VCB','Momo','Zalop'].map((label,index)=>`<article><h3>${label}</h3><p>Trong sổ <strong data-book-payment="${index}"></strong></p>${index===0?'<p>Thực tế <strong id="closingBookActualPos"></strong></p>':closingBookMoneyField(['','actualVcb','actualMomo','actualZalop'][index],shift[['','actualVcb','actualMomo','actualZalop'][index]])}<p>Chênh lệch <strong data-payment-difference="${index}"></strong></p></article>`).join('');
  closingBook.form.elements.result.value=shift.result||'';
  closingBook.form.elements.recheck.value=shift.recheck||'';
  renderClosingBookEntries();
  updateClosingBookCalculations();
}
function renderClosingBookEntries() {
  document.querySelector('#closingBookEntries').innerHTML=ClosingBookCore.groups.map((key,index)=> {
    const rows=closingBook.draft[key];
    const label=index===0?'Thu':'Chi';
    return `<section class="closing-book-section ${index===0?'book-income':'book-expense'}" data-book-group="${key}"><div class="closing-book-group-heading"><h2>Khoản ${label}</h2><button type="button" data-book-add="${key}" aria-label="Thêm khoản ${label.toLowerCase()}" ${rows.length>=ClosingBookCore.maxRows?'disabled':''}>＋</button></div><div class="closing-book-rows">${rows.map((row,i)=>`<div class="closing-book-row"><label>Nội dung<input data-book-note="${key}" data-row="${i}" type="text" maxlength="1000" value="${escapeHtml(row.note||'')}" /></label><label>Số tiền<input data-book-amount="${key}" data-row="${i}" type="text" inputmode="numeric" value="${escapeHtml(String(row.amount??''))}" placeholder="0" /></label><button type="button" data-book-remove="${key}" data-row="${i}" aria-label="Xóa dòng ${i+1}">×</button></div>`).join('')}</div><p class="closing-book-group-total">Tổng ${label.toLowerCase()} <strong data-book-total="${key}"></strong></p></section>`;
  }).join('');
}
function updateClosingBookCalculations() {
  try {
    const result=ClosingBookCore.calculate(closingBook.draft);
    const shift=closingBook.draft;
    ['pos','vcb','momo','zalop'].forEach((key,index)=> {
      document.querySelector(`[data-book-payment="${index}"]`).textContent=formatCurrency(ClosingBookCore.parseMoney(shift[key]));
      const value=result[['posDifference','vcbDifference','momoDifference','zalopDifference'][index]];
      const element=document.querySelector(`[data-payment-difference="${index}"]`);
      element.textContent=formatCurrency(value); element.classList.toggle('book-mismatch',value!==0);
    });
    document.querySelector('#closingBookActualPos').textContent=formatCurrency(result.actualPos);
    ClosingBookCore.groups.forEach(key=>document.querySelector(`[data-book-total="${key}"]`).textContent=formatCurrency(result[key]));
    document.querySelector('#closingBookTotals').innerHTML=[['Tổng thu',result.income],['Tổng chi',result.expense],['Tiền két theo sổ sách',result.bookCash],['Kiểm tra tiền két',result.difference]].map(([label,value])=>`<div><span>${label}</span><strong class="${label==='Kiểm tra tiền két'&&value!==0?'book-mismatch':''}">${formatCurrency(value)}</strong></div>`).join('');
    closingBookNotice('');
  } catch(error) {
    document.querySelector('#closingBookTotals').textContent='Chưa thể tính vì số tiền không hợp lệ.';
    document.querySelectorAll('[data-book-payment], [data-payment-difference], [data-book-total], #closingBookActualPos').forEach(el=>el.textContent='—');
    closingBookNotice(error.message,true);
  }
}
closingBook.form.addEventListener('input',event=> {
  if (!closingBook.draft || closingBook.saving) return;
  const target=event.target;
  if (target.dataset.bookNote) closingBook.draft[target.dataset.bookNote][Number(target.dataset.row)].note=target.value;
  else if (target.dataset.bookAmount) closingBook.draft[target.dataset.bookAmount][Number(target.dataset.row)].amount=target.value;
  else if (target.name) closingBook.draft[target.name]=target.value;
  closingBook.dirty=true;
  updateClosingBookCalculations();
});
closingBook.form.addEventListener('click',event=> {
  const add=event.target.closest('[data-book-add]');
  const remove=event.target.closest('[data-book-remove]');
  if (!add&&!remove) return;
  const key=add?.dataset.bookAdd||remove.dataset.bookRemove;
  if (add && closingBook.draft[key].length<ClosingBookCore.maxRows) closingBook.draft[key].push({note:'',amount:''});
  if (remove) closingBook.draft[key].splice(Number(remove.dataset.row),1);
  closingBook.dirty=true;
  renderClosingBookEntries(); updateClosingBookCalculations();
});
closingBook.month.addEventListener('change',()=> {
  if (!closingBookDiscard()) { closingBook.month.value=closingBook.monthKey; return; }
  loadClosingBookMonth();
});
closingBook.day.addEventListener('change',()=> {
  if (!closingBookDiscard()) { closingBook.day.value=closingBook.dayKey; return; }
  loadClosingBookDay();
});
closingBook.shift.addEventListener('change',()=> {
  closingBook.shiftIndex=Number(closingBook.shift.value); renderClosingBookShift();
});
document.querySelector('#closingBookAddShift').addEventListener('click',()=> {
  if (closingBook.shifts.length>=4) return;
  closingBook.shifts.push(ClosingBookCore.emptyShift());
  closingBook.shiftIndex=closingBook.shifts.length-1;
  closingBook.dirty=true; renderClosingBookShiftOptions(); renderClosingBookShift();
});
function commitClosingBookMonths(months,activity) {
  const store=getActiveStore();
  if (!closingBookAllowed() || store.id!==closingBook.storeId) throw new Error('Không còn quyền chốt sổ cho cửa hàng này.');
  const candidate={...state,stores:state.stores.map(item=>item.id===store.id?{...item,closingMonths:months}:item)};
  if (new TextEncoder().encode(JSON.stringify(candidate)).length>900000) throw new Error('Dữ liệu cửa hàng gần giới hạn đồng bộ. Chưa lưu thay đổi; hãy sao lưu và giảm dữ liệu trước.');
  store.closingMonths=months;
  recordActivity(store,'update','Chốt sổ',activity,{tab:'overview',targetDate:closingBook.dayKey});
  saveAndRender();
}
document.querySelector('#closingBookCreateMonth').addEventListener('submit',event=> {
  event.preventDefault();
  const wasDirty=closingBook.dirty;
  try {
    if (!closingBookAllowed()) throw new Error('Bạn không có quyền tạo tháng chốt sổ.');
    const value=document.querySelector('#closingBookNewMonth').value.trim();
    const match=value.match(/^(\d{1,2})\/(\d{4})$/);
    const month=match?`${match[2]}-${match[1].padStart(2,'0')}`:'';
    if (!ClosingBookCore.validMonth(month)) throw new Error('Nhập tháng theo dạng MM/YYYY, ví dụ 09/2026.');
    if (!closingBookDiscard()) return;
    const months=getActiveStore().closingMonths||[];
    if (months.some(item=>item.month===month)) { renderClosingBookMonths(month); closingBookNotice('Tháng này đã có sổ, không tạo trùng.'); return; }
    commitClosingBookMonths([...months,{month,days:[]}],`Tạo tháng chốt sổ ${value}`);
    renderClosingBookMonths(month); closingBookNotice('Đã tạo tháng. Chọn ngày để nhập chốt sổ.');
  } catch(error) { closingBook.dirty=wasDirty; closingBookNotice(error.message,true); }
});
closingBook.form.addEventListener('submit',async event=> {
  event.preventDefault();
  if (closingBook.saving) return;
  try {
    const shifts=closingBook.shifts.map(shift=>ClosingBookCore.validateShift(shift));
    shifts.forEach(shift=>ClosingBookCore.calculate(shift));
    if (!closingBook.dayKey.startsWith(closingBook.monthKey+'-')) throw new Error('Ngày không thuộc tháng đang chọn.');
    const months=JSON.parse(JSON.stringify(getActiveStore().closingMonths||[]));
    const month=months.find(item=>item.month===closingBook.monthKey);
    if (!month) throw new Error('Tháng không còn tồn tại.');
    const day={date:closingBook.dayKey,shifts,updatedAt:new Date().toISOString()};
    month.days=(month.days||[]).filter(item=>item.date!==day.date); month.days.push(day);
    closingBook.saving=true;
    commitClosingBookMonths(months,`Lưu chốt sổ ngày ${formatDate(day.date)} (${shifts.length} ca)`);
    closingBook.dirty=false;
    document.querySelector('#closingBookSaved').textContent=`Đã lưu ${formatActivityDateTime(day.updatedAt)}`;
    const option=closingBook.day.selectedOptions[0]; if (option&&!option.textContent.includes('Đã lưu')) option.textContent+=' · Đã lưu';
    closingBookNotice('Đã lưu trên thiết bị. '+(els.syncStatus?.textContent||''));
  } catch(error) { closingBookNotice(error.message,true); }
  finally { closingBook.saving=false; }
});
closingBook.page.addEventListener('focusin',event=> {
  if (event.target.matches('input,select,textarea')) [100,350].forEach(delay=>setTimeout(()=>event.target.isConnected&&event.target.scrollIntoView({block:'nearest',behavior:'smooth'}),delay));
});
function updateClosingBookViewport() {
  const viewport=window.visualViewport;
  closingBook.page.style.setProperty('--book-height',`${viewport?.height||window.innerHeight}px`);
  closingBook.page.style.setProperty('--book-top',`${viewport?.offsetTop||0}px`);
  if (!closingBook.page.hidden && closingBook.page.contains(document.activeElement)) document.activeElement.scrollIntoView({block:'nearest'});
}
window.visualViewport?.addEventListener('resize',updateClosingBookViewport);
window.visualViewport?.addEventListener('scroll',updateClosingBookViewport);
window.addEventListener('resize',updateClosingBookViewport);
updateClosingBookViewport(); refreshClosingBookAccess();
window.refreshClosingBookSync(els.syncStatus?.textContent||'',els.syncStatus?.dataset.status||'');
