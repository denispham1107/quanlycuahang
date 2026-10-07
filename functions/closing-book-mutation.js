"use strict";
const core=require('./closing-book-core');
const {isDeepStrictEqual}=require('node:util');
function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
function validateMonths(raw,baseline=[]) {
  if (!Array.isArray(raw)) fail('INVALID_CLOSING_MONTHS');
  const months=new Set(), rows=new Set();
  return raw.map(month=> {
    if (!core.validMonth(month.month) || months.has(month.month) || !Array.isArray(month.days)) fail('INVALID_CLOSING_MONTH');
    months.add(month.month);
    const dates=new Set();
    return {month:month.month,days:month.days.map(day=> {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !day.date.startsWith(month.month+'-') || Number(day.date.slice(-2))<1 || Number(day.date.slice(-2))>core.monthDays(month.month) || dates.has(day.date)) fail('INVALID_CLOSING_DAY');
      if (!Array.isArray(day.shifts) || day.shifts.length<1 || day.shifts.length>4) fail('INVALID_CLOSING_SHIFTS');
      dates.add(day.date);
      const savedDay=baseline.find(item=>item.month===month.month)?.days?.find(item=>item.date===day.date);
      if (savedDay && isDeepStrictEqual(savedDay,day)) {
        rowMap([{month:month.month,days:[day]}]).forEach((item,id)=>{if(rows.has(id))fail('INVALID_CLOSING_ROW');rows.add(id);});
        return JSON.parse(JSON.stringify(day));
      }
      const shifts=day.shifts.map(rawShift=> {
        const shift=core.validateShift(rawShift);core.calculate(shift);
        core.groups.forEach(type=>shift[type].forEach(row=> {
          if (!row.id || rows.has(row.id) || !Number.isFinite(Date.parse(row.createdAt))) fail('INVALID_CLOSING_ROW');
          rows.add(row.id);
        }));
        return shift;
      });
      return {date:day.date,shifts,updatedAt:typeof day.updatedAt==='string'?day.updatedAt:new Date().toISOString()};
    })};
  });
}
function rowMap(months) {
  const map=new Map();
  (months||[]).forEach(month=>(month.days||[]).forEach(day=>(day.shifts||[]).forEach(raw=> {
    const shift=core.normalizeShift(raw);
    core.groups.forEach(type=>(shift[type]||[]).forEach(row=>{if(row.id)map.set(row.id,{row,type,date:day.date});}));
  })));
  return map;
}
// Receives a book, never an arbitrary replacement of the store or its entry list.
function applyClosingBookMutation(store,mutation,user,createId) {
  if (user.profile?.permissions?.closingBook?.manage!==true || user.profile.active===false || user.profile.storeId!==store.id) fail('CLOSING_BOOK_FORBIDDEN',403);
  if (!isDeepStrictEqual(mutation.baseClosingMonths,store.closingMonths||[])) fail('CLOSING_BOOK_CONFLICT',409);
  const months=validateMonths(mutation.closingMonths,store.closingMonths||[]);
  const categories={income:[...(store.categories?.income||[])],expense:[...(store.categories?.expense||[])]};
  core.groups.forEach(type=> {
    const supplied=mutation.categories?.[type];
    if (!Array.isArray(supplied)) fail('INVALID_CATEGORY');
    supplied.forEach(category=> {
      const id=String(category.id||''),name=String(category.name||'').trim();
      if (!id || id.length>160 || !name || name.length>100) fail('INVALID_CATEGORY');
      const existing=categories[type].find(item=>item.id===id);
      if (existing) { if (existing.name!==name) fail('CATEGORY_EDIT_FORBIDDEN');return; }
      if (categories[type].some(item=>item.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi'))) fail('CATEGORY_CONFLICT',409);
      categories[type].push({id,name});
    });
  });
  const before=rowMap(store.closingMonths),after=rowMap(months);
  const removedRowIds=new Set([...before.keys()].filter(id=>!after.has(id)));
  const removedEntryIds=new Set([...before.values()].filter(item=>removedRowIds.has(item.row.id)).map(item=>item.row.transferredEntryId).filter(Boolean));
  let entries=(store.entries||[]).filter(entry=>!removedEntryIds.has(entry.id) && !removedRowIds.has(entry.closingBookRowId));
  const entryIds=new Set(entries.map(entry=>entry.id));
  after.forEach(({row,type,date},id)=> {
    const old=before.get(id);
    if (old?.row.transferredEntryId) {
      if (row.transferredEntryId!==old.row.transferredEntryId || row.note!==old.row.note || row.amount!==old.row.amount || row.categoryId!==old.row.categoryId || row.createdAt!==old.row.createdAt || type!==old.type || date!==old.date) fail('TRANSFERRED_ROW_EDIT_FORBIDDEN');
      return;
    }
    if (!row.transferredEntryId) return;
    if (entryIds.has(row.transferredEntryId)) fail('DUPLICATE_ENTRY');
    const source={...row};delete source.transferredEntryId;
    const entry=core.transferEntry(source,{type,date,categories:categories[type],entries,entryId:row.transferredEntryId});
    entries.push({...entry,actorUid:user.uid,actorName:user.profile.displayName||user.email||'',actorRole:'employee'});
    entryIds.add(entry.id);
  });
  const activity={id:createId(),action:removedRowIds.size?'delete':'update',area:'Chốt sổ',message:'Nhân viên cập nhật Chốt sổ, phân loại và chuyển Thu/Chi.',createdAt:new Date().toISOString(),actorUid:user.uid,actorName:user.profile.displayName||user.email||'',actorRole:'employee',tab:'overview'};
  const next={...store,closingMonths:months,categories,entries,activityHistory:[activity,...(store.activityHistory||[])]};
  if (Buffer.byteLength(JSON.stringify(next),'utf8')>900000) fail('CLOSING_BOOK_TOO_LARGE');
  Object.assign(store,next);
}
module.exports={applyClosingBookMutation,validateMonths};
