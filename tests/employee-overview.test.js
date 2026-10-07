const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { getEmployeeOverviewSales } = require("../functions/employee-overview");
const orders = [
  { date: "2026-09-01", total: 10000, customerName: "Private customer" },
  { date: "2026-09-01", total: 25000 },
  { date: "2026-09-02", total: 50000 },
  { date: "2026-09-02", total: 99999, status: "cancelled" },
  { date: "2026-10-07", total: 150000 },
  { date: "2026-09-03", total: "invalid" }
];
test("employee daily aggregates exclude cancelled orders and private order details", () => {
  assert.deepEqual(getEmployeeOverviewSales({orders}), [
    {date:"2026-09-01", total:35000, count:2},
    {date:"2026-09-02", total:50000, count:1},
    {date:"2026-10-07", total:150000, count:1}
  ]);
  assert.deepEqual(getEmployeeOverviewSales({}), []);
});
test("staff without sales permission receive totals only for their assigned store", () => {
  const source = fs.readFileSync("functions/index.js", "utf8");
  const fn = source.slice(source.indexOf("function sanitizeEmployeeState("), source.indexOf("function createEmployeeActivity("));
  const permissions = {closingBook:{manage:false},sales:{view:false,draft:false},purchase:{view:false},history:{viewOwn:false}};
  const context = {getEmployeeOverviewSales, normalizeEmployeePermissions:()=>permissions,
    getEmployeeStoreIds:(_,profile)=>[profile.storeId], normalizeEmployeeStoreSalesBills:()=>{}};
  vm.runInNewContext(fn, context);
  const result = context.sanitizeEmployeeState({stores:[
    {id:"a",orders,entries:[{amount:999}],customers:[{name:"Private"}]},
    {id:"b",orders:[{date:"2026-10-07",total:999999}]}
  ]}, {uid:"staff",profile:{storeId:"a"}});
  assert.equal(result.stores.length,1);
  assert.equal(result.stores[0].id,"a");
  assert.equal(result.stores[0].orders.length,0);
  assert.equal(result.stores[0].entries.length,0);
  assert.equal(result.stores[0].customers.length,0);
  assert.equal(result.stores[0].overviewSales[0].total,35000);
});
test("staff totals respect inclusive date ranges, empty ranges and cancelled-order fallback", () => {
  const source = fs.readFileSync("app.js","utf8");
  const fn = source.slice(source.indexOf("function getEmployeeSalesSummary("),source.indexOf("function renderEmployeeOverview("));
  const context={isCancelledEntry:order=>order.status==="cancelled"};
  vm.runInNewContext(fn,context);
  for (const store of [{orders},{overviewSales:getEmployeeOverviewSales({orders}),orders:[]}]) {
    assert.equal(context.getEmployeeSalesSummary(store,{start:"2026-09-01",end:"2026-09-02"}).total,85000);
    assert.equal(context.getEmployeeSalesSummary(store,{start:"2026-10-07",end:"2026-10-07"}).count,1);
    assert.equal(context.getEmployeeSalesSummary(store,{start:"2026-08-01",end:"2026-08-31"}).total,0);
  }
});
