const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const handler=app.slice(app.indexOf('els.deleteStore.addEventListener("click"'),app.indexOf('function applyRangeModeFilter('));
function fixture(answer,mutate){
 const state={activeStoreId:'a',stores:[{id:'a',name:'Cù Lao Petshop',entries:[{id:'keep-until-confirmed'}]},{id:'b',name:'Cửa hàng khác',entries:[{id:'untouched'}]}]},ctx={state,admin:true,saves:0,prompts:[],alerts:[]};
 ctx.isAdminUser=()=>ctx.admin;ctx.getActiveStore=()=>state.stores.find(s=>s.id===state.activeStoreId);ctx.saveAndRender=()=>ctx.saves++;
 ctx.window={prompt:(message,initial)=>{ctx.prompts.push({message,initial});mutate?.(ctx);return answer;},alert:message=>ctx.alerts.push(message)};
 ctx.els={deleteStore:{addEventListener:(_,callback)=>ctx.click=callback}};vm.runInNewContext(handler,ctx);return ctx;
}
test('store deletion requires exact typed name and starts with a blank confirmation',()=>{
 for(const answer of [null,'',' ','Cù Lao','Cù Lao Petshop ',' Cù Lao Petshop','cù lao petshop','Cu Lao Petshop','Cửa hàng khác']){
  const ctx=fixture(answer),before=JSON.stringify(ctx.state);ctx.click();assert.equal(ctx.saves,0);assert.equal(JSON.stringify(ctx.state),before);assert.equal(ctx.prompts[0].initial,'');assert.match(ctx.prompts[0].message,/Cù Lao Petshop/);assert.equal(ctx.alerts.length,answer===null?0:1);
 }
});
test('correct name deletes only the confirmed store and saves once',()=>{
 const ctx=fixture('Cù Lao Petshop');ctx.click();assert.equal(ctx.saves,1);assert.equal(ctx.alerts.length,0);assert.equal(ctx.state.activeStoreId,'b');assert.deepEqual(ctx.state.stores,[{id:'b',name:'Cửa hàng khác',entries:[{id:'untouched'}]}]);
});
test('employees and missing stores cannot open deletion confirmation',()=>{
 const ctx=fixture('Cù Lao Petshop');ctx.admin=false;ctx.click();assert.equal(ctx.prompts.length,0);assert.equal(ctx.saves,0);ctx.admin=true;ctx.state.activeStoreId=null;ctx.click();assert.equal(ctx.prompts.length,0);assert.equal(ctx.saves,0);
});
test('store switch, rename, removal or permission change invalidates a pending confirmation',()=>{
 for(const mutate of [ctx=>ctx.state.activeStoreId='b',ctx=>ctx.state.stores[0].name='Tên mới',ctx=>ctx.state.stores.shift(),ctx=>ctx.admin=false]){
  const ctx=fixture('Cù Lao Petshop',mutate);ctx.click();assert.equal(ctx.saves,0);assert.equal(ctx.alerts.length,1);assert.match(ctx.alerts[0],/đã thay đổi/);
 }
});
