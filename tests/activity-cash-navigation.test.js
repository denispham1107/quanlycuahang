const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function harness({type='income',employee=false,currentDate='2026-10-06',deleted=false,mobile=false}={}){
  const calls=[],classes=new Set(),styles=new Map(),row={getBoundingClientRect:()=>({height:190}),style:{setProperty:(name,value)=>styles.set(name,value)},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)},scrollIntoView:options=>calls.push(['scroll',options])};
  const store={activityHistory:[{id:'event'}],entries:deleted?[]:[{id:'record',date:currentDate}]};
  const context={USE_MOBILE_APP_THEME:mobile,getActiveStore:()=>store,resolveActivityTarget:()=>({tab:type,targetType:'entry',targetId:'record',targetDate:'2026-10-07'}),isEmployeeUser:()=>employee,
    uiState:{rangeMode:'all'},els:{timeFilterToggle:{hidden:false,getBoundingClientRect:()=>({bottom:52})},tabBar:{getBoundingClientRect:()=>({top:250})},rangeMode:{value:'all'},singleDate:{value:'2026-10-08'},incomeHistorySearch:{value:'old'},expenseHistorySearch:{value:'old'},incomeHistoryFilter:{value:'old'},expenseHistoryFilter:{value:'old'}},
    hideActivityHistoryPage:()=>calls.push(['close']),clearSettingsDetailHash:()=>{},activateTab:tab=>calls.push(['activate',tab]),setMobileCashFlowPanel:(...args)=>calls.push(['expand',...args]),render:()=>calls.push(['render']),findActivityTargetRow:()=>deleted?null:row,
    showActivityNavigationNotice:message=>calls.push(['notice',message]),document:{querySelector:()=>({scrollIntoView:()=>calls.push(['fallback-scroll'])})},window:{innerHeight:400,requestAnimationFrame:callback=>callback(),setTimeout:()=>{}}
  };
  vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function navigateToActivity(activityId) {'),app.indexOf('function addCategory(')),context);
  return {context,calls,classes,styles};
}
test('Thu and Chi navigation expand mobile history before rendering and then highlight/scroll the exact record',()=>{
  for(const type of ['income','expense']){
    const {context,calls,classes}=harness({type});context.navigateToActivity('event');
    assert.equal(context.els.singleDate.value,'2026-10-06','uses live record date after date edits');assert.equal(context.els[type+'HistorySearch'].value,'');assert.equal(context.els[type+'HistoryFilter'].value,'all');
    const expand=calls.findIndex(call=>call[0]==='expand'),render=calls.findIndex(call=>call[0]==='render'),scroll=calls.findIndex(call=>call[0]==='scroll');
    assert.ok(expand>=0&&expand<render&&render<scroll);assert.equal(calls[expand][1],type);assert.equal(calls[expand][2],'history');assert.equal(calls[expand][4].scroll,false);assert.ok(classes.has('activity-target-highlight'));
  }
});
test('employees denied Thu/Chi access stay on activity history without changing filters',()=>{
  for(const type of ['income','expense']){
    const {context,calls}=harness({type,employee:true});context.navigateToActivity('event');assert.deepEqual(calls,[['activate',type]]);assert.equal(context.els.singleDate.value,'2026-10-08');assert.equal(context.uiState.rangeMode,'all');assert.equal(context.els[type+'HistorySearch'].value,'old');
  }
});
test('deleted records reveal history and show an honest missing-record notice without highlighting a different row',()=>{
  const {context,calls,classes}=harness({deleted:true});context.navigateToActivity('event');assert.equal(context.els.singleDate.value,'2026-10-07');assert.ok(calls.some(call=>call[0]==='expand'));assert.equal(classes.size,0);assert.ok(calls.some(call=>call[0]==='notice'&&call[1].includes('có thể đã bị xóa')));
});
test('targeted mobile rows reserve room for the fixed navigation dock',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
  assert.match(css,/html\.mobile-app-theme tr\.activity-target-highlight \{[\s\S]*?scroll-margin-bottom: var\(--activity-target-scroll-bottom/);
  assert.match(app,/els\.timeFilterToggle\?\.getBoundingClientRect\(\)\.bottom/);
  assert.match(app,/row\.style\.setProperty\("--activity-target-scroll-bottom"/);
});
test('mobile target margins are measured from the visible filter and navigation, not fixed screen assumptions',()=>{
  for(const type of ['income','expense']){
    const {context,styles}=harness({type,mobile:true});context.navigateToActivity('event');assert.equal(styles.get('--activity-target-scroll-top'),'54px');assert.equal(styles.get('--activity-target-scroll-bottom'),'152px');
    context.els.timeFilterToggle.hidden=true;context.navigateToActivity('event');assert.equal(styles.get('--activity-target-scroll-top'),'2px');
  }
});
test('when a history card is taller than the usable viewport its beginning remains visible',()=>{
  const {context,calls}=harness({mobile:true});context.els.tabBar.getBoundingClientRect=()=>({top:220});context.navigateToActivity('event');assert.equal(calls.find(call=>call[0]==='scroll')[1].block,'start');
});
