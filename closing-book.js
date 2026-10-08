/* Daily cash reconciliation; only explicit confirmed transfers create entries. */
const closingBook = {
  page: document.querySelector('#closingBookPage'),
  form: document.querySelector('#closingBookForm'),
  month: document.querySelector('#closingBookMonth'),
  day: document.querySelector('#closingBookDay'),
  shift: document.querySelector('#closingBookShift'),
  message: document.querySelector('#closingBookMessage'),
  storeId: null, draft: null, dirty: false, monthKey: '', dayKey: '', shiftIndex: 0,
  shifts: [], saving: false, detailType: null, mainScroll: 0, selectedRows: new Set(), daySnapshot: '[]'
};
const closingPos={modal:document.querySelector('#closingPosModal'),form:document.querySelector('#closingPosForm'),session:null,busy:false};
const closingBookIcon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="bookCover" x2="1" y2="1"><stop stop-color="#8e49ee"/><stop offset="1" stop-color="#176bd2"/></linearGradient></defs><path d="M15 8h33c4 0 6 3 6 6v39H20c-7 0-10-4-10-9V15c0-4 2-7 5-7Z" fill="#254283"/><path d="M19 6h30c3 0 5 2 5 5v35H20c-4 0-7 2-7 5V13c0-4 2-7 6-7Z" fill="url(#bookCover)"/><path d="M21 6v39" stroke="#c3bcff" stroke-width="2"/><path d="M21 46h31v9H21c-6 0-8-2-8-5s3-4 8-4Z" fill="#fff5de"/><path d="M24 49h25M23 52h25" stroke="#baa6cc" stroke-width="1.4"/><path d="M29 17h16M29 22h12M29 27h16" stroke="#eee7ff" stroke-width="2.2" stroke-linecap="round"/><path d="M43 35v22l-5-4-5 4V35Z" fill="#ffbd60"/><path d="m35 35 3 3 5-6" fill="none" stroke="#653488" stroke-width="2.3" stroke-linecap="round"/><path d="M15 16h3M15 23h3M15 30h3M15 37h3" stroke="#ded5ff" stroke-width="1.5"/><path d="M24 9h23" stroke="#c3b4ff" stroke-linecap="round" opacity=".55"/></svg>`;
// SVG gradient IDs are unique per displayed button.
document.querySelectorAll('.closing-book-icon, .closing-book-emblem').forEach((element,index)=> {
  element.innerHTML=closingBookIcon.replaceAll('bookCover',`bookCover${index}`);
});

function closingBookAllowed() {
  const store=getActiveStore();
  return els.authScreen.hidden && Boolean(store) && (isAdminUser() || (isEmployeeUser() && employeeCan('closingBook','manage') && store.id===authState.profile?.storeId));
}
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
  const employee=isEmployeeUser();
  document.querySelector('#openClosingBookDesktop').hidden=employee || !allowed || getActiveTabName()!=='overview';
  document.querySelector('#openClosingBookMobile').hidden=employee || !allowed;
  document.querySelector('#employeeOverviewAccess').hidden=!employee || !els.authScreen.hidden;
  document.querySelector('#employeeOverviewStoreName').textContent=getActiveStore()?.name || 'Chưa chọn cửa hàng';
  const employeeIcon=document.querySelector('#openClosingBookEmployee');
  employeeIcon.hidden=!employee || !els.authScreen.hidden;
  employeeIcon.title=allowed?'Chốt sổ':'Chốt sổ · Chưa được cấp quyền';
  if (!closingBook.page.hidden && (!allowed || closingBook.storeId!==getActiveStore()?.id)) hideClosingBookPage({force:true});
  if (allowed && closingBook.page.hidden && window.location.hash.startsWith('#closing-book')) openClosingBookPage({fromHistory:true});
}
function openClosingBookPage({fromHistory=false}={}) {
  if (!closingBookAllowed()) { if (isEmployeeUser()) window.alert('Bạn chưa được cấp quyền Chốt sổ. Vui lòng liên hệ admin.'); return; }
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
  const context=window.history.state?.closingBookDetail;
  if (fromHistory && context && window.location.hash===`#closing-book-detail-${context.type}`) {
    if (ClosingBookCore.groups.includes(context.type) && Array.from(closingBook.month.options).some(option=>option.value===context.month)) {
      closingBook.month.value=context.month; loadClosingBookMonth();
      if (Array.from(closingBook.day.options).some(option=>option.value===context.date)) {
        closingBook.day.value=context.date; loadClosingBookDay();
        closingBook.shiftIndex=Number.isInteger(context.shift)?Math.max(0,Math.min(context.shift,closingBook.shifts.length-1)):0;
        renderClosingBookShiftOptions(); renderClosingBookShift();
        openClosingBookDetails(context.type,{fromHistory:true});
      }
    }
  }
  updateTimeFiltersVisibility();
  closingBook.page.scrollTop=0;
  document.querySelector('#closeClosingBook').focus({preventScroll:true});
  void refreshEmployeeCashSuggestions(true);
}
function hideClosingBookPage({force=false}={}) {
  if (closingBook.page.hidden) return true;
  if (!force && !closingBookDiscard()) return false;
  closeClosingPosModal({force:true,restoreFocus:false});
  closingBook.page.hidden=true;
  closeClosingBookDetails();
  closingBook.dirty=false;
  closingBook.draft=null;
  closingBook.shifts=[];
  document.body.classList.remove('closing-book-open');
  els.appShell.inert=false;
  els.appShell.removeAttribute('aria-hidden');
  els.tabBar.inert=false;
  if (window.location.hash.startsWith('#closing-book')) window.history.replaceState(window.history.state,'',`${window.location.pathname}${window.location.search}`);
  updateTimeFiltersVisibility();
  return true;
}
window.refreshClosingBookAccess=refreshClosingBookAccess;
window.hideClosingBookPage=hideClosingBookPage;
window.reloadClosingBookFromCloud=()=> {
  if (closingBook.page.hidden) return;
  const {monthKey,dayKey,shiftIndex}=closingBook;
  closeClosingBookDetails();
  renderClosingBookMonths(monthKey);
  if (Array.from(closingBook.day.options).some(option=>option.value===dayKey)) { closingBook.day.value=dayKey;loadClosingBookDay(); }
  closingBook.shiftIndex=Math.min(shiftIndex,closingBook.shifts.length-1);
  if (closingBook.shifts.length) { renderClosingBookShiftOptions();renderClosingBookShift(); }
  closingBook.dirty=false;
  closingBookNotice('Không lưu được thay đổi. Đã tải lại dữ liệu cloud; vui lòng thử lại.',true);
};
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
  if (window.location.hash==='#closing-book' && closingBookAllowed()) { closeClosingBookDetails(); openClosingBookPage({fromHistory:true}); }
  else if (window.location.hash.startsWith('#closing-book-detail-') && closingBookAllowed()) {
    if (closingBook.page.hidden) openClosingBookPage({fromHistory:true});
    else openClosingBookDetails(window.location.hash.endsWith('income')?'income':'expense',{fromHistory:true});
  }
  else if (!hideClosingBookPage()) window.history.pushState({closingBookPage:true},'','#closing-book');
});
window.addEventListener('beforeunload',event=> {
  if (closingBook.dirty) { event.preventDefault(); event.returnValue=''; }
});
function closingBookSnapshotMatches(shifts, snapshot) {
  // Firestore map fields may be returned in a different order than a local pending write.
  // Compare the whole payload, preserving array order and every value, not JSON key order.
  const canonical=value=>Array.isArray(value)?value.map(canonical):value && typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  try { return JSON.stringify(canonical(shifts))===JSON.stringify(canonical(JSON.parse(snapshot))); }
  catch { return false; }
}
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
  closingBook.daySnapshot=JSON.stringify(saved?.shifts||[]);
  closingBook.shifts=JSON.parse(JSON.stringify(saved?.shifts?.length?saved.shifts:[ClosingBookCore.emptyShift()])).map(ClosingBookCore.normalizeShift);
  closingBook.shifts.forEach(shift=>stampClosingBookRows(shift,saved?.updatedAt));
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
function formatClosingBookMoney(value) {
  const raw=String(value??'');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(raw)) return raw;
  const digits=raw.replace(/\./g,'').replace(/^0+(?=\d)/,'');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function formatClosingBookMoneyInput(target,event={}) {
  const raw=target.value, start=target.selectionStart??raw.length, end=target.selectionEnd??start;
  const editingGrouped=target.dataset.bookGrouped==='true' && (event.inputType?.startsWith('delete') || (event.inputType==='insertText' && /^\d+$/.test(event.data||'')));
  const source=editingGrouped && /^[\d.]*$/.test(raw)?raw.replace(/\./g,''):raw;
  const display=formatClosingBookMoney(source);
  const valid=/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(display);
  target.dataset.bookGrouped=String(valid && display.includes('.'));
  if (display!==raw) {
    const leadingZeros=source.replace(/\./g,'').match(/^0+(?=\d)/)?.[0].length||0;
    const caret=position=> {
      const count=Math.max(0,(raw.slice(0,position).match(/\d/g)||[]).length-leadingZeros);
      if (!count) return 0;
      let seen=0;
      for(let i=0;i<display.length;i++) if (/\d/.test(display[i]) && ++seen===count) return i+1;
      return display.length;
    };
    target.value=display;
    target.setSelectionRange(caret(start),caret(end));
  }
  return valid?display.replace(/\./g,''):display;
}
function closingBookMoneyField(key,value) { const display=formatClosingBookMoney(value);return `<label>${closingBookLabels[key]}<input name="${key}" data-book-money data-book-grouped="${display.includes('.')}" type="text" inputmode="numeric" autocomplete="off" value="${escapeHtml(display)}" placeholder="0" /></label>`; }
function renderClosingBookShift() {
  closingBook.draft=closingBook.shifts[closingBook.shiftIndex];
  const shift=closingBook.draft;
  document.querySelector('#closingBookFields').innerHTML=`<label>Tên / Người chốt ca<input name="name" type="text" maxlength="2000" value="${escapeHtml(shift.name||'')}" /></label>`+['opening','pos','vcb','momo','zalop','cash','ending'].map(key=>closingBookMoneyField(key,shift[key])).join('');
  document.querySelector('#closingBookPayments').innerHTML=['POS','VCB','Momo','Zalop'].map((label,index)=>`<article><h3>${label}</h3><p>Trong sổ <strong data-book-payment="${index}"></strong></p>${index===0?'<p>Thực tế <strong id="closingBookActualPos"></strong></p>':closingBookMoneyField(['','actualVcb','actualMomo','actualZalop'][index],shift[['','actualVcb','actualMomo','actualZalop'][index]])}<p>Chênh lệch <strong data-payment-difference="${index}"></strong></p></article>`).join('');
  if (isAdminUser()) document.querySelector('#closingBookPayments article').insertAdjacentHTML('beforeend',`<button id="closingBookTransferPos" class="book-pos-transfer" type="button" ${shift.posTransfer?'disabled':''}>${shift.posTransfer?'✓ Đã chuyển POS':'Chuyển →'}</button>`);
  closingBook.form.elements.result.value=shift.result||'';
  closingBook.form.elements.recheck.value=shift.recheck||'';
  renderClosingBookEntries();
  updateClosingBookCalculations();
}
function renderClosingBookEntryRow(row,index,key,categories,label) {
  const listId=`book-note-options-${key}-${index}`;
  return `<div class="closing-book-row"><div class="book-note-field"><label>Nội dung<input data-book-note="${key}" data-row="${index}" type="text" maxlength="1000" autocomplete="off" aria-controls="${listId}" aria-expanded="false" value="${escapeHtml(row.note||'')}" /></label><div class="book-note-suggestions" id="${listId}" aria-label="Gợi ý khoản ${label.toLowerCase()}" hidden></div></div><label>Số tiền<input data-book-amount="${key}" data-row="${index}" type="text" inputmode="numeric" value="${escapeHtml(String(row.amount??''))}" placeholder="0" /></label><button type="button" data-book-remove="${key}" data-row="${index}" aria-label="Xóa dòng ${index+1}">×</button><label class="book-category-field">Mục ${label.toLowerCase()}<select data-book-category="${key}" data-row="${index}"><option value="">Chọn Mục ${label.toLowerCase()}</option>${categories.map(category=>`<option value="${escapeHtml(category.id)}" ${category.id===row.categoryId?'selected':''}>${escapeHtml(category.name)}</option>`).join('')}</select></label></div>`;
}
function renderClosingBookEntries() {
  const store=getActiveStore();
  document.querySelector('#closingBookEntries').innerHTML=ClosingBookCore.groups.map((key,index)=> {
    const rows=closingBook.draft[key];
    const label=index===0?'Thu':'Chi';
    const categories=store.categories?.[key]||[];
    return `<section class="closing-book-section ${index===0?'book-income':'book-expense'}" data-book-group="${key}"><div class="closing-book-group-heading"><h2>Khoản ${label}</h2><button type="button" data-book-add="${key}" aria-label="Thêm khoản ${label.toLowerCase()}" ${rows.length>=ClosingBookCore.maxRows?'disabled':''}>＋</button></div><datalist id="closingBookSuggestions-${key}"></datalist><div class="closing-book-rows">${rows.map((row,i)=>renderClosingBookEntryRow(row,i,key,categories,label)).join('')}</div><p class="closing-book-group-total">Tổng ${label.toLowerCase()} <strong data-book-total="${key}"></strong></p></section>`;
  }).join('');
  document.querySelectorAll('#closingBookEntries [data-book-amount]').forEach(input=> {
    input.value=formatClosingBookMoney(input.value);
    input.dataset.bookMoney='';input.dataset.bookGrouped=String(input.value.includes('.'));
  });
  document.querySelectorAll('#closingBookEntries [data-book-group]').forEach(section=> {
    const key=section.dataset.bookGroup;
    const label=key==='income'?'Thu':'Chi';
    renderEntrySuggestionList(document.getElementById(`closingBookSuggestions-${key}`),getEntrySuggestions(store,key));
    section.insertAdjacentHTML('beforeend',`<button type="button" class="book-detail-link" data-book-details="${key}">Chi tiết ${label} <span aria-hidden="true">→</span></button>`);
    closingBook.draft[key].forEach((row,index)=> {
      if (!row.transferredEntryId) return;
      section.querySelector(`[data-book-note][data-row="${index}"]`).readOnly=true;
      section.querySelector(`[data-book-amount][data-row="${index}"]`).readOnly=true;
      section.querySelector(`[data-book-category][data-row="${index}"]`).disabled=true;
      section.querySelector(`[data-book-remove][data-row="${index}"]`).disabled=true;
      section.querySelector(`[data-book-remove][data-row="${index}"]`).parentElement.insertAdjacentHTML('beforeend','<small class="book-row-transfer-note">✓ Đã chuyển · Sửa khoản trong tab Thu/Chi</small>');
    });
  });
}
function applyClosingBookEntrySuggestion(target) {
  const key=target.dataset.bookNote;
  const row=closingBook.draft?.[key]?.[Number(target.dataset.row)];
  if (!row || row.transferredEntryId || target.readOnly) return;
  const suggestion=matchEntrySuggestion(getActiveStore(),key,target);
  if (!suggestion) return;
  row.amount=String(suggestion.amount);
  row.categoryId=suggestion.categoryId||'';
  const container=target.closest('.closing-book-row');
  const amount=container.querySelector('[data-book-amount]');
  amount.value=formatClosingBookMoney(row.amount);
  amount.dataset.bookGrouped=String(amount.value.includes('.'));
  container.querySelector('[data-book-category]').value=row.categoryId;
}
function closingBookSuggestionSearch(value) {
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
}
function hideClosingBookNoteSuggestions(target) {
  target.closest('.book-note-field')?.querySelector('.book-note-suggestions')?.setAttribute('hidden','');
  target.setAttribute('aria-expanded','false');
}
function showClosingBookNoteSuggestions(target) {
  if (target.readOnly || !closingBook.draft || document.activeElement!==target) return;
  const container=target.closest('.book-note-field').querySelector('.book-note-suggestions');
  const type=target.dataset.bookNote, store=getActiveStore(), query=closingBookSuggestionSearch(target.value);
  const matches=getEntrySuggestions(store,type).filter(item=>closingBookSuggestionSearch(item.note).includes(query)).slice(0,8);
  container.innerHTML=matches.map(item=> {
    const category=store.categories[type].find(category=>category.id===item.categoryId);
    return `<button type="button" data-book-suggestion="${escapeHtml(item.note)}"><strong>${escapeHtml(item.note)}</strong><span>${escapeHtml(formatCurrency(item.amount))} · ${escapeHtml(category?.name||'Chưa chọn Mục')}</span></button>`;
  }).join('');
  container.hidden=!matches.length;
  target.setAttribute('aria-expanded',String(matches.length>0));
  if (matches.length) target.closest('.book-note-field').scrollIntoView({block:'nearest'});
}
window.refreshClosingBookSuggestionOptions=()=> {
  if (closingBook.page.hidden || closingBook.storeId!==getActiveStore()?.id) return;
  closingBook.form.querySelectorAll('[data-book-category]').forEach(select=> {
    const value=select.value, previous=select.selectedOptions[0]?.outerHTML||'', type=select.dataset.bookCategory;
    const categories=getActiveStore().categories[type]||[];
    select.innerHTML=`<option value="">Chọn Mục ${type==='income'?'thu':'chi'}</option>`+categories.map(category=>`<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
    if (value && !categories.some(category=>category.id===value)) select.insertAdjacentHTML('beforeend',previous);
    select.value=value;
  });
  const input=document.activeElement;
  if (input?.matches('[data-book-note]')) showClosingBookNoteSuggestions(input);
};
closingBook.form.addEventListener('focusin',event=> {
  if (event.target.matches('[data-book-note]')) {
    showClosingBookNoteSuggestions(event.target);
    void refreshEmployeeCashSuggestions();
  }
});
window.addEventListener('focus',()=> {
  if (!closingBook.page.hidden) void refreshEmployeeCashSuggestions(true);
});
closingBook.form.addEventListener('focusout',event=> {
  if (!event.target.matches('[data-book-note]')) return;
  const list=event.target.closest('.book-note-field').querySelector('.book-note-suggestions');
  if (!list.contains(event.relatedTarget)) hideClosingBookNoteSuggestions(event.target);
});
closingBook.form.addEventListener('pointerdown',event=> {
  if (event.target.closest('[data-book-suggestion]')) event.preventDefault();
});
closingBook.form.addEventListener('keydown',event=> {
  const field=event.target.closest('.book-note-field');
  if (!field) return;
  const input=field.querySelector('[data-book-note]'), list=field.querySelector('.book-note-suggestions');
  if (event.key==='Escape') {event.preventDefault();input.focus();hideClosingBookNoteSuggestions(input);return;}
  if (list.hidden || !['ArrowDown','ArrowUp'].includes(event.key)) return;
  const buttons=[...list.querySelectorAll('button')];
  if (!buttons.length) return;
  event.preventDefault();
  const index=buttons.indexOf(document.activeElement), step=event.key==='ArrowDown'?1:-1;
  buttons[index<0?(step===1?0:buttons.length-1):(index+step+buttons.length)%buttons.length].focus();
});
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
closingBook.form.addEventListener('beforeinput',event=> {
  const target=event.target;
  if (!target.matches('[data-book-money]') || target.readOnly || target.selectionStart!==target.selectionEnd || event.isComposing) return;
  const position=target.selectionStart;
  if (event.inputType==='deleteContentBackward' && target.value[position-1]==='.') target.setSelectionRange(position-1,position-1);
  if (event.inputType==='deleteContentForward' && target.value[position]==='.') target.setSelectionRange(position+1,position+1);
});
closingBook.form.addEventListener('compositionend',event=> {
  if (event.target.matches('[data-book-money]')) event.target.dispatchEvent(new Event('input',{bubbles:true}));
});
closingBook.form.addEventListener('input',event=> {
  if (!closingBook.draft || closingBook.saving) return;
  const target=event.target;
  if (event.isComposing && target.matches('[data-book-money]')) return;
  const value=target.matches('[data-book-money]')?formatClosingBookMoneyInput(target,event):target.value;
  if (target.dataset.bookNote) {
    const row=closingBook.draft[target.dataset.bookNote][Number(target.dataset.row)];
    if (row.transferredEntryId) return;
    row.note=target.value;
    if (!event.isComposing) applyClosingBookEntrySuggestion(target);
    if (!event.isComposing) showClosingBookNoteSuggestions(target);
  }
  else if (target.dataset.bookAmount) closingBook.draft[target.dataset.bookAmount][Number(target.dataset.row)].amount=value;
  else if (target.name) closingBook.draft[target.name]=value;
  stampClosingBookRows(closingBook.draft);
  closingBook.dirty=true;
  updateClosingBookCalculations();
});
closingBook.form.addEventListener('change',event=> {
  if (!closingBook.draft || closingBook.saving) return;
  const target=event.target;
  if (target.dataset.bookCategory) {
    const row=closingBook.draft[target.dataset.bookCategory][Number(target.dataset.row)];
    if (!row || row.transferredEntryId) return;
    row.categoryId=target.value;
  } else if (target.dataset.bookNote) {
    const row=closingBook.draft[target.dataset.bookNote][Number(target.dataset.row)];
    if (!row || row.transferredEntryId) return;
    row.note=target.value;applyClosingBookEntrySuggestion(target);
  } else return;
  stampClosingBookRows(closingBook.draft);
  closingBook.dirty=true;updateClosingBookCalculations();
});
closingBook.form.addEventListener('click',event=> {
  const suggestion=event.target.closest('[data-book-suggestion]');
  if (suggestion) {
    const input=suggestion.closest('.book-note-field').querySelector('[data-book-note]');
    input.value=suggestion.dataset.bookSuggestion;
    delete input.dataset.entrySuggestionKey;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();hideClosingBookNoteSuggestions(input);return;
  }
  const detail=event.target.closest('[data-book-details]');
  if (detail) { openClosingBookDetails(detail.dataset.bookDetails); return; }
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
async function syncClosingBookDeletion(write) {
  const storeId=closingBook.storeId;
  const retry=document.querySelector('#closingBookRetryDelete');
  let timer;
  try {
    document.querySelector('#closingBookMain').inert=true;
    closingBookNotice('Đã xóa trên thiết bị. Đang xác nhận xóa trên Firebase...');
    const result=await Promise.race([write,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),15000);})]);
    if (closingBook.page.hidden || closingBook.storeId!==storeId) return;
    retry.hidden=result===true || isEmployeeUser();
    closingBookNotice(result===true?'Đã xóa ca và các khoản Thu/Chi liên kết trên thiết bị và Firebase.':isEmployeeUser()?'Chưa xóa được ca trên Firebase. Hãy tải lại ngày chốt sổ và thử lại.':'Chưa xác nhận được việc xóa trên Firebase. Vui lòng kiểm tra kết nối và bấm Thử đồng bộ lại.',result!==true);
  } finally {
    clearTimeout(timer);
    document.querySelector('#closingBookMain').inert=false;
  }
}
document.querySelector('#closingBookRetryDelete').addEventListener('click',()=> {
  if (!closingBookAllowed() || getActiveStore().id!==closingBook.storeId) return;
  syncClosingBookDeletion(saveStateToCloud());
});
document.querySelector('#closingBookDeleteShift').addEventListener('click',async()=> {
  try {
    const store=getActiveStore();
    if (!closingBookAllowed() || store.id!==closingBook.storeId || closingBook.saving) return;
    if (!cloudStore.enabled || !cloudStore.docRef || navigator.onLine===false) throw new Error('Cần kết nối Firebase để xóa ca. Vui lòng kiểm tra mạng và thử lại.');
    const currentDay=closingBookMonthData()?.days?.find(day=>day.date===closingBook.dayKey);
    if (!closingBookSnapshotMatches(currentDay?.shifts||[],closingBook.daySnapshot)) throw new Error('Dữ liệu ca đã thay đổi trên cloud. Hãy mở lại ngày chốt sổ để kiểm tra trước khi xóa.');
    const index=closingBook.shiftIndex;
    const plan=ClosingBookCore.deleteShift(store.closingMonths||[],closingBook.dayKey,index,store.entries||[],closingBook.draft);
    const income=plan.removedEntries.filter(entry=>entry.type==='income').length;
    const expense=plan.removedEntries.filter(entry=>entry.type==='expense').length;
    if (!window.confirm(`Xóa toàn bộ Ca ${index+1}${closingBook.draft.name?' · '+closingBook.draft.name:''} ngày ${formatDate(closingBook.dayKey)}?\n\nXóa cả ${income} khoản Thu và ${expense} khoản Chi đã chuyển từ ca này trên thiết bị và Firebase. Các thay đổi chưa lưu của ca này cũng sẽ bị xóa. Không thể hoàn tác.`)) return;
    closingBook.saving=true;
    const write=commitClosingBookMonths(plan.months,`Xóa Ca ${index+1} ngày ${formatDate(closingBook.dayKey)} và ${plan.removedEntries.length} khoản Thu/Chi liên kết`,{entries:plan.entries},{action:'delete'});
    closingBook.shifts.splice(index,1);
    if (!closingBook.shifts.length) { closingBook.shifts=[ClosingBookCore.emptyShift()]; closingBook.dirty=false; }
    closingBook.shiftIndex=Math.min(index,closingBook.shifts.length-1);
    closingBook.selectedRows.clear();
    renderClosingBookShiftOptions(); renderClosingBookShift();
    const saved=closingBookMonthData().days?.find(day=>day.date===closingBook.dayKey);
    closingBook.daySnapshot=JSON.stringify(saved?.shifts||[]);
    document.querySelector('#closingBookSaved').textContent=saved?`Đã lưu ${formatActivityDateTime(saved.updatedAt)}`:'Ngày chưa lưu';
    closingBook.day.selectedOptions[0].textContent=`Ngày ${Number(closingBook.dayKey.slice(-2))}${saved?' · Đã lưu':''}`;
    await syncClosingBookDeletion(write);
  } catch(error) { closingBookNotice(error.message,true); }
  finally { closingBook.saving=false; }
});
function commitClosingBookMonths(months,activity,changes={},details={}) {
  const store=getActiveStore();
  if (!closingBookAllowed() || store.id!==closingBook.storeId) throw new Error('Không còn quyền chốt sổ cho cửa hàng này.');
  const candidate={...state,stores:state.stores.map(item=>item.id===store.id?{...item,...changes,closingMonths:months}:item)};
  if (new TextEncoder().encode(JSON.stringify(candidate)).length>900000) throw new Error('Dữ liệu cửa hàng gần giới hạn đồng bộ. Chưa lưu thay đổi; hãy sao lưu và giảm dữ liệu trước.');
  const employeeMutation=isEmployeeUser()?{type:'closing-book-save',storeId:store.id,baseClosingMonths:JSON.parse(JSON.stringify(store.closingMonths||[])),closingMonths:months,categories:changes.categories||store.categories}:null;
  Object.assign(store,changes,{closingMonths:months});
  const {action='update',...activityDetails}=details;
  recordActivity(store,action,'Chốt sổ',activity,{tab:'overview',targetDate:closingBook.dayKey,...activityDetails});
  const write=saveAndRender(employeeMutation);
  if (employeeMutation) {
    closingBook.page.inert=true;
    return Promise.resolve(write).finally(()=> {closingBook.page.inert=false;});
  }
  return write;
}

function stampClosingBookRows(shift,savedAt) {
  ClosingBookCore.groups.forEach(type=>shift[type].forEach(row=> {
    if (!String(row.note||'').trim() && !String(row.amount??'').trim()) return;
    if (!row.id) row.id=createId();
    if (!row.createdAt) {
      row.createdAt=savedAt || new Date().toISOString();
      if (savedAt) row.timeSource='saved';
    }
  }));
}
function persistClosingBookDraft(changes={},activity='',details={}) {
  if (!closingBookAllowed() || getActiveStore().id!==closingBook.storeId) throw new Error('Không còn quyền truy cập cửa hàng này.');
  closingBook.shifts.forEach(shift=>stampClosingBookRows(shift));
  const shifts=closingBook.shifts.map(ClosingBookCore.validateShift);
  shifts.forEach(ClosingBookCore.calculate);
  if (!closingBook.dayKey.startsWith(closingBook.monthKey+'-')) throw new Error('Ngày không thuộc tháng đang chọn.');
  const months=JSON.parse(JSON.stringify(getActiveStore().closingMonths||[]));
  const month=months.find(item=>item.month===closingBook.monthKey);
  if (!month) throw new Error('Tháng không còn tồn tại.');
  const day={date:closingBook.dayKey,shifts,updatedAt:new Date().toISOString()};
  month.days=(month.days||[]).filter(item=>item.date!==day.date); month.days.push(day);
  commitClosingBookMonths(months,activity||`Lưu chốt sổ ngày ${formatDate(day.date)} (${shifts.length} ca)`,changes,details);
  closingBook.shifts=shifts;
  closingBook.daySnapshot=JSON.stringify(shifts);
  closingBook.draft=shifts[closingBook.shiftIndex];
  closingBook.dirty=false;
  document.querySelector('#closingBookSaved').textContent=`Đã lưu ${formatActivityDateTime(day.updatedAt)}`;
  const option=closingBook.day.selectedOptions[0]; if (option&&!option.textContent.includes('Đã lưu')) option.textContent+=' · Đã lưu';
  renderClosingBookShiftOptions(); renderClosingBookShift();
}
function closingBookDetailNotice(message,error=false) {
  const element=document.querySelector('#closingBookDetailMessage');
  element.textContent=message; element.classList.toggle('is-error',error);
}
function openClosingBookDetails(type,{fromHistory=false}={}) {
  try {
    if (!ClosingBookCore.groups.includes(type) || !closingBookAllowed() || !closingBook.draft || getActiveStore().id!==closingBook.storeId) return;
    // Persist the complete draft and stable row IDs before a row can create a cash entry.
    if (!fromHistory) persistClosingBookDraft();
    closingBook.mainScroll=closingBook.page.scrollTop;
    if (!fromHistory || closingBook.detailType!==type) closingBook.selectedRows.clear();
    closingBook.detailType=type;
    document.querySelector('#closingBookMain').hidden=true;
    document.querySelector('#closingBookDetailPage').hidden=false;
    closingBook.page.setAttribute('aria-labelledby','closingBookDetailTitle');
    if (!fromHistory) window.history.pushState({closingBookPage:true,closingBookDetail:{type,month:closingBook.monthKey,date:closingBook.dayKey,shift:closingBook.shiftIndex}},'',`#closing-book-detail-${type}`);
    renderClosingBookDetails(); closingBookDetailNotice('');
    closingBook.page.scrollTop=0;
    document.querySelector('#closeClosingBookDetail').focus({preventScroll:true});
  } catch(error) { closingBookNotice(error.message,true); }
}
function closeClosingBookDetails() {
  if (!closingBook.detailType) return;
  closingBook.detailType=null;
  closingBook.selectedRows.clear();
  document.querySelector('#closingBookDetailPage').hidden=true;
  document.querySelector('#closingBookMain').hidden=false;
  closingBook.page.setAttribute('aria-labelledby','closingBookTitle');
  closingBook.page.scrollTop=closingBook.mainScroll;
  renderClosingBookEntries();
}
document.querySelector('#closeClosingBookDetail').addEventListener('click',()=> {
  if (window.history.state?.closingBookDetail) window.history.back();
  else { closeClosingBookDetails(); window.history.replaceState({closingBookPage:true},'','#closing-book'); }
});
function renderClosingBookDetails() {
  const type=closingBook.detailType;
  if (!type) return;
  const store=getActiveStore(), rows=closingBook.draft[type], categories=store.categories[type];
  const label=type==='income'?'Thu':'Chi';
  document.querySelector('#closingBookDetailPage').dataset.type=type;
  document.querySelector('#closingBookDetailTitle').textContent=`Chi tiết ${label}`;
  document.querySelector('#closingBookDetailStore').textContent=store.name;
  document.querySelector('#closingBookDetailContext').textContent=`${formatDate(closingBook.dayKey)} · Ca ${closingBook.shiftIndex+1}`;
  document.querySelector('.book-detail-symbol').textContent=type==='income'?'↙':'↗';
  const transferred=row=>Boolean(row.transferredEntryId || store.entries.some(entry=>entry.closingBookRowId===row.id));
  const selectable=new Set(rows.filter(row=>!transferred(row)).map(row=>row.id));
  closingBook.selectedRows.forEach(id=>{if(!selectable.has(id)) closingBook.selectedRows.delete(id);});
  document.querySelector('#closingBookDetailSummary').innerHTML=[['Tổng '+label.toLowerCase(),formatCurrency(rows.reduce((sum,row)=>sum+ClosingBookCore.parseMoney(row.amount),0))],['Số khoản',rows.length],['Đã chuyển',rows.filter(transferred).length]].map(([title,value])=>`<div><span>${title}</span><strong>${value}</strong></div>`).join('');
  document.querySelector('#closingBookDetailList').innerHTML=rows.length?rows.map((row,index)=> {
    const done=transferred(row), category=categories.find(item=>item.id===row.categoryId);
    return `<article class="book-detail-row ${done?'is-transferred':''} ${closingBook.selectedRows.has(row.id)?'is-selected':''}" data-detail-id="${escapeHtml(row.id)}">
      <label class="book-row-select"><input type="checkbox" data-detail-select ${closingBook.selectedRows.has(row.id)?'checked':''} ${done?'disabled':''} aria-label="Chọn khoản ${escapeHtml(row.note)}" />${done?'Đã chuyển':'Chọn dòng'}</label>
      <div class="book-detail-row-top"><button type="button" class="book-detail-row-title" data-detail-edit aria-expanded="false"><span class="book-detail-number">${String(index+1).padStart(2,'0')}</span><span><strong>${escapeHtml(row.note)}</strong><small>${category?escapeHtml(category.name):'Chưa chọn Mục'} · ${done?'Đã chuyển':'Chọn để phân loại'}</small></span></button><div class="book-detail-row-action"><strong>${formatCurrency(row.amount)}</strong><button type="button" data-detail-transfer ${done?'disabled':''}>${done?'✓ Đã chuyển':'Chuyển →'}</button></div></div>
      <p class="book-detail-time">Ngày sổ: ${formatDate(closingBook.dayKey)} · ${row.timeSource==='saved'?'Giờ lưu sổ cũ (không có giờ tạo riêng)':'Tạo lúc'}: ${formatActivityDateTime(row.createdAt)}</p>
      <div class="book-detail-editor" hidden><label>Mục ${label.toLowerCase()}<select data-detail-category ${done?'disabled':''}><option value="">Chọn Mục</option>${categories.map(item=>`<option value="${escapeHtml(item.id)}" ${item.id===row.categoryId?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><div class="book-detail-new-category" ${done?'hidden':''}><label>Tạo Mục mới<input type="text" data-detail-new-name maxlength="100" placeholder="Tên Mục mới" /></label><button type="button" class="ghost-button" data-detail-create>＋ Tạo Mục</button></div></div>
    </article>`;
  }).join(''):'<div class="book-detail-empty"><span aria-hidden="true">▤</span><h2>Chưa có khoản '+label.toLowerCase()+'</h2><p>Quay lại Chốt sổ để nhập khoản trước.</p></div>';
  updateClosingBookSelection();
}
function updateClosingBookSelection() {
  const checkboxes=Array.from(document.querySelectorAll('#closingBookDetailList [data-detail-select]:not(:disabled)'));
  const count=closingBook.selectedRows.size;
  document.querySelector('#closingBookSelectionCount').textContent=`Đã chọn ${count} dòng`;
  const all=document.querySelector('#closingBookSelectAll');
  all.checked=checkboxes.length>0 && count===checkboxes.length;
  all.indeterminate=count>0 && count<checkboxes.length;
  all.disabled=!checkboxes.length;
  document.querySelector('#closingBookTransferSelected').disabled=count===0 || closingBook.saving;
}
document.querySelector('#closingBookSelectAll').addEventListener('change',event=> {
  document.querySelectorAll('#closingBookDetailList [data-detail-select]:not(:disabled)').forEach(checkbox=> {
    const card=checkbox.closest('[data-detail-id]'), id=card.dataset.detailId;
    if(event.target.checked) closingBook.selectedRows.add(id); else closingBook.selectedRows.delete(id);
    checkbox.checked=event.target.checked; card.classList.toggle('is-selected',checkbox.checked);
  });
  updateClosingBookSelection();
});
document.querySelector('#closingBookTransferSelected').addEventListener('click',()=> {
  if (closingBook.saving || !closingBook.selectedRows.size) return;
  const previous=[];
  try {
    if (!closingBookAllowed() || getActiveStore().id!==closingBook.storeId || !closingBook.detailType) throw new Error('Không còn quyền truy cập cửa hàng này.');
    closingBook.saving=true; updateClosingBookSelection();
    const store=getActiveStore(), type=closingBook.detailType, rows=closingBook.draft[type];
    const plan=ClosingBookCore.transferBatch(rows,closingBook.selectedRows,{type,date:closingBook.dayKey,categories:store.categories[type],entries:store.entries,createEntryId:createId});
    if (plan.entries.length) {
      plan.entries.forEach(entry=> {
        const row=rows.find(item=>item.id===entry.closingBookRowId);
        previous.push({row,value:row.transferredEntryId}); row.transferredEntryId=entry.id;
      });
      persistClosingBookDraft({entries:[...store.entries,...plan.entries]},`Chuyển ${plan.entries.length} khoản ${type==='income'?'Thu':'Chi'} từ Chốt sổ.`,{tab:type});
    }
    renderClosingBookDetails();
    const messages=plan.skipped.map(item=>`“${item.note}”: ${item.message}`).join(' ');
    closingBookDetailNotice(`Đã chuyển ${plan.entries.length} khoản sang tab ${type==='income'?'Thu':'Chi'}.${plan.skipped.length?` Giữ lại ${plan.skipped.length} dòng: ${messages}`:''}`,plan.skipped.length>0);
  } catch(error) {
    previous.forEach(({row,value})=>row.transferredEntryId=value);
    closingBookDetailNotice(error.message,true);
  } finally { closingBook.saving=false; updateClosingBookSelection(); }
});
function closingBookDetailRow(target) {
  if (!closingBookAllowed() || getActiveStore().id!==closingBook.storeId || !closingBook.detailType) throw new Error('Không còn quyền truy cập cửa hàng này.');
  const card=target.closest('[data-detail-id]');
  const row=closingBook.draft[closingBook.detailType].find(item=>item.id===card?.dataset.detailId);
  if (!row) throw new Error('Khoản không còn tồn tại.');
  return {card,row,type:closingBook.detailType};
}
function openClosingBookDetailEditor(card) {
  closingBookDetailRow(card);
  const editor=card.querySelector('.book-detail-editor');
  editor.hidden=false;
  card.querySelector('[data-detail-edit]').setAttribute('aria-expanded','true');
  const select=card.querySelector('[data-detail-category]');
  if (!select.disabled) select.focus();
}
document.querySelector('#closingBookDetailList').addEventListener('change',event=> {
  if (event.target.matches('[data-detail-select]')) {
    try {
      const {card,row}=closingBookDetailRow(event.target);
      if(event.target.disabled || row.transferredEntryId) return;
      if(event.target.checked) closingBook.selectedRows.add(row.id); else closingBook.selectedRows.delete(row.id);
      card.classList.toggle('is-selected',event.target.checked); updateClosingBookSelection();
    } catch(error) { closingBookDetailNotice(error.message,true); }
    return;
  }
  if (!event.target.matches('[data-detail-category]')) return;
  let row,previous;
  try {
    ({row}=closingBookDetailRow(event.target)); previous=row.categoryId;
    if (row.transferredEntryId) throw new Error('Khoản đã chuyển không thể đổi Mục tại Chốt sổ.');
    row.categoryId=event.target.value;
    persistClosingBookDraft(); renderClosingBookDetails(); closingBookDetailNotice('Đã lưu Mục cho khoản.');
  } catch(error) { if(row) row.categoryId=previous; closingBookDetailNotice(error.message,true); }
});
document.querySelector('#closingBookDetailList').addEventListener('click',event=> {
  const target=event.target.closest('[data-detail-edit],[data-detail-create],[data-detail-transfer]');
  if (target?.disabled) return;
  let row,previous;
  try {
    if (!target) {
      const card=event.target.closest('[data-detail-id]');
      // Form controls and action buttons keep their own behavior; the rest of the row opens classification.
      if (card && !event.target.closest('input,select,textarea,button,a,label,.book-detail-editor')) openClosingBookDetailEditor(card);
      return;
    }
    const context=closingBookDetailRow(target); row=context.row;
    const {card,type}=context, store=getActiveStore();
    if (target.matches('[data-detail-edit]')) {
      openClosingBookDetailEditor(card);
      return;
    }
    if (row.transferredEntryId) throw new Error('Khoản này đã được chuyển.');
    previous={categoryId:row.categoryId,transferredEntryId:row.transferredEntryId};
    if (target.matches('[data-detail-create]')) {
      const name=card.querySelector('[data-detail-new-name]').value.trim();
      if (!name || name.length>100) throw new Error('Nhập tên Mục mới (tối đa 100 ký tự).');
      const existing=store.categories[type].find(item=>item.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi'));
      const category=existing||{id:createId(),name}; row.categoryId=category.id;
      const categories={...store.categories,[type]:existing?store.categories[type]:[...store.categories[type],category]};
      persistClosingBookDraft({categories},`Gán mục "${name}" cho khoản Chốt sổ "${row.note}".`);
      renderClosingBookDetails(); closingBookDetailNotice(existing?'Đã chọn Mục có sẵn.':'Đã tạo và chọn Mục mới.');
    } else {
      const entry=ClosingBookCore.transferEntry(row,{type,date:closingBook.dayKey,categories:store.categories[type],entries:store.entries,entryId:createId()});
      row.transferredEntryId=entry.id;
      persistClosingBookDraft({entries:[...store.entries,entry]},`Chuyển khoản ${type==='income'?'Thu':'Chi'} "${row.note}" từ Chốt sổ.`,{tab:type,targetType:'entry',targetId:entry.id});
      renderClosingBookDetails(); closingBookDetailNotice('Đã chuyển sang tab '+(type==='income'?'Thu':'Chi')+'.');
    }
  } catch(error) {
    if(row&&previous) { row.categoryId=previous.categoryId; row.transferredEntryId=previous.transferredEntryId; }
    closingBookDetailNotice(error.message,true);
  }
});
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
    closingBook.saving=true;
    persistClosingBookDraft();
    closingBookNotice('Đã lưu trên thiết bị. '+(els.syncStatus?.textContent||''));
  } catch(error) { closingBookNotice(error.message,true); }
  finally { closingBook.saving=false; }
});
closingBook.page.addEventListener('focusin',event=> {
  if (event.target.matches('input,select,textarea')) [100,350].forEach(delay=>setTimeout(()=> {
    if (!event.target.isConnected || document.activeElement!==event.target) return;
    const target=closingBookFocusTarget(event.target);
    target.scrollIntoView({block:'nearest',behavior:'smooth'});
  },delay));
});
function closingBookFocusTarget(target) {
  if (target.matches('[data-detail-new-name]')) return target.closest('.book-detail-new-category');
  if (target.matches('[data-book-note]')) {
    const field=target.closest('.book-note-field');
    if (field && !field.querySelector('.book-note-suggestions').hidden) return field;
  }
  return target;
}
function updateClosingBookViewport() {
  const viewport=window.visualViewport;
  closingBook.page.style.setProperty('--book-height',`${viewport?.height||window.innerHeight}px`);
  closingBook.page.style.setProperty('--book-top',`${viewport?.offsetTop||0}px`);
  closingPos.modal.style.setProperty('--pos-height',`${viewport?.height||window.innerHeight}px`);
  closingPos.modal.style.setProperty('--pos-top',`${viewport?.offsetTop||0}px`);
  if (!closingPos.modal.hidden && closingPos.modal.contains(document.activeElement)) document.activeElement.scrollIntoView({block:'nearest'});
  if (!closingBook.page.hidden && closingBook.page.contains(document.activeElement)) {
    const target=closingBookFocusTarget(document.activeElement);
    target.scrollIntoView({block:'nearest'});
  }
}
function openClosingPosModal() {
  try {
    if (!isAdminUser() || !closingBookAllowed() || closingBook.page.hidden || closingBook.saving || closingPos.busy || closingBook.storeId!==getActiveStore()?.id) return;
    if (closingBook.draft.posTransfer) throw new Error('POS của ca này đã chuyển. Hãy chỉnh sửa khoản trong tab Thu.');
    const actualPos=ClosingBookCore.calculate(closingBook.draft).actualPos;
    closingPos.session={storeId:closingBook.storeId,date:closingBook.dayKey,month:closingBook.monthKey,shiftIndex:closingBook.shiftIndex,daySnapshot:closingBook.daySnapshot,shifts:JSON.parse(JSON.stringify(closingBook.shifts)),entryId:createId(),rowId:createId(),actorUid:authState.user?.uid};
    document.querySelector('#closingPosContext').textContent=`${getActiveStore().name} · ${formatDate(closingBook.dayKey)} · Ca ${closingBook.shiftIndex+1}`;
    document.querySelector('#closingPosAmount').value=formatClosingBookMoney(actualPos);
    document.querySelector('#closingPosNote').value='';
    const categories=getActiveStore().categories.income||[];
    document.querySelector('#closingPosCategory').innerHTML='<option value="">Chọn Mục thu</option>'+categories.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    document.querySelector('#closingPosMessage').textContent=categories.length?'':'Chưa có Mục thu. Hãy tạo Mục trong tab Thu trước khi chuyển.';
    document.querySelector('#closingPosMessage').classList.remove('is-error');
    closingPos.modal.hidden=false;closingBook.page.inert=true;updateClosingBookViewport();
    document.querySelector('#closingPosNote').focus({preventScroll:true});
  } catch(error) { closingBookNotice(error.message,true); }
}
function closeClosingPosModal({force=false,restoreFocus=true}={}) {
  if (closingPos.busy && !force) return;
  closingPos.modal.hidden=true;closingPos.session=null;closingBook.page.inert=false;
  if (restoreFocus && !closingBook.page.hidden) document.querySelector('#closingBookTransferPos')?.focus({preventScroll:true});
}
document.querySelector('#closingBookPayments').addEventListener('click',event=> {
  if (event.target.closest('#closingBookTransferPos')) openClosingPosModal();
});
document.querySelector('#closingPosCancel').addEventListener('click',()=>closeClosingPosModal());
closingPos.modal.addEventListener('click',event=>{if(event.target===closingPos.modal)closeClosingPosModal();});
closingPos.modal.addEventListener('keydown',event=> {
  if(event.key==='Escape'){event.preventDefault();closeClosingPosModal();}
  if(event.key==='Tab'){
    const controls=[...closingPos.modal.querySelectorAll('input,select,button')].filter(item=>!item.disabled),first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
document.querySelector('#closingPosAmount').addEventListener('input',event=>formatClosingBookMoneyInput(event.target,event));
closingPos.form.addEventListener('focusin',()=>[100,350].forEach(delay=>setTimeout(updateClosingBookViewport,delay)));
closingPos.form.addEventListener('submit',async event=> {
  event.preventDefault();if(closingPos.busy)return;
  const session=closingPos.session,message=document.querySelector('#closingPosMessage');
  try {
    if(!session||!isAdminUser()||!closingBookAllowed()||getActiveStore()?.id!==session.storeId||authState.user?.uid!==session.actorUid)throw new Error('Không còn quyền chuyển POS cho cửa hàng này.');
    const note=document.querySelector('#closingPosNote').value.trim(),amount=ClosingBookCore.parseMoney(document.querySelector('#closingPosAmount').value),categoryId=document.querySelector('#closingPosCategory').value;
    if(!note||note.length>1000)throw new Error('Vui lòng nhập tên Khoản thu (tối đa 1.000 ký tự).');
    if(amount<=0)throw new Error('Số tiền phải lớn hơn 0.');
    if(!getActiveStore().categories.income.some(item=>item.id===categoryId))throw new Error('Vui lòng chọn Mục thu.');
    if(navigator.onLine===false||!cloudStore.enabled||!cloudStore.db?.runTransaction)throw new Error('Cần kết nối Firebase để chuyển POS. Dữ liệu chưa được chuyển.');
    const shifts=session.shifts.map(shift=>{stampClosingBookRows(shift);return ClosingBookCore.validateShift(shift);});
    const source={id:session.rowId,note,amount,categoryId,createdAt:new Date().toISOString()};
    closingPos.busy=true;closingBook.saving=true;
    message.classList.remove('is-error');
    closingPos.form.querySelectorAll('input,select,button').forEach(item=>item.disabled=true);message.textContent='Đang chuyển và xác nhận trên Firebase...';
    if(pendingAdminCloudWrites.size){let timer;try{await Promise.race([Promise.all([...pendingAdminCloudWrites]),new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('Chưa hoàn tất đồng bộ trước đó. Hãy kiểm tra kết nối rồi thử lại.')),15000))]);}finally{clearTimeout(timer);}}
    const committed=await cloudStore.db.runTransaction(async transaction=> {
      const snapshot=await transaction.get(cloudStore.docRef);
      if(!snapshot.exists)throw new Error('Không tìm thấy dữ liệu Firebase.');
      const data=snapshot.data()||{},next=JSON.parse(JSON.stringify(data.state||data)),store=next.stores.find(item=>item.id===session.storeId),month=store?.closingMonths?.find(item=>item.month===session.month),day=month?.days?.find(item=>item.date===session.date);
      if(!store||!month)throw new Error('Cửa hàng hoặc tháng chốt sổ không còn tồn tại.');
      if(day?.shifts?.[session.shiftIndex]?.posTransfer?.transferredEntryId===session.entryId)return next;
      if(!closingBookSnapshotMatches(day?.shifts||[],session.daySnapshot))throw new Error('Ca đã thay đổi trên Firebase. Hãy đóng popup và mở lại ngày Chốt sổ để kiểm tra.');
      if(day?.shifts?.[session.shiftIndex]?.posTransfer)throw new Error('POS của ca này đã được chuyển, không tạo trùng.');
      const entry=ClosingBookCore.transferEntry(source,{type:'income',date:session.date,categories:store.categories.income,entries:store.entries||[],entryId:session.entryId});
      shifts[session.shiftIndex].posTransfer={...source,transferredEntryId:entry.id};
      const savedDay={date:session.date,shifts,updatedAt:new Date().toISOString()};
      month.days=(month.days||[]).filter(item=>item.date!==session.date);month.days.push(savedDay);
      store.entries=[...(store.entries||[]),{...entry,closingBookSource:'pos',actorUid:session.actorUid,actorRole:'admin'}];
      recordActivity(store,'create','Thu',`Chuyển POS Ca ${session.shiftIndex+1} thành khoản Thu "${note}" · ${formatCurrency(amount)}.`,{tab:'income',targetType:'entry',targetId:entry.id,targetDate:session.date});
      if(new TextEncoder().encode(JSON.stringify(next)).length>900000)throw new Error('Dữ liệu gần giới hạn Firebase. Chưa chuyển khoản Thu.');
      const update={state:next,updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()};
      if(data.state)transaction.update(cloudStore.docRef,update);else transaction.set(cloudStore.docRef,update);
      return next;
    });
    if(!isAdminUser()||authState.user?.uid!==session.actorUid)return;
    const activeStoreId=state.activeStoreId;state=normalizeState(committed);state.activeStoreId=activeStoreId;saveStateToCache();render();
    if(!closingBook.page.hidden&&closingBook.storeId===session.storeId){
      const savedDay=getActiveStore().closingMonths.find(item=>item.month===session.month).days.find(item=>item.date===session.date);
      closingBook.shifts=JSON.parse(JSON.stringify(savedDay.shifts));closingBook.daySnapshot=JSON.stringify(savedDay.shifts);closingBook.dirty=false;renderClosingBookShiftOptions();renderClosingBookShift();
      document.querySelector('#closingBookSaved').textContent=`Đã lưu ${formatActivityDateTime(savedDay.updatedAt)}`;
      closingBook.day.selectedOptions[0].textContent=`Ngày ${Number(session.date.slice(-2))} · Đã lưu`;
      closingBookNotice('Đã chuyển POS thành khoản Thu và lưu trên Firebase.');
    }
    closeClosingPosModal({force:true});updateSyncStatus('Đã chuyển POS và lưu Firebase','ok');
  }catch(error){message.textContent=error.message;message.classList.add('is-error');}
  finally{closingPos.busy=false;closingBook.saving=false;closingPos.form.querySelectorAll('input,select,button').forEach(item=>item.disabled=false);}
});
window.visualViewport?.addEventListener('resize',updateClosingBookViewport);
window.visualViewport?.addEventListener('scroll',updateClosingBookViewport);
window.addEventListener('resize',updateClosingBookViewport);
updateClosingBookViewport(); refreshClosingBookAccess();
window.refreshClosingBookSync(els.syncStatus?.textContent||'',els.syncStatus?.dataset.status||'');
