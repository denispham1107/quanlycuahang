const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),app=fs.readFileSync('app.js','utf8'),css=fs.readFileSync('styles.css','utf8');
test('employee creation retains all unique permission names and account validation in grouped cards',()=>{
 const form=html.slice(html.indexOf('id="employeeCreateForm"'),html.indexOf('id="employeeManagerStatus"'));
 const names=[...form.matchAll(/name="([^"]+)" type="checkbox"/g)].map(m=>m[1]);assert.equal(names.length,11);assert.equal(new Set(names).size,11);for(const name of ['purchaseInventoryExport','purchaseInventoryTypeManage','salesCustomerManage','closingBookManage'])assert.ok(names.includes(name));assert.equal((form.match(/employee-permission-group/g)||[]).length,3);assert.match(form,/type="password" minlength="8"/);
});
test('editable employee cards preserve all permission fields in semantic sections',()=>{
 const i=app.indexOf('function employeePermissionFields('),j=app.indexOf('\nfunction ',i+1),ctx={normalizeEmployeePermissions:({permissions})=>permissions};vm.runInNewContext(app.slice(i,j),ctx);const fields=ctx.employeePermissionFields({purchase:{view:true,create:false,inventoryView:false,inventoryExport:false,inventoryTypeManage:false},sales:{view:true,create:false,draft:false,customerManage:false},history:{viewOwn:true},closingBook:{manage:false}});assert.equal((fields.match(/type="checkbox"/g)||[]).length,11);assert.equal((fields.match(/employee-permission-group/g)||[]).length,3);assert.equal((fields.match(/ checked /g)||[]).length,3);
});
test('employee redesign is scoped to its page and keeps a single scroll owner',()=>{
 const block=css.slice(css.indexOf('/* Employee management: pastel'),css.indexOf('/* End employee team workspace. */'));
 for(const match of block.matchAll(/([^{}]+)\{[^{}]*\}/g)){const selector=match[1].trim();if(selector.startsWith('@')||selector.startsWith('/*'))continue;assert.ok(selector.includes('#employeeManagerPage'),selector);}
 assert.match(block,/employee-manager-content \{ overflow: visible; max-height: none/);assert.doesNotMatch(block,/overflow-y:\s*(auto|scroll)/);assert.match(block,/font-size: 16px/);assert.match(html,/id="employeeStatTotal"/);assert.match(app,/total - active/);assert.match(app,/employee.active !== false && !employee.deletionPending/);
});
test('employee input focus clears the sticky page header without changing activity history',()=>{
 const i=app.indexOf('function ensureSettingsDetailFocusVisible('),j=app.indexOf('\nfunction ',i+1),ctx={};vm.runInNewContext(app.slice(i,j),ctx);
 const page={id:'employeeManagerPage',hidden:false,scrollTop:1000,getBoundingClientRect:()=>({top:0,bottom:400}),querySelector:()=>({getBoundingClientRect:()=>({bottom:70})})},target={closest:s=>s==='.settings-detail-page'?page:null,getBoundingClientRect:()=>({top:20,bottom:66})};ctx.ensureSettingsDetailFocusVisible(target);assert.equal(page.scrollTop,938);
 page.id='activityHistoryPage';page.scrollTop=1000;ctx.ensureSettingsDetailFocusVisible(target);assert.equal(page.scrollTop,1000);
});
test('small employee descriptions retain readable contrast on every pastel group',()=>{
 const lum=h=>h.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 for(const bg of ['f4fafc','ecf5fa','faf5fd','f0ecfa','fff7fa','faeef4','f0ebfb','e6f4ee','fbeaf0'])assert.ok((lum(bg)+.05)/(lum('5e6b82')+.05)>=4.5,bg);
});
