/* Daily cash reconciliation; only an explicit detail-page transfer creates entries. */
const closingBook = {
  page: document.querySelector('#closingBookPage'),
  form: document.querySelector('#closingBookForm'),
  month: document.querySelector('#closingBookMonth'),
  day: document.querySelector('#closingBookDay'),
  shift: document.querySelector('#closingBookShift'),
  message: document.querySelector('#closingBookMessage'),
  storeId: null, draft: null, dirty: false, monthKey: '', dayKey: '', shiftIndex: 0,
  shifts: [], saving: false, detailType: null, mainScroll: 0
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
  if (allowed && closingBook.page.hidden && window.location.hash.startsWith('#closing-book')) openClosingBookPage({fromHistory:true});
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
}
function hideClosingBookPage({force=false}={}) {
  if (closingBook.page.hidden) return true;
  if (!force && !closingBookDiscard()) return false;
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
  document.querySelectorAll('#closingBookEntries [data-book-group]').forEach(section=> {
    const key=section.dataset.bookGroup;
    const label=key==='income'?'Thu':'Chi';
    section.insertAdjacentHTML('beforeend',`<button type="button" class="book-detail-link" data-book-details="${key}">Chi tiết ${label} <span aria-hidden="true">→</span></button>`);
    closingBook.draft[key].forEach((row,index)=> {
      if (!row.transferredEntryId) return;
      section.querySelector(`[data-book-note][data-row="${index}"]`).readOnly=true;
      section.querySelector(`[data-book-amount][data-row="${index}"]`).readOnly=true;
      section.querySelector(`[data-book-remove][data-row="${index}"]`).disabled=true;
      section.querySelector(`[data-book-remove][data-row="${index}"]`).parentElement.insertAdjacentHTML('beforeend','<small class="book-row-transfer-note">✓ Đã chuyển · Sửa khoản trong tab Thu/Chi</small>');
    });
  });
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
  stampClosingBookRows(closingBook.draft);
  closingBook.dirty=true;
  updateClosingBookCalculations();
});
closingBook.form.addEventListener('click',event=> {
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
function commitClosingBookMonths(months,activity,changes={},details={}) {
  const store=getActiveStore();
  if (!closingBookAllowed() || store.id!==closingBook.storeId) throw new Error('Không còn quyền chốt sổ cho cửa hàng này.');
  const candidate={...state,stores:state.stores.map(item=>item.id===store.id?{...item,...changes,closingMonths:months}:item)};
  if (new TextEncoder().encode(JSON.stringify(candidate)).length>900000) throw new Error('Dữ liệu cửa hàng gần giới hạn đồng bộ. Chưa lưu thay đổi; hãy sao lưu và giảm dữ liệu trước.');
  Object.assign(store,changes,{closingMonths:months});
  recordActivity(store,'update','Chốt sổ',activity,{tab:'overview',targetDate:closingBook.dayKey,...details});
  saveAndRender();
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
  document.querySelector('#closingBookDetailSummary').innerHTML=[['Tổng '+label.toLowerCase(),formatCurrency(rows.reduce((sum,row)=>sum+ClosingBookCore.parseMoney(row.amount),0))],['Số khoản',rows.length],['Đã chuyển',rows.filter(transferred).length]].map(([title,value])=>`<div><span>${title}</span><strong>${value}</strong></div>`).join('');
  document.querySelector('#closingBookDetailList').innerHTML=rows.length?rows.map((row,index)=> {
    const done=transferred(row), category=categories.find(item=>item.id===row.categoryId);
    return `<article class="book-detail-row ${done?'is-transferred':''}" data-detail-id="${escapeHtml(row.id)}">
      <div class="book-detail-row-top"><button type="button" class="book-detail-row-title" data-detail-edit aria-expanded="false"><span class="book-detail-number">${String(index+1).padStart(2,'0')}</span><span><strong>${escapeHtml(row.note)}</strong><small>${category?escapeHtml(category.name):'Chưa chọn Mục'} · ${done?'Đã chuyển':'Chọn để phân loại'}</small></span></button><div class="book-detail-row-action"><strong>${formatCurrency(row.amount)}</strong><button type="button" data-detail-transfer ${done?'disabled':''}>${done?'✓ Đã chuyển':'Chuyển →'}</button></div></div>
      <p class="book-detail-time">Ngày sổ: ${formatDate(closingBook.dayKey)} · ${row.timeSource==='saved'?'Giờ lưu sổ cũ (không có giờ tạo riêng)':'Tạo lúc'}: ${formatActivityDateTime(row.createdAt)}</p>
      <div class="book-detail-editor" hidden><label>Mục ${label.toLowerCase()}<select data-detail-category ${done?'disabled':''}><option value="">Chọn Mục</option>${categories.map(item=>`<option value="${escapeHtml(item.id)}" ${item.id===row.categoryId?'selected':''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><div class="book-detail-new-category" ${done?'hidden':''}><label>Tạo Mục mới<input type="text" data-detail-new-name maxlength="100" placeholder="Tên Mục mới" /></label><button type="button" class="ghost-button" data-detail-create>＋ Tạo Mục</button></div></div>
    </article>`;
  }).join(''):'<div class="book-detail-empty"><span aria-hidden="true">▤</span><h2>Chưa có khoản '+label.toLowerCase()+'</h2><p>Quay lại Chốt sổ để nhập khoản trước.</p></div>';
}
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
    if (!event.target.isConnected) return;
    const target=event.target.matches('[data-detail-new-name]')?event.target.closest('.book-detail-new-category'):event.target;
    target.scrollIntoView({block:'nearest',behavior:'smooth'});
  },delay));
});
function updateClosingBookViewport() {
  const viewport=window.visualViewport;
  closingBook.page.style.setProperty('--book-height',`${viewport?.height||window.innerHeight}px`);
  closingBook.page.style.setProperty('--book-top',`${viewport?.offsetTop||0}px`);
  if (!closingBook.page.hidden && closingBook.page.contains(document.activeElement)) {
    const target=document.activeElement.matches('[data-detail-new-name]')?document.activeElement.closest('.book-detail-new-category'):document.activeElement;
    target.scrollIntoView({block:'nearest'});
  }
}
window.visualViewport?.addEventListener('resize',updateClosingBookViewport);
window.visualViewport?.addEventListener('scroll',updateClosingBookViewport);
window.addEventListener('resize',updateClosingBookViewport);
updateClosingBookViewport(); refreshClosingBookAccess();
window.refreshClosingBookSync(els.syncStatus?.textContent||'',els.syncStatus?.dataset.status||'');
