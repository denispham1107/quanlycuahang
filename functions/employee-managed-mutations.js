"use strict";
function fail(message,status=400) {throw Object.assign(new Error(message),{status});}
function text(value,max,required=false) {
  if (typeof value!=="string" || value.length>max) fail("INVALID_DATA");
  const result=value.trim();if(required&&!result)fail("INVALID_DATA");return result;
}
function key(value) {return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase().trim();}
function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T00:00:00Z");return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function authorize(store,user,area,action) {
  const profile=user?.profile;
  if(!user?.uid||profile?.role!=="employee"||profile.active===false||profile.permissions?.[area]?.[action]!==true)fail("PERMISSION_DENIED",403);
  const stores=[profile.storeId,...(Array.isArray(profile.storeIds)?profile.storeIds:[])];
  if(!stores.includes(store.id))fail("STORE_FORBIDDEN",403);
}
function applyEmployeeInventoryExport(store,mutation,user,createId,createActivity) {
  authorize(store,user,"purchase","inventoryExport");
  const requestId=text(mutation.requestId,80,true),inventoryId=text(mutation.inventoryId,100,true);
  const date=text(mutation.date,10,true),reason=text(mutation.reason??"",200);
  const quantity=Number(mutation.quantity);
  if(!validDate(date)||!Number.isSafeInteger(quantity)||quantity<1)fail("INVALID_EXPORT");
  const previous=(store.inventoryLogs||[]).find(log=>log.requestId===requestId);
  if(previous) {
    if(previous.createdByUid!==user.uid||previous.inventoryId!==inventoryId||previous.date!==date||previous.exportQuantity!==quantity||previous.exportReason!==reason)fail("EXPORT_REQUEST_CONFLICT",409);
    return previous;
  }
  const item=(store.inventory||[]).find(item=>item.id===inventoryId);
  if(!item)fail("INVENTORY_NOT_FOUND",404);
  const oldQuantity=Number(item.quantity),oldCost=Number(item.totalCost||0),price=Number(item.lastPrice||0),salePrice=Number(item.salePrice??item.lastPrice??0);
  if(!Number.isSafeInteger(oldQuantity)||oldQuantity<0||![oldCost,price,salePrice].every(value=>Number.isFinite(value)&&value>=0))fail("INVALID_STOCK");
  if(quantity>oldQuantity)fail("OUT_OF_STOCK:"+item.name,409);
  const now=new Date().toISOString(),newQuantity=oldQuantity-quantity;
  const newCost=newQuantity===0?0:Math.max(0,oldCost-(oldCost/oldQuantity)*quantity);
  const log={id:createId(),requestId,type:"export",inventoryId,date,itemName:item.name,groupName:item.groupName||"",oldQuantity,newQuantity,
    oldPrice:price,newPrice:price,oldSalePrice:salePrice,newSalePrice:salePrice,exportReason:reason,exportQuantity:quantity,updatedAt:now,
    createdByUid:user.uid,createdByName:String(user.profile.displayName||user.email||"").slice(0,120)};
  const activity=createActivity(user,"Xuất kho",`Xuất "${item.name}" - ${quantity} sản phẩm${reason?`, lý do: ${reason}`:""}.`,{createdAt:now,tab:"purchase",targetType:"inventory-log",targetId:log.id,targetDate:date});
  Object.assign(item,{quantity:newQuantity,totalCost:newCost,updatedAt:now});
  store.inventoryLogs=[log,...(store.inventoryLogs||[])];store.activityHistory=[activity,...(store.activityHistory||[])];
  return log;
}
function applyEmployeeCustomerSave(store,raw,user,createId,createActivity) {
  authorize(store,user,"sales","customerManage");
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||raw.delete===true)fail("INVALID_CUSTOMER");
  const customerId=text(raw.customerId??"",100),name=text(raw.name,160,true),phone=text(raw.phone,40,true);
  const memberTier=text(raw.memberTier??"Thường",120)||"Thường",createdAt=text(raw.createdAt,40,true);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(createdAt)||!validDate(createdAt.slice(0,10))||!Number.isFinite(Date.parse(createdAt)))fail("INVALID_CUSTOMER_DATE");
  const customers=store.customers||[],existing=customerId?customers.find(customer=>customer.id===customerId):null;
  if(customerId&&!existing)fail("CUSTOMER_NOT_FOUND",404);
  const newId=existing?existing.id:text(raw.newId,80,true);
  const retry=!existing&&customers.find(customer=>customer.id===newId);
  const duplicate=customers.find(customer=>customer.id!==newId&&key(customer.name)===key(name)&&key(customer.phone)===key(phone));
  if(retry) {
    if(retry.createdByUid===user.uid&&retry.name===name&&retry.phone===phone&&retry.memberTier===memberTier&&retry.createdAt===createdAt)return retry;
    fail("CUSTOMER_ALREADY_EXISTS",409);
  }
  if(duplicate) {
    fail("CUSTOMER_ALREADY_EXISTS",409);
  }
  if(existing&&String(raw.baseUpdatedAt||"")!==String(existing.updatedAt||""))fail("CUSTOMER_CONFLICT",409);
  const now=new Date().toISOString(),premium=key(memberTier)!=="thuong";
  const customer={...(existing||{}),id:newId,name,phone,memberTier,createdAt,updatedAt:now,source:existing?.source||"manual",
    memberTierStartedAt:premium?(existing&&key(existing.memberTier)===key(memberTier)&&existing.memberTierStartedAt?existing.memberTierStartedAt:now):""};
  if(!existing)Object.assign(customer,{createdByUid:user.uid,createdByName:String(user.profile.displayName||user.email||"").slice(0,120)});
  const activity=createActivity(user,"Khách hàng",`${existing?"Chỉnh sửa":"Thêm"} thông tin khách hàng "${name}".`,{createdAt:now,tab:"sales",targetType:"customer",targetId:newId,targetDate:createdAt.slice(0,10)});
  activity.action=existing?"update":"create";
  store.customers=existing?customers.map(item=>item.id===newId?customer:item):[...customers,customer];
  store.activityHistory=[activity,...(store.activityHistory||[])];return customer;
}
module.exports={applyEmployeeInventoryExport,applyEmployeeCustomerSave};
